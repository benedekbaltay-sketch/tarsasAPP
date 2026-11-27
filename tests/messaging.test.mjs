import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeMailAttachments,
  buildDirectMessagePayload,
  resolveBuildingKkRecipients,
  resolveBuildingSzvbRecipients,
  resolveBuildingAuditorRecipient,
  resolveResidentProfileEmail,
  resolveMailSenderInfo,
  resolveMessageThreadId,
  getConversationThreadMessages,
  groupNotificationsByThread,
} from '../src/utils/directMessaging.js';
import {
  resolveUserProfiles,
  getNotificationsForActiveProfile,
  getSentMessagesForActiveProfile,
  getArchivedNotificationsForActiveProfile,
  getUnreadNotificationCountsByProfile,
} from '../src/utils/userProfiles.js';
import { sanitizeEconomicAuditor } from '../src/utils/economicAuditor.js';

function makeFixtures() {
  const building = {
    id: 'b-mail',
    name: 'Kossuth u. 4.',
    organizationId: 'org-1',
    flats: [
      {
        flatNum: '1',
        ownerName: 'Lakó Egy',
        email: 'lako1@example.com',
        owners: [{ name: 'Lakó Egy', email: 'lako1@example.com' }],
      },
      {
        flatNum: '2',
        ownerName: 'SZVB Elnök',
        email: 'szvb@example.com',
        owners: [{ name: 'SZVB Elnök', email: 'szvb@example.com' }],
      },
    ],
    szvb: {
      chairperson: { key: 'szvb@example.com', name: 'SZVB Elnök', email: 'szvb@example.com', flatNum: '2' },
      members: [],
    },
    economicAuditor: sanitizeEconomicAuditor({
      enabled: true,
      type: 'external',
      name: 'Dr. Könyvvizsgáló Anna',
      email: 'anna@audit.hu',
    }),
  };

  const organizations = [
    {
      id: 'org-1',
      name: 'KK Kft.',
      ownerEmail: 'kk@example.com',
      members: [
        { id: 'm-owner', email: 'kk@example.com', name: 'Fő KK', orgRole: 'owner', active: true, buildingScope: 'all' },
      ],
    },
  ];

  const users = [
    { id: 'u-kk', email: 'kk@example.com', name: 'Fő KK', role: 'admin' },
  ];

  return { building, organizations, users };
}

