import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveUserProfiles,
  getActiveProfileKey,
  getNotificationsForActiveProfile,
  getUnreadNotificationCountsByProfile,
  resolveInitialLoginProfile,
} from '../src/utils/userProfiles.js';
import {
  buildBankChangeNotification,
  buildTeamUpdateNotification,
  buildNotification,
  resolveUserOrgContext,
  canUserManageBuilding,
  canUserEditBankAccountNumbers,
  canUserCreateBuilding,
  canUserDeleteBuilding,
  canUserManageTeam,
} from '../src/utils/teamPermissions.js';
import { buildSzvbUpdateNotifications } from '../src/utils/szvb.js';

const buildings = [
  {
    id: 'b1',
    name: 'Kossuth u. 4.',
    flats: [
      {
        flatNum: '14',
        ownerName: 'Kovács János',
        email: 'janos@example.com',
        owners: [{ name: 'Kovács János', email: 'janos@example.com' }],
      },
    ],
    szvb: {
      chairperson: { name: 'Kovács János', email: 'janos@example.com', flatNum: '14' },
      members: [],
    },
  },
  {
    id: 'b2',
    name: 'Batyu u. 21.',
    flats: [
      {
        flatNum: '3',
        ownerName: 'Kovács János',
        email: 'janos@example.com',
        owners: [{ name: 'Kovács János', email: 'janos@example.com' }],
      },
    ],
  },
];

const organizations = [
  {
    id: 'org-1',
    name: 'Példa Képviselet Kft.',
    ownerEmail: 'owner@example.com',
    members: [
      {
        id: 'm-1',
        name: 'Kovács János',
        email: 'janos@example.com',
        orgRole: 'staff',
        active: true,
        buildingScope: 'all',
      },
    ],
  },
];

test('1. Single verified email resolves KK, SZVB, and multiple Owner profiles cleanly', () => {
  const res = resolveUserProfiles(
    { email: 'JANOS@example.com', name: 'Kovács János' },
    { buildings, organizations, users: [] }
  );

  assert.ok(res.kkProfile);
  assert.equal(res.kkProfile.id, 'kk');
  assert.equal(res.szvbProfiles.length, 1);
  assert.equal(res.szvbProfiles[0].id, 'szvb:b1');
  assert.equal(res.szvbProfiles[0].linkedOwnerProfileId, 'owner:b1:14');
  assert.equal(res.ownerProfiles.length, 2);
  assert.deepEqual(
    res.ownerProfiles.map((p) => p.id),
    ['owner:b1:14', 'owner:b2:3']
  );
  assert.equal(res.allProfiles.length, 4);
  assert.equal(res.isSuspendedStaff, false);
});

test('2. Safe Offboarding: suspended org staff loses KK profile but keeps personal Owner apartment profiles', () => {
  const suspendedOrgs = [
    {
      ...organizations[0],
      members: [{ ...organizations[0].members[0], active: false }],
    },
  ];
  const res = resolveUserProfiles(
    { email: 'janos@example.com', name: 'Kovács János' },
    { buildings, organizations: suspendedOrgs, users: [{ email: 'janos@example.com', role: 'admin' }] }
  );

  assert.equal(res.isSuspendedStaff, true);
  assert.equal(res.kkProfile, null);
  assert.equal(res.ownerProfiles.length, 2);
  assert.equal(res.allProfiles.some((p) => p.type === 'kk'), false);
});

test('3. Profile-scoped notifications isolate KK vs. Owner notices and drive cross-profile red dots', () => {
  const { allProfiles } = resolveUserProfiles(
    { email: 'janos@example.com' },
    { buildings, organizations, users: [] }
  );

  // 1) SZVB granted on b1 flat 14 -> belongs strictly to owner:b1:14
  const szvbNotifs = buildSzvbUpdateNotifications({
    prevSzvb: null,
    nextSzvb: buildings[0].szvb,
    building: buildings[0],
    actorUser: { name: 'Főnök', email: 'owner@example.com' },
  });

  // 2) Team permission update -> belongs strictly to kk
  const teamNotif = buildTeamUpdateNotification({
    actorUser: { name: 'Főnök', email: 'owner@example.com' },
    targetEmail: 'janos@example.com',
    changes: [{ type: 'granted', labelHu: 'Jog', labelEn: 'Perm' }],
  });

  // 3) Flat dunning notice on b2 flat 3 -> belongs strictly to owner:b2:3
  const dunningNotif = buildNotification({
    type: 'finance',
    severity: 'warning',
    recipientEmail: 'janos@example.com',
    recipientScope: 'flat',
    buildingId: 'b2',
    buildingName: 'Batyu u. 21.',
    flatNum: '3',
    targetProfile: { type: 'owner', buildingId: 'b2', flatNum: '3' },
    titleHu: 'Hátralék értesítő',
    titleEn: 'Arrears Notice',
  });

  const allNotifs = [...szvbNotifs, teamNotif, dunningNotif];

  // Active in KK profile:
  const kkUser = { email: 'janos@example.com', role: 'admin' };
  const kkInbox = getNotificationsForActiveProfile(allNotifs, kkUser, allProfiles);
  assert.equal(kkInbox.length, 1);
  assert.equal(kkInbox[0].type, 'team_updated');

  // Cross-profile unread counts while in KK profile:
  const kkCounts = getUnreadNotificationCountsByProfile(allNotifs, kkUser, allProfiles);
  assert.equal(kkCounts.activeProfileUnread, 1);
  assert.equal(kkCounts.hasOtherProfilesUnread, true);
  assert.equal(kkCounts.otherProfilesUnreadCount, 2); // szvb on b1:14 + dunning on b2:3
  assert.equal(kkCounts.unreadByProfile['kk'], 1);
  assert.equal(kkCounts.unreadByProfile['owner:b1:14'], 1);
  assert.equal(kkCounts.unreadByProfile['owner:b2:3'], 1);

  // Active in Owner b1:14 profile:
  const ownerB1User = { email: 'janos@example.com', role: 'Owner', buildingId: 'b1', flatNum: '14' };
  assert.equal(getActiveProfileKey(ownerB1User), 'owner:b1:14');
  const ownerB1Inbox = getNotificationsForActiveProfile(allNotifs, ownerB1User, allProfiles);
  assert.equal(ownerB1Inbox.length, 1);
  assert.equal(ownerB1Inbox[0].type, 'szvb_updated');
});

