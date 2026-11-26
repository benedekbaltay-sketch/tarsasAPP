import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeMailAttachments,
  buildDirectMessagePayload,
  resolveBuildingKkRecipients,
  resolveBuildingSzvbRecipients,
  resolveBuildingAuditorRecipient,
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

test('1. Resident can send direct message with attachments strictly to KK (blocked from messaging other residents)', () => {
  const { building, organizations, users } = makeFixtures();
  const residentUser = { email: 'lako1@example.com', name: 'Lakó Egy', role: 'Owner', buildingId: 'b-mail', flatNum: '1' };

  // Attempting non-KK mode is strictly blocked
  const blocked = buildDirectMessagePayload({
    actorUser: residentUser,
    building,
    organizations,
    users,
    recipientMode: 'szvb',
    subject: 'Teszt',
    body: 'Teszt üzenet',
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'resident-kk-only');

  // Sending to KK succeeds with sanitized attachments & sender copy
  const res = buildDirectMessagePayload({
    actorUser: residentUser,
    building,
    organizations,
    users,
    recipientMode: 'kk',
    subject: 'Csőtörés bejelentés',
    body: 'Csatoltam a fotót a pincéről.',
    category: 'urgent',
    attachments: [
      { id: 'att-1', fileName: '../../pince.pdf', fileSize: '42 KB', mimeType: 'application/pdf', fileData: 'data:application/pdf;base64,JVBERi0x' },
    ],
  });

  assert.equal(res.ok, true);
  assert.equal(res.recipientNotifications.length, 1);
  assert.equal(res.recipientNotifications[0].recipientEmail, 'kk@example.com');
  assert.equal(res.recipientNotifications[0].targetProfile.type, 'kk');
  assert.equal(res.recipientNotifications[0].attachments.length, 1);
  assert.equal(res.recipientNotifications[0].attachments[0].fileName, 'pince.pdf');
  assert.equal(res.senderCopyNotification.meta.isSenderCopy, true);
  assert.equal(res.senderCopyNotification.read, true);
  assert.equal(res.senderCopyNotification.targetProfile.type, 'owner');
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