test('1. Resident can message KK and/or the entire SZVB committee at once, must have profile email for Email delivery, and replies preserve conversation thread chains', () => {
  const { building, organizations, users } = makeFixtures();
  building.szvb.members = [
    { key: 'szvb2@example.com', name: 'SZVB Tag Kettő', email: 'szvb2@example.com', flatNum: '3' },
  ];
  const residentUser = { email: 'lako1@example.com', name: 'Lakó Egy', role: 'Owner', buildingId: 'b-mail', flatNum: '1' };
  const residentNoEmail = { email: '', name: 'Email Nélküli Lakó', role: 'Owner', buildingId: 'b-mail', flatNum: '99' };

  // Attempting auditor mode is strictly blocked for residents
  const blocked = buildDirectMessagePayload({
    actorUser: residentUser,
    building,
    organizations,
    users,
    recipientMode: 'auditor',
    subject: 'Teszt',
    body: 'Teszt üzenet',
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'resident-kk-szvb-only');

  // Resident without configured profile email CANNOT send via email channel
  assert.equal(resolveResidentProfileEmail(residentNoEmail, building), '');
  const blockedEmail = buildDirectMessagePayload({
    actorUser: residentNoEmail,
    building,
    organizations,
    users,
    recipientMode: 'kk',
    subject: 'Email próba',
    body: 'Nincs e-mailem.',
    deliveryChannel: 'email',
  });
  assert.equal(blockedEmail.ok, false);
  assert.equal(blockedEmail.error, 'sender-email-required');

  // Sending to whole SZVB delivers to ALL SZVB members at once (chairperson + every member)
  const szvbAll = buildDirectMessagePayload({
    actorUser: residentUser,
    building,
    organizations,
    users,
    recipientMode: 'szvb',
    includeKk: false,
    includeSzvb: true,
    subject: 'Kérdés a teljes SZVB-hez',
    body: 'Kérem a könyvelés ellenőrzését.',
  });
  assert.equal(szvbAll.ok, true);
  assert.equal(szvbAll.recipientNotifications.length, 2);
  assert.deepEqual(
    szvbAll.recipientNotifications.map((n) => n.recipientEmail).sort(),
    ['szvb2@example.com', 'szvb@example.com']
  );
  assert.ok(szvbAll.threadId);
  assert.equal(szvbAll.recipientNotifications[0].threadId, szvbAll.threadId);

  // Sending to KK + whole SZVB delivers to KK + all SZVB members & preserves attachments
  const both = buildDirectMessagePayload({
    actorUser: residentUser,
    building,
    organizations,
    users,
    recipientMode: 'kk_and_szvb',
    includeKk: true,
    includeSzvb: true,
    deliveryChannel: 'both',
    subject: 'Csőtörés bejelentés',
    body: 'Csatoltam a fotót a pincéről.',
    attachments: [
      { id: 'att-1', fileName: '../../pince.pdf', fileSize: '42 KB', mimeType: 'application/pdf', fileData: 'data:application/pdf;base64,JVBERi0x' },
    ],
  });
  assert.equal(both.ok, true);
  assert.equal(both.recipientNotifications.length, 3);
  assert.equal(both.recipientNotifications[0].attachments[0].fileName, 'pince.pdf');

  // KK replies -> inherits threadId -> Resident sees full 2-message Gmail/Outlook chain chronologically!
  const kkUser = { email: 'kk@example.com', name: 'Fő KK', role: 'admin' };
  const kkReceived = both.recipientNotifications.find((n) => n.recipientEmail === 'kk@example.com');
  const kkReply = buildDirectMessagePayload({
    actorUser: kkUser,
    building,
    organizations,
    users,
    replyToNotif: kkReceived,
    subject: 'Re: Csőtörés bejelentés',
    body: 'Köszönjük, a szerelő már úton van!',
  });
  assert.equal(kkReply.ok, true);
  assert.equal(kkReply.threadId, both.threadId);
  assert.equal(kkReply.recipientNotifications[0].threadId, both.threadId);
  assert.equal(kkReply.recipientNotifications[0].recipientEmail, 'lako1@example.com');

  const residentAll = [both.senderCopyNotification, kkReply.recipientNotifications[0]];
  const chain = getConversationThreadMessages(residentAll, kkReply.recipientNotifications[0]);
  assert.equal(chain.length, 2);
  assert.equal(resolveMessageThreadId(chain[0]), both.threadId);
  assert.equal(resolveMessageThreadId(chain[1]), both.threadId);
  const grouped = groupNotificationsByThread([kkReply.recipientNotifications[0]], residentAll);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].threadCount, 2);
});

test('2. Financial Auditor submits Official Written Opinion via Mail -> notifies KK & SZVB AND syncs auditOpinions', () => {
  const { building, organizations, users } = makeFixtures();
  const auditorUser = { email: 'anna@audit.hu', name: 'Dr. Könyvvizsgáló Anna', role: 'auditor', buildingId: 'b-mail' };

  const res = buildDirectMessagePayload({
    actorUser: auditorUser,
    building,
    organizations,
    users,
    recipientMode: 'kk_and_szvb',
    subject: '2025. évi elszámolás szakmai véleménye',
    body: 'A könyvelés és a bizonylatok megfelelnek az előírásoknak.',
    attachments: [
      { id: 'att-op', fileName: 'velemeny_2025.pdf', fileSize: '120 KB', mimeType: 'application/pdf', fileData: 'data:application/pdf;base64,JVBERi0x' },
    ],
    auditOpinionMeta: {
      isOfficialOpinion: true,
      year: 2025,
      verdict: 'approved',
    },
  });

  assert.equal(res.ok, true);
  assert.equal(res.recipientNotifications.length, 2);
  const kkNotif = res.recipientNotifications.find((n) => n.recipientEmail === 'kk@example.com');
  const szvbNotif = res.recipientNotifications.find((n) => n.recipientEmail === 'szvb@example.com');
  assert.ok(kkNotif);
  assert.equal(kkNotif.targetProfile.type, 'kk');
  assert.equal(kkNotif.type, 'audit_opinion');
  assert.ok(szvbNotif);
  assert.equal(szvbNotif.targetProfile.type, 'szvb');
  assert.ok(res.syncedAuditOpinion);
  assert.equal(res.syncedAuditOpinion.year, 2025);
  assert.equal(res.syncedAuditOpinion.verdict, 'approved');
  assert.equal(res.syncedAuditOpinion.fileName, 'velemeny_2025.pdf');
  assert.equal(res.syncedAuditOpinion.source, 'mail');
});