test('4. Bank account change notification stays strictly in KK profile', () => {
  const { allProfiles } = resolveUserProfiles(
    { email: 'janos@example.com' },
    { buildings, organizations, users: [] }
  );

  const bankNotif = buildBankChangeNotification({
    actorUser: { name: 'Kolléga', email: 'staff@example.com' },
    ownerEmail: 'janos@example.com',
    building: buildings[0],
    changes: [{ accountLabelHu: 'KK', accountLabelEn: 'KK', oldAccount: '111', newAccount: '222' }],
  });

  const kkUser = { email: 'janos@example.com', role: 'admin' };
  const ownerUser = { email: 'janos@example.com', role: 'Owner', buildingId: 'b1', flatNum: '14' };

  assert.equal(getNotificationsForActiveProfile([bankNotif], kkUser, allProfiles).length, 1);
  assert.equal(getNotificationsForActiveProfile([bankNotif], ownerUser, allProfiles).length, 0);
});

test('5. resolveInitialLoginProfile restores last valid profile or defaults to KK -> Owner -> SZVB', () => {
  const { allProfiles } = resolveUserProfiles(
    { email: 'janos@example.com' },
    { buildings, organizations, users: [] }
  );

  // No saved profile -> defaults to KK first
  assert.equal(resolveInitialLoginProfile(allProfiles, null).id, 'kk');

  // Saved valid owner profile -> restores it directly
  assert.equal(resolveInitialLoginProfile(allProfiles, { id: 'owner:b2:3' }).id, 'owner:b2:3');

  // Saved stale/revoked profile -> safely falls back to KK
  assert.equal(resolveInitialLoginProfile(allProfiles, { id: 'owner:deleted:99' }).id, 'kk');
});

test('6. Multi-profile active-role isolation: same email in SZVB or Owner mode NEVER inherits KK write permissions', () => {
  const ownerOrgs = [
    {
      id: 'org-owner-1',
      name: 'Tulaj Kft.',
      ownerEmail: 'janos@example.com',
      members: [
        {
          id: 'm-owner',
          name: 'Kovács János',
          email: 'janos@example.com',
          orgRole: 'owner',
          active: true,
          buildingScope: 'all',
        },
      ],
    },
  ];
  const kkActiveUser = { email: 'janos@example.com', role: 'admin', buildingId: 'b1' };
  const szvbActiveUser = { email: 'janos@example.com', role: 'szvb', buildingId: 'b1', flatNum: '14' };
  const ownerActiveUser = { email: 'janos@example.com', role: 'Owner', buildingId: 'b1', flatNum: '14' };

  // In KK profile (org owner & staff) -> has KK write permissions
  assert.equal(resolveUserOrgContext(kkActiveUser, ownerOrgs, buildings).isOwner, true);
  assert.equal(canUserManageBuilding(kkActiveUser, buildings[0], ownerOrgs, buildings), true);
  assert.equal(canUserEditBankAccountNumbers(kkActiveUser, buildings[0], ownerOrgs, buildings), true);
  assert.equal(canUserCreateBuilding(kkActiveUser, ownerOrgs, buildings), true);
  assert.equal(canUserDeleteBuilding(kkActiveUser, buildings[0], ownerOrgs, buildings), true);
  assert.equal(canUserManageTeam(kkActiveUser, ownerOrgs, buildings), true);
  assert.equal(canUserManageBuilding(kkActiveUser, buildings[0], organizations, buildings), true);

  // In SZVB profile -> strictly read-only (ZERO admin/KK write permissions even for org owner or staff email!)
  for (const orgSet of [ownerOrgs, organizations]) {
    const szvbCtx = resolveUserOrgContext(szvbActiveUser, orgSet, buildings);
    assert.equal(szvbCtx.isOwner, false);
    assert.equal(szvbCtx.isStaff, false);
    assert.equal(szvbCtx.isAdminRole, false);
    assert.equal(canUserManageBuilding(szvbActiveUser, buildings[0], orgSet, buildings), false);
    assert.equal(canUserManageBuilding(szvbActiveUser, 'b1', orgSet, buildings), false);
    assert.equal(canUserEditBankAccountNumbers(szvbActiveUser, buildings[0], orgSet, buildings), false);
    assert.equal(canUserCreateBuilding(szvbActiveUser, orgSet, buildings), false);
    assert.equal(canUserDeleteBuilding(szvbActiveUser, buildings[0], orgSet, buildings), false);
    assert.equal(canUserManageTeam(szvbActiveUser, orgSet, buildings), false);
  }

  // In Owner profile -> strictly resident-only (ZERO admin/KK write permissions)
  const ownerCtx = resolveUserOrgContext(ownerActiveUser, ownerOrgs, buildings);
  assert.equal(ownerCtx.isOwner, false);
  assert.equal(ownerCtx.isAdminRole, false);
  assert.equal(canUserManageBuilding(ownerActiveUser, buildings[0], ownerOrgs, buildings), false);
  assert.equal(canUserEditBankAccountNumbers(ownerActiveUser, buildings[0], ownerOrgs, buildings), false);
});
