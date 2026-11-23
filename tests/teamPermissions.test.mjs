import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeStaffPermissions,
  resolveUserOrgContext,
  getAccessibleBuildings,
  canUserAccessBuilding,
  canUserCreateBuilding,
  canUserDeleteBuilding,
  canUserManageTeam,
  canUserEditBankAccountNumbers,
  canUserManageBuilding,
  isUserBuildingViewer,
  canActorManageTargetMember,
  detectBankAccountChanges,
  buildBankChangeNotification,
  resolveBuildingResidentContact,
  getNotificationsForUser,
  countUnreadNotifications,
  generateInviteToken,
  findPendingInviteByToken,
  generateTemporaryInvitePassword,
  buildInviteContinueUrl,
  extractInviteContextFromUrl,
  buildInviteWelcomeEmailContent,
  buildInviteMailtoUrl,
  buildForgotPasswordEmailContent,
} from '../src/utils/teamPermissions.js';

const BUILDINGS = [
  {
    id: 'b-1',
    name: 'Batyu u. 21.',
    organizationId: 'org-a',
    repName: 'Alfa Kezelő Kft.',
    phone: '+36 1 222 3333',
    email: 'iroda@alfa.hu',
    bankKK: { name: 'KK', bank: 'OTP', account: '11700001-11111111' },
    bankFA: { name: 'FA', bank: 'OTP', account: '11700001-22222222' },
    customBankAccounts: [
      { id: 'acc-lift', name: 'Lift Alap', bank: 'OTP', account: '11700001-33333333' },
    ],
  },
  {
    id: 'b-2',
    name: 'Kossuth u. 10.',
    organizationId: 'org-a',
    contactDisplayMode: 'manager',
    managerContact: {
      name: 'Kovács Anna',
      phone: '+36 30 987 6543',
      email: 'anna@alfa.hu',
      officeHours: 'H–Cs 9:00–16:00',
    },
    repName: 'Alfa Kezelő Kft.',
    phone: '+36 1 222 3333',
    email: 'iroda@alfa.hu',
  },
  {
    id: 'b-other',
    name: 'Másik Cég Ház',
    organizationId: 'org-b',
    repName: 'Béta Kft.',
    phone: '+36 1 999 8888',
    email: 'info@beta.hu',
  },
  {
    id: 'b-legacy',
    name: 'Régi RTDB Ház',
    repName: 'Régi Képviselő',
    phone: '+36 20 111 2222',
    email: 'regi@pelda.hu',
  },
];