test('3. Archive & Unarchive move letters cleanly between Inbox/Sent and Archive without breaking unread badges or profile isolation', () => {
  const { building, organizations, users } = makeFixtures();
  const residentUser = { email: 'lako1@example.com', name: 'Lakó Egy', role: 'Owner', buildingId: 'b-mail', flatNum: '1' };
  const kkUser = { email: 'kk@example.com', name: 'Fő KK', role: 'admin' };

  const sent = buildDirectMessagePayload({
    actorUser: residentUser,
    building,
    organizations,
    users,
    recipientMode: 'kk',
    subject: 'Kérdés a közös költségről',
    body: 'Kérem a részletezést.',
  });

  const allNotifs = [...sent.recipientNotifications, sent.senderCopyNotification];
  const residentProfiles = resolveUserProfiles(residentUser, { buildings: [building], organizations, users }).allProfiles;
  const kkProfiles = resolveUserProfiles(kkUser, { buildings: [building], organizations, users }).allProfiles;

  // Before archiving: Resident sees 0 inbox (sender copy is in Sent!), 1 sent, 0 archive; KK sees 1 unread inbox
  assert.equal(getNotificationsForActiveProfile(allNotifs, residentUser, residentProfiles).length, 0);
  assert.equal(getSentMessagesForActiveProfile(allNotifs, residentUser, residentProfiles).length, 1);
  assert.equal(getArchivedNotificationsForActiveProfile(allNotifs, residentUser, residentProfiles).length, 0);

  assert.equal(getNotificationsForActiveProfile(allNotifs, kkUser, kkProfiles).length, 1);
  assert.equal(getUnreadNotificationCountsByProfile(allNotifs, kkUser, kkProfiles).activeProfileUnread, 1);

  // Archive KK's received message -> disappears from KK Inbox & unread count drops to 0, appears in KK Archive!
  const kkMsgId = sent.recipientNotifications[0].id;
  const afterArchive = allNotifs.map((n) =>
    n.id === kkMsgId ? { ...n, read: true, archived: true, archivedAt: new Date().toISOString() } : n
  );

  assert.equal(getNotificationsForActiveProfile(afterArchive, kkUser, kkProfiles).length, 0);
  assert.equal(getUnreadNotificationCountsByProfile(afterArchive, kkUser, kkProfiles).activeProfileUnread, 0);
  assert.equal(getArchivedNotificationsForActiveProfile(afterArchive, kkUser, kkProfiles).length, 1);
  // Resident's archive is completely unaffected
  assert.equal(getArchivedNotificationsForActiveProfile(afterArchive, residentUser, residentProfiles).length, 0);

  // Restore KK's archived message -> returns to KK Inbox!
  const afterRestore = afterArchive.map((n) =>
    n.id === kkMsgId ? { ...n, archived: false, archivedAt: null } : n
  );
  assert.equal(getNotificationsForActiveProfile(afterRestore, kkUser, kkProfiles).length, 1);
  assert.equal(getArchivedNotificationsForActiveProfile(afterRestore, kkUser, kkProfiles).length, 0);

  // Permanently delete KK's message -> removed from KK Inbox AND Archive, while Resident's Sent copy stays intact!
  const afterDelete = afterRestore.map((n) =>
    n.id === kkMsgId ? { ...n, read: true, deleted: true, deletedAt: new Date().toISOString() } : n
  );
  assert.equal(getNotificationsForActiveProfile(afterDelete, kkUser, kkProfiles).length, 0);
  assert.equal(getArchivedNotificationsForActiveProfile(afterDelete, kkUser, kkProfiles).length, 0);
  assert.equal(getSentMessagesForActiveProfile(afterDelete, residentUser, residentProfiles).length, 1);
});

test('4. sanitizeMailAttachments strips large inline blobs while keeping cloud storageKey & safe filenames', () => {
  const bigBlob = 'data:application/pdf;base64,' + 'A'.repeat(150_000);
  const smallBlob = 'data:application/pdf;base64,JVBERi0x';
  const cleaned = sanitizeMailAttachments([
    { id: 'big1', fileName: 'nagy_beszamolo.pdf', fileSize: '2.1 MB', fileData: bigBlob },
    { id: 'sm1', fileName: '..\\szamla.pdf', fileSize: '5 KB', fileData: smallBlob },
  ]);

  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].inlineData, '');
  assert.equal(cleaned[0].hasCloudFile, true);
  assert.equal(cleaned[0].storageKey, 'condo_doc_files/mail/big1');
  assert.equal(cleaned[1].fileName, 'szamla.pdf');
  assert.equal(cleaned[1].inlineData, smallBlob);
});

test('5. Recipient resolvers deduplicate KK, SZVB, and active Financial Auditor cleanly & preserve sender + deliveryChannel metadata', () => {
  const { building, organizations, users } = makeFixtures();
  assert.equal(resolveBuildingKkRecipients(building, organizations, users).length, 1);
  assert.equal(resolveBuildingSzvbRecipients(building).length, 1);
  assert.equal(resolveBuildingAuditorRecipient(building)?.email, 'anna@audit.hu');

  const auditorUser = { email: 'anna@audit.hu', name: 'Dr. Könyvvizsgáló Anna', role: 'auditor', buildingId: 'b-mail' };
  const payload = buildDirectMessagePayload({
    actorUser: auditorUser,
    building,
    organizations,
    users,
    recipientMode: 'kk_and_szvb',
    subject: 'Havi könyvelés észrevétel',
    body: 'Minden tétel rendben van.',
    deliveryChannel: 'both',
  });
  assert.equal(payload.ok, true);
  assert.equal(payload.recipientNotifications[0].actorName, 'Dr. Könyvvizsgáló Anna');
  assert.equal(payload.recipientNotifications[0].meta.senderRoleLabelHu, 'Gazdasági ellenőr');
  assert.equal(payload.recipientNotifications[0].meta.deliveryChannel, 'both');
  assert.equal(payload.senderCopyNotification.meta.deliveryChannel, 'both');
});