const ORGANIZATIONS = [
  {
    id: 'org-a',
    name: 'Alfa Társasházkezelő Kft.',
    ownerEmail: 'tulaj@alfa.hu',
    ownerName: 'Főnök Péter',
    includeLegacyBuildings: true,
    centralContact: {
      name: 'Alfa Központi Iroda',
      phone: '+36 1 222 3333',
      email: 'iroda@alfa.hu',
      officeHours: 'H–P 8:00–17:00',
    },
    members: [
      {
        id: 'm-owner',
        email: 'tulaj@alfa.hu',
        name: 'Főnök Péter',
        orgRole: 'owner',
        active: true,
        buildingScope: 'all',
        buildingIds: [],
      },
      {
        id: 'm-anna',
        email: 'anna@alfa.hu',
        name: 'Kovács Anna',
        orgRole: 'staff',
        active: true,
        buildingScope: 'selected',
        buildingIds: ['b-2'],
        permissions: {
          canCreateBuildings: false,
          canManageTeam: false,
          canEditBankAccounts: false,
          canDeleteBuildings: true, // Tampered flag — MUST be forced false!
        },
      },
      {
        id: 'm-iroda',
        email: 'irodavezeto@alfa.hu',
        name: 'Nagy Béla',
        orgRole: 'staff',
        active: true,
        buildingScope: 'all',
        buildingIds: [],
        permissions: {
          canCreateBuildings: true,
          canManageTeam: true,
          canEditBankAccounts: true,
        },
      },
      {
        id: 'm-suspended',
        email: 'volt@alfa.hu',
        name: 'Volt Dolgozó',
        orgRole: 'staff',
        active: false,
        buildingScope: 'all',
        buildingIds: [],
        permissions: {
          canCreateBuildings: true,
          canManageTeam: true,
          canEditBankAccounts: true,
        },
      },
    ],
    invites: [
      {
        id: 'inv-valid',
        token: 'abcdef0123456789abcdef0123456789',
        email: 'ujkollega@alfa.hu',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
      {
        id: 'inv-expired',
        token: '99999999999999999999999999999999',
        email: 'lejart@alfa.hu',
        status: 'pending',
        expiresAt: new Date(Date.now() - 3600_000).toISOString(),
      },
    ],
  },
];

test('1. Legacy backwards compatibility: admin without org resolves as implicit owner', () => {
  const legacyAdmin = { email: 'legacy@admin.hu', role: 'admin', name: 'Legacy Admin' };
  const ctx = resolveUserOrgContext(legacyAdmin, [], BUILDINGS);

  assert.equal(ctx.isOwner, true);
  assert.equal(ctx.isStaff, false);
  assert.equal(ctx.permissions.canDeleteBuildings, true);
  assert.equal(ctx.permissions.canCreateBuildings, true);
  assert.equal(ctx.permissions.canManageTeam, true);
  assert.equal(ctx.permissions.canEditBankAccounts, true);

  const visible = getAccessibleBuildings(legacyAdmin, BUILDINGS, []);
  assert.deepEqual(visible.map((b) => b.id), ['b-legacy']);
});

test('2. Multi-company isolation & staff building scoping + instant offboarding', () => {
  const owner = { email: 'tulaj@alfa.hu', role: 'admin' };
  const anna = { email: 'anna@alfa.hu', role: 'admin' };
  const officeMgr = { email: 'irodavezeto@alfa.hu', role: 'admin' };
  const suspended = { email: 'volt@alfa.hu', role: 'admin' };
  const superAdmin = { email: 'root@tarsasapp.hu', role: 'superadmin' };

  // Owner sees org-a + legacy, NEVER org-b
  assert.deepEqual(
    getAccessibleBuildings(owner, BUILDINGS, ORGANIZATIONS).map((b) => b.id),
    ['b-1', 'b-2', 'b-legacy']
  );

  // Anna (selected scope) sees ONLY b-2
  assert.deepEqual(
    getAccessibleBuildings(anna, BUILDINGS, ORGANIZATIONS).map((b) => b.id),
    ['b-2']
  );
  assert.equal(canUserAccessBuilding(anna, BUILDINGS[1], ORGANIZATIONS, BUILDINGS), true);
  assert.equal(canUserAccessBuilding(anna, BUILDINGS[0], ORGANIZATIONS, BUILDINGS), false);

  // Office Manager (all scope) sees org-a + legacy, NEVER org-b
  assert.deepEqual(
    getAccessibleBuildings(officeMgr, BUILDINGS, ORGANIZATIONS).map((b) => b.id),
    ['b-1', 'b-2', 'b-legacy']
  );

  // Suspended staff immediately sees ZERO buildings and loses ALL permissions
  assert.deepEqual(getAccessibleBuildings(suspended, BUILDINGS, ORGANIZATIONS), []);
  assert.equal(canUserCreateBuilding(suspended, ORGANIZATIONS, BUILDINGS), false);
  assert.equal(canUserManageTeam(suspended, ORGANIZATIONS, BUILDINGS), false);
  assert.equal(canUserEditBankAccountNumbers(suspended, BUILDINGS[0], ORGANIZATIONS, BUILDINGS), false);

  // SuperAdmin sees everything
  assert.equal(getAccessibleBuildings(superAdmin, BUILDINGS, ORGANIZATIONS).length, BUILDINGS.length);
});

test('3. Strictly Owner-only building deletion (tampered staff permissions forced false)', () => {
  const normalized = normalizeStaffPermissions({
    canCreateBuildings: true,
    canManageTeam: true,
    canEditBankAccounts: true,
    canDeleteBuildings: true,
  });
  assert.equal(normalized.canDeleteBuildings, false);

  const owner = { email: 'tulaj@alfa.hu', role: 'admin' };
  const anna = { email: 'anna@alfa.hu', role: 'admin' };
  const officeMgr = { email: 'irodavezeto@alfa.hu', role: 'admin' };
  const superAdmin = { email: 'root@tarsasapp.hu', role: 'superadmin' };

  assert.equal(canUserDeleteBuilding(owner, BUILDINGS[0], ORGANIZATIONS, BUILDINGS), true);
  assert.equal(canUserDeleteBuilding(owner, BUILDINGS[2], ORGANIZATIONS, BUILDINGS), false); // org-b!
  assert.equal(canUserDeleteBuilding(anna, BUILDINGS[1], ORGANIZATIONS, BUILDINGS), false);
  assert.equal(canUserDeleteBuilding(officeMgr, BUILDINGS[0], ORGANIZATIONS, BUILDINGS), false);
  assert.equal(canUserDeleteBuilding(superAdmin, BUILDINGS[2], ORGANIZATIONS, BUILDINGS), true);
});

test('4. Anti-privilege-escalation guard for team delegation', () => {
  const ownerCtx = resolveUserOrgContext({ email: 'tulaj@alfa.hu', role: 'admin' }, ORGANIZATIONS, BUILDINGS);
  const annaCtx = resolveUserOrgContext({ email: 'anna@alfa.hu', role: 'admin' }, ORGANIZATIONS, BUILDINGS);
  const limitedManagerOrgs = [
    {
      ...ORGANIZATIONS[0],
      members: [
        ...ORGANIZATIONS[0].members,
        {
          id: 'm-hr',
          email: 'hr@alfa.hu',
          orgRole: 'staff',
          active: true,
          buildingScope: 'all',
          permissions: { canManageTeam: true, canCreateBuildings: false, canEditBankAccounts: false },
        },
      ],
    },
  ];
  const hrCtx = resolveUserOrgContext({ email: 'hr@alfa.hu', role: 'admin' }, limitedManagerOrgs, BUILDINGS);

  // Regular staff without canManageTeam cannot manage anyone
  assert.equal(
    canActorManageTargetMember(annaCtx, ORGANIZATIONS[0].members[2], null, 'anna@alfa.hu').allowed,
    false
  );

  // Staff manager CANNOT modify Owner
  const editOwner = canActorManageTargetMember(hrCtx, ORGANIZATIONS[0].members[0], null, 'hr@alfa.hu');
  assert.equal(editOwner.allowed, false);
  assert.equal(editOwner.reason, 'cannot_modify_owner');

  // Staff manager CANNOT modify themselves
  const editSelf = canActorManageTargetMember(hrCtx, limitedManagerOrgs[0].members[4], null, 'hr@alfa.hu');
  assert.equal(editSelf.allowed, false);
  assert.equal(editSelf.reason, 'cannot_modify_self');

  // Staff manager without canEditBankAccounts CANNOT grant it to others
  const escalateBank = canActorManageTargetMember(
    hrCtx,
    ORGANIZATIONS[0].members[1],
    { canEditBankAccounts: true },
    'hr@alfa.hu'
  );
  assert.equal(escalateBank.allowed, false);
  assert.equal(escalateBank.reason, 'privilege_escalation');

  // Nobody can grant canDeleteBuildings to staff
  const grantDelete = canActorManageTargetMember(
    ownerCtx,
    ORGANIZATIONS[0].members[1],
    { canDeleteBuildings: true },
    'tulaj@alfa.hu'
  );
  assert.equal(grantDelete.allowed, false);
  assert.equal(grantDelete.reason, 'delete_is_owner_only');

  // Owner CAN grant canEditBankAccounts & canCreateBuildings to staff
  const validGrant = canActorManageTargetMember(
    ownerCtx,
    ORGANIZATIONS[0].members[1],
    { canCreateBuildings: true, canEditBankAccounts: true, canDeleteBuildings: false },
    'tulaj@alfa.hu'
  );
  assert.equal(validGrant.allowed, true);
});

test('5. Bank account change detection & critical pale-red Owner notification', () => {
  const prevB = BUILDINGS[0];

  // Whitespace-only formatting differences should NOT trigger false alerts
  const noRealChanges = detectBankAccountChanges(
    prevB,
    { account: '11700001 - 11111111' },
    { account: '11700001-22222222' },
    prevB.customBankAccounts
  );
  assert.equal(noRealChanges.length, 0);

  // Modifying KK, adding a new sub-account, and removing Lift Alap must all be caught
  const changes = detectBankAccountChanges(
    prevB,
    { account: '11799999-88888888' },
    { account: '11700001-22222222' },
    [{ id: 'acc-new', name: 'Tető Alap', account: '11700001-44444444' }]
  );
  assert.equal(changes.length, 3);
  assert.equal(changes[0].accountKey, 'KK');
  assert.equal(changes[0].changeType, 'modified');
  assert.equal(changes[1].changeType, 'added');
  assert.equal(changes[2].changeType, 'removed');

  const notif = buildBankChangeNotification({
    actorUser: { name: 'Nagy Béla', email: 'irodavezeto@alfa.hu' },
    ownerEmail: 'tulaj@alfa.hu',
    building: prevB,
    changes,
  });

  assert.equal(notif.severity, 'critical');
  assert.equal(notif.type, 'bank_account_changed');
  assert.equal(notif.recipientEmail, 'tulaj@alfa.hu');
  assert.equal(notif.read, false);
  assert.match(notif.titleHu, /Bankszámlaszám módosítva/);
  assert.match(notif.titleEn, /Bank Account Changed/);
  assert.match(notif.messageHu, /11799999-88888888/);
  assert.equal(notif.changes.length, 3);
});

test('6. Per-building resident contact switcher (company vs building manager personal contact)', () => {
  // Default / company mode
  const companyRes = resolveBuildingResidentContact(BUILDINGS[0], {}, ORGANIZATIONS);
  assert.equal(companyRes.mode, 'company');
  assert.equal(companyRes.isPersonalManager, false);
  assert.equal(companyRes.name, 'Alfa Kezelő Kft.');
  assert.equal(companyRes.phone, '+36 1 222 3333');
  assert.equal(companyRes.showCentralEscalation, false);

  // Personal manager mode (set by the building's actual manager) - without central escalation
  const managerRes = resolveBuildingResidentContact(BUILDINGS[1], {}, ORGANIZATIONS);
  assert.equal(managerRes.mode, 'manager');
  assert.equal(managerRes.isPersonalManager, true);
  assert.equal(managerRes.name, 'Kovács Anna');
  assert.equal(managerRes.phone, '+36 30 987 6543');
  assert.equal(managerRes.email, 'anna@alfa.hu');
  assert.equal(managerRes.officeHours, 'H–Cs 9:00–16:00');
  assert.equal(managerRes.showCentralEscalation, false);

  // Personal manager mode WITH Owner escalation toggle enabled
  const orgWithEscalation = [{ ...ORGANIZATIONS[0], showCentralContactToResidents: true }];
  const managerWithEscalation = resolveBuildingResidentContact(BUILDINGS[1], {}, orgWithEscalation);
  assert.equal(managerWithEscalation.mode, 'manager');
  assert.equal(managerWithEscalation.isPersonalManager, true);
  assert.equal(managerWithEscalation.showCentralEscalation, true);
  assert.ok(managerWithEscalation.centralCompany);
  assert.equal(managerWithEscalation.centralCompany.name, 'Alfa Kezelő Kft.');
  assert.equal(managerWithEscalation.centralCompany.phone, '+36 1 222 3333');
  assert.equal(managerWithEscalation.centralCompany.email, 'iroda@alfa.hu');
});

test('7. Universal notification filtering, sorting, unread count, and invite tokens', () => {
  const ownerUser = { email: 'tulaj@alfa.hu', uid: 'uid-owner', buildingId: 'b-1' };
  const residentUser = { email: 'lako@pelda.hu', uid: 'uid-res', buildingId: 'b-1' };

  const notifs = [
    { id: 'n1', recipientEmail: 'tulaj@alfa.hu', severity: 'critical', read: false, dismissed: false, createdAt: '2026-11-21T10:00:00Z' },
    { id: 'n2', recipientEmail: 'tulaj@alfa.hu', severity: 'info', read: true, dismissed: false, createdAt: '2026-11-21T11:00:00Z' },
    { id: 'n3', recipientEmail: 'tulaj@alfa.hu', severity: 'info', read: false, dismissed: true, createdAt: '2026-11-21T12:00:00Z' },
    { id: 'n4', recipientScope: 'building', buildingId: 'b-1', severity: 'info', read: false, dismissed: false, createdAt: '2026-11-21T12:30:00Z' },
    { id: 'n5', recipientEmail: 'other@alfa.hu', severity: 'info', read: false, dismissed: false, createdAt: '2026-11-21T12:45:00Z' },
  ];

  const ownerList = getNotificationsForUser(notifs, ownerUser);
  assert.deepEqual(ownerList.map((n) => n.id), ['n4', 'n2', 'n1']); // newest first, dismissed excluded
  assert.equal(countUnreadNotifications(notifs, ownerUser), 2);

  const resList = getNotificationsForUser(notifs, residentUser);
  assert.deepEqual(resList.map((n) => n.id), ['n4']);
  assert.equal(countUnreadNotifications(notifs, residentUser), 1);

  // Invite token generation & lookup
  const token = generateInviteToken();
  assert.match(token, /^[0-9a-f]{32}$/);

  const validMatch = findPendingInviteByToken(ORGANIZATIONS, 'abcdef0123456789abcdef0123456789');
  assert.equal(validMatch?.isValid, true);
  assert.equal(validMatch?.invite.email, 'ujkollega@alfa.hu');

  const expiredMatch = findPendingInviteByToken(ORGANIZATIONS, '99999999999999999999999999999999');
  assert.equal(expiredMatch?.isValid, false);
  assert.equal(expiredMatch?.isExpired, true);
});

test('8. Colleague invite password-setup URL, nested continueUrl extraction, strong throwaway password & welcome email content', () => {
  // Strong throwaway password satisfies uppercase, lowercase, digit, symbol & >= 20 chars
  const tempPass = generateTemporaryInvitePassword(28);
  assert.equal(tempPass.length, 28);
  assert.match(tempPass, /[A-Z]/);
  assert.match(tempPass, /[a-z]/);
  assert.match(tempPass, /[0-9]/);
  assert.match(tempPass, /[!@#$%^&*\-_=+]/);

  // Build continueUrl back to LoginView with invite token, email, and passwordSet=1
  const token = 'abcdef0123456789abcdef0123456789';
  const continueUrl = buildInviteContinueUrl({
    origin: 'https://tarsashaz-cfe5d.web.app',
    token,
    email: 'Kollega@Alfa.HU',
    passwordSet: true,
  });
  assert.equal(
    continueUrl,
    `https://tarsashaz-cfe5d.web.app/?invite=${token}&email=kollega%40alfa.hu&passwordSet=1`
  );

  // Extract invite context from Firebase password-reset URL carrying nested continueUrl
  const resetSearch = `?mode=resetPassword&oobCode=FAKE_OOB_123&continueUrl=${encodeURIComponent(continueUrl)}`;
  const extracted = extractInviteContextFromUrl(resetSearch, '');
  assert.equal(extracted.mode, 'resetPassword');
  assert.equal(extracted.oobCode, 'FAKE_OOB_123');
  assert.equal(extracted.inviteToken, token);
  assert.equal(extracted.email, 'kollega@alfa.hu');
  assert.equal(extracted.passwordSet, true);
  assert.equal(extracted.isInvitePasswordReset, true);

  // Welcome email content (HU + EN) escapes HTML and includes inviter details, recipient email, building names & action URL
  const huEmail = buildInviteWelcomeEmailContent({
    recipientName: 'Kovács <Anna>',
    recipientEmail: 'anna@alfa.hu',
    orgName: 'Alfa Kft.',
    inviterName: 'Főnök Péter',
    inviterEmail: 'peter@alfa.hu',
    buildingNames: ['Batyu u. 21.'],
    actionUrl: continueUrl,
    isEn: false,
  });
  assert.match(huEmail.subject, /TarsasApp meghívó/);
  assert.match(huEmail.textBody, /Batyu u\. 21\./);
  assert.match(huEmail.textBody, /Főnök Péter \(peter@alfa\.hu\)/);
  assert.match(huEmail.textBody, /anna@alfa\.hu/);
  assert.match(huEmail.htmlBody, /Kovács &lt;Anna&gt;/);
  assert.match(huEmail.htmlBody, /Főnök Péter \(peter@alfa\.hu\)/);
  assert.match(huEmail.htmlBody, /anna@alfa\.hu/);
  assert.match(huEmail.htmlBody, /Jelszó beállítása és fiók aktiválása/);
  assert.ok(!huEmail.htmlBody.includes('<Anna>'));

  const mailto = buildInviteMailtoUrl({
    recipientName: 'Anna',
    recipientEmail: 'anna@alfa.hu',
    orgName: 'Alfa Kft.',
    inviterName: 'Főnök Péter',
    inviterEmail: 'peter@alfa.hu',
    buildingNames: ['Batyu u. 21.'],
    actionUrl: continueUrl,
    isEn: true,
  });
  assert.ok(mailto.startsWith('mailto:anna%40alfa.hu?subject='));

  // Dedicated professional Forgot Password email content (distinct from invite email)
  const forgotHu = buildForgotPasswordEmailContent({
    recipientEmail: 'anna@alfa.hu',
    actionUrl: 'https://tarsashaz-cfe5d.web.app/?mode=resetPassword&oobCode=123',
    isEn: false,
  });
  assert.equal(forgotHu.subject, 'TarsasApp – Jelszó visszaállítása');
  assert.match(forgotHu.textBody, /Jelszó-visszaállítást kezdeményeztek/);
  assert.match(forgotHu.htmlBody, /Új jelszó megadása/);
  assert.match(forgotHu.htmlBody, /anna@alfa\.hu/);
  assert.notEqual(forgotHu.subject, huEmail.subject);
});

test('9. Per-building assignments: different roles & permissions on different buildings for same colleague', () => {
  const colleague = { email: 'multirole@alfa.hu', role: 'admin' };
  const customOrgs = [
    {
      id: 'org-a',
      name: 'Alfa Kft.',
      ownerEmail: 'tulaj@alfa.hu',
      centralContact: {
        name: 'Alfa Kft.',
        email: 'info@alfa.hu',
        phone: '+36 1 000 0000',
      },
      members: [
        {
          id: 'm-owner',
          email: 'tulaj@alfa.hu',
          orgRole: 'owner',
          active: true,
          buildingScope: 'all',
        },
        {
          id: 'm-multi',
          email: 'multirole@alfa.hu',
          name: 'Többházas Tamás',
          orgRole: 'staff',
          active: true,
          buildingScope: 'selected',
          buildingIds: ['b-1', 'b-2'],
          permissions: {
            canCreateBuildings: false,
            canManageTeam: false,
            canEditBankAccounts: false, // global default is false
          },
          buildingAssignments: {
            'b-1': {
              role: 'manager',
              canEditBankAccounts: true, // overridden to true on b-1
              showManagerContact: true,
              showCentralContact: true,
            },
            'b-2': {
              role: 'viewer', // read-only viewer on b-2
              canEditBankAccounts: false,
              showManagerContact: false,
              showCentralContact: false,
            },
          },
        },
      ],
    },
  ];

  const testBuildings = [
    {
      id: 'b-1',
      name: 'Ház 1',
      organizationId: 'org-a',
      contactDisplayMode: 'manager',
      managerContact: {
        name: 'Többházas Tamás',
        email: 'multirole@alfa.hu',
        phone: '+36 30 111 2222',
      },
      showCentralContactToResidents: true,
    },
    {
      id: 'b-2',
      name: 'Ház 2',
      organizationId: 'org-a',
      contactDisplayMode: 'company',
      showCentralContactToResidents: false,
    },
  ];

  // Access check: colleague has access to both buildings
  assert.equal(canUserAccessBuilding(colleague, testBuildings[0], customOrgs, testBuildings), true);
  assert.equal(canUserAccessBuilding(colleague, testBuildings[1], customOrgs, testBuildings), true);

  // Management (write) check: Manager on b-1, Viewer on b-2
  assert.equal(canUserManageBuilding(colleague, testBuildings[0], customOrgs, testBuildings), true);
  assert.equal(canUserManageBuilding(colleague, testBuildings[1], customOrgs, testBuildings), false);
  assert.equal(canUserManageBuilding(colleague, 'b-1', customOrgs, testBuildings), true);
  assert.equal(canUserManageBuilding(colleague, 'b-2', customOrgs, testBuildings), false);

  // Read-only viewer check: Viewer on b-2, NOT viewer on b-1
  assert.equal(isUserBuildingViewer(colleague, testBuildings[0], customOrgs, testBuildings), false);
  assert.equal(isUserBuildingViewer(colleague, testBuildings[1], customOrgs, testBuildings), true);
  assert.equal(isUserBuildingViewer(colleague, 'b-1', customOrgs, testBuildings), false);
  assert.equal(isUserBuildingViewer(colleague, 'b-2', customOrgs, testBuildings), true);

  // Bank account editing check: canEditBankAccounts is TRUE on b-1, but FALSE on b-2
  assert.equal(canUserEditBankAccountNumbers(colleague, testBuildings[0], customOrgs, testBuildings), true);
  assert.equal(canUserEditBankAccountNumbers(colleague, testBuildings[1], customOrgs, testBuildings), false);

  // Resident contact check for b-1 (Manager mode + escalation enabled)
  const contactB1 = resolveBuildingResidentContact(
    testBuildings[0],
    { companyName: 'Alfa Kft.', phone: '+36 1 000 0000', email: 'info@alfa.hu' },
    customOrgs
  );
  assert.equal(contactB1.mode, 'manager');
  assert.equal(contactB1.name, 'Többházas Tamás');
  assert.equal(contactB1.email, 'multirole@alfa.hu');
  assert.equal(contactB1.showCentralEscalation, true);
  assert.ok(contactB1.centralCompany);
  assert.equal(contactB1.centralCompany.email, 'info@alfa.hu');

  // Resident contact check for b-2 (Company mode + escalation disabled)
  const contactB2 = resolveBuildingResidentContact(
    testBuildings[1],
    { companyName: 'Alfa Kft.', phone: '+36 1 000 0000', email: 'info@alfa.hu' },
    customOrgs
  );
  assert.equal(contactB2.name, 'Alfa Kft.');
  assert.equal(contactB2.showCentralEscalation, false);
});