test('6. Full 7-direction communication matrix: SZVB -> All Residents (bypassing KK) allowed, Auditor -> Resident strictly blocked', () => {
  const { building, organizations, users } = makeFixtures();
  building.flats.push({
    flatNum: '2',
    ownerName: 'Második Lakó',
    email: 'lako2@example.com',
    owners: [{ name: 'Második Lakó', email: 'lako2@example.com' }],
  });

  const szvbUser = { email: 'szvb@example.com', name: 'SZVB Elnök', role: 'szvb', buildingId: 'b-mail', flatNum: '1' };
  const auditorUser = { email: 'anna@audit.hu', name: 'Dr. Könyvvizsgáló Anna', role: 'auditor', buildingId: 'b-mail' };

  // 1) SZVB -> All Residents bypassing KK (committee annual report) -> ALLOWED, targets owner profiles individually!
  const szvbToResidents = buildDirectMessagePayload({
    actorUser: szvbUser,
    building,
    organizations,
    users,
    recipientMode: 'custom',
    includeKk: false,
    includeAuditor: false,
    includeResidents: true,
    subject: 'Éves SZVB ellenőrzési jelentés',
    body: 'A bizottság elvégezte az éves ellenőrzést.',
    deliveryChannel: 'both',
  });
  assert.equal(szvbToResidents.ok, true);
  assert.equal(szvbToResidents.recipientNotifications.length, 3);
  assert.ok(szvbToResidents.recipientNotifications.every((n) => n.targetProfile?.type === 'owner'));
  assert.ok(!szvbToResidents.recipientNotifications.some((n) => n.recipientEmail === 'kk@example.com'));

  // 2) SZVB -> KK + Auditor simultaneously -> ALLOWED
  const szvbToKkAndAuditor = buildDirectMessagePayload({
    actorUser: szvbUser,
    building,
    organizations,
    users,
    recipientMode: 'custom',
    includeKk: true,
    includeAuditor: true,
    includeResidents: false,
    subject: 'Egyeztetés az iratátadásról',
    body: 'Kérjük a főkönyvi kivonatokat.',
    deliveryChannel: 'both',
  });
  assert.equal(szvbToKkAndAuditor.ok, true);
  assert.equal(szvbToKkAndAuditor.recipientNotifications.length, 2);
  assert.ok(szvbToKkAndAuditor.recipientNotifications.some((n) => n.recipientEmail === 'kk@example.com'));
  assert.ok(szvbToKkAndAuditor.recipientNotifications.some((n) => n.recipientEmail === 'anna@audit.hu'));

  // 3) Financial Auditor -> Residents directly -> STRICTLY BLOCKED!
  const auditorToResidents = buildDirectMessagePayload({
    actorUser: auditorUser,
    building,
    organizations,
    users,
    recipientMode: 'residents',
    includeResidents: true,
    subject: 'Közvetlen levél lakóknak',
    body: 'Tiltott irány.',
  });
  assert.equal(auditorToResidents.ok, false);
  assert.equal(auditorToResidents.error, 'auditor-kk-szvb-only');

  // 4) Financial Auditor replying to a Resident message -> STRICTLY BLOCKED!
  const auditorReplyToResident = buildDirectMessagePayload({
    actorUser: auditorUser,
    building,
    organizations,
    users,
    replyToNotif: {
      id: 'n-res-1',
      actorEmail: 'lako2@example.com',
      actorName: 'Második Lakó',
      meta: { senderProfile: { type: 'owner', buildingId: 'b-mail', flatNum: '2' } },
    },
    subject: 'Re: Kérdés',
    body: 'Tiltott válasz.',
  });
  assert.equal(auditorReplyToResident.ok, false);
  assert.equal(auditorReplyToResident.error, 'auditor-kk-szvb-only');
});

test('7. resolveMailSenderInfo resolves profile name + email + role, and groupNotificationsByThread exposes tab-scoped tabItemIds', () => {
  const { building, organizations, users } = makeFixtures();

  // Case A: Server notification where actorName was stored as raw email -> resolves real owner name + email
  const fromEmailOnly = resolveMailSenderInfo(
    {
      id: 'n1',
      actorName: 'kk@example.com',
      actorEmail: 'kk@example.com',
      meta: { senderProfile: { type: 'kk' } },
    },
    { organizations, buildings: [building], users, isEn: false }
  );
  assert.equal(fromEmailOnly.name, 'Fő KK');
  assert.equal(fromEmailOnly.email, 'kk@example.com');
  assert.equal(fromEmailOnly.roleLabel, 'Közös Képviselő');
  assert.equal(fromEmailOnly.hasSender, true);

  // Case B: Resident sender -> resolves flat owner's profile name + email + flat role label
  const fromResident = resolveMailSenderInfo(
    {
      id: 'n2',
      actorEmail: 'lako1@example.com',
      meta: { senderProfile: { type: 'owner', flatNum: '1' } },
    },
    { organizations, buildings: [building], users, isEn: false }
  );
  assert.equal(fromResident.name, 'Lakó Egy');
  assert.equal(fromResident.email, 'lako1@example.com');
  assert.equal(fromResident.roleLabel, '1. lakás');

  // Case C: groupNotificationsByThread returns strictly tab-scoped tabItemIds (archive vs inbox isolation)
  const inboxMsg = { id: 'm-inbox', threadId: 't-1', createdAt: '2026-10-01T10:00:00Z', read: false };
  const sentMsg = { id: 'm-sent', threadId: 't-1', createdAt: '2026-10-01T10:05:00Z', read: true, meta: { isSenderCopy: true } };
  const threads = groupNotificationsByThread([inboxMsg], [inboxMsg, sentMsg]);
  assert.equal(threads.length, 1);
  assert.deepEqual(threads[0].tabItemIds, ['m-inbox']);
  assert.equal(threads[0].threadCount, 2);
});
