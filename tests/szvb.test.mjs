import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeHrsz,
  countBuildingAlbetets,
  getBuildingOwnerCandidates,
  normalizeBuildingSzvb,
  evaluateSzvbCompliance,
  getUserBuildingSzvbInfo,
  isUserBuildingSzvb,
  getUserSzvbRolesAcrossBuildings,
  syncSzvbToBuildingFlats,
  buildSzvbUpdateNotifications,
} from '../src/utils/szvb.js';
import {
  ALERT_ID_SZVB_STATUTORY_25,
  getBuildingAlerts,
  dismissBuildingAlertInList,
  isBuildingAlertDismissed,
} from '../src/utils/buildingAlerts.js';

function makeFlats(count, hrszPrefix = '12345/0/A/') {
  return Array.from({ length: count }, (_, i) => ({
    id: `f-${i + 1}`,
    flatNum: String(i + 1),
    hrsz: hrszPrefix ? `${hrszPrefix}${i + 1}` : '',
    ownerName: `Tulajdonos ${i + 1}`,
    email: `owner${i + 1}@example.com`,
    owners: [
      {
        id: `o-${i + 1}`,
        name: `Tulajdonos ${i + 1}`,
        email: `owner${i + 1}@example.com`,
        isBoardMember: false,
      },
    ],
  }));
}

test('1. normalizeHrsz cleans whitespace and casing consistently', () => {
  assert.equal(normalizeHrsz('  12345 / 0 / A / 12  '), '12345/0/a/12');
  assert.equal(normalizeHrsz(''), '');
  assert.equal(normalizeHrsz(null), '');
});

test('2. countBuildingAlbetets counts distinct HRSZ units and deduplicates shared HRSZ', () => {
  const flats = makeFlats(26, '9876/0/A/');
  // Make unit 26 share the exact same HRSZ as unit 1 -> only 25 distinct albetétek!
  flats[25].hrsz = ' 9876 / 0 / a / 1 ';

  const stats = countBuildingAlbetets({ id: 'b1', flats });
  assert.equal(stats.count, 25);
  assert.equal(stats.distinctHrszCount, 25);
  assert.equal(stats.totalFlatRecords, 26);
  assert.equal(stats.requiresSzvb, false);

  // Give unit 26 its own distinct HRSZ -> 26 distinct albetétek -> triggers statutory rule (> 25)
  flats[25].hrsz = '9876/0/A/26';
  const stats26 = countBuildingAlbetets({ id: 'b1', flats });
  assert.equal(stats26.count, 26);
  assert.equal(stats26.requiresSzvb, true);
});

test('3. countBuildingAlbetets counts separate-HRSZ annexes and falls back cleanly for units without HRSZ', () => {
  const flats = makeFlats(25, ''); // 25 legacy units without HRSZ
  flats[0].annexes = [{ type: 'garage', number: 'G1', hrsz: '1000/0/A/99' }]; // separate parcelled garage -> 26th albetét

  const stats = countBuildingAlbetets({ id: 'b2', flats });
  assert.equal(stats.count, 26);
  assert.equal(stats.unitsWithoutHrszCount, 25);
  assert.equal(stats.distinctHrszCount, 1);
  assert.equal(stats.requiresSzvb, true);
});

test('4. evaluateSzvbCompliance enforces statutory 25+ albetét rule (1 chairperson + at least 2 members)', () => {
  // <= 25 units: no warning even with 0 SZVB members
  const smallBuilding = { id: 'b-small', flats: makeFlats(25) };
  const smallRes = evaluateSzvbCompliance(smallBuilding);
  assert.equal(smallRes.requiresStatutorySzvb, false);
  assert.equal(smallRes.isCompliant, true);
  assert.equal(smallRes.showWarning, false);

  // 26 units with 0 SZVB -> warning
  const largeBuilding = { id: 'b-large', flats: makeFlats(26) };
  assert.equal(evaluateSzvbCompliance(largeBuilding).showWarning, true);

  // 26 units with 1 chairperson + 1 member (only 2 total) -> warning
  largeBuilding.szvb = {
    chairperson: { name: 'Tulajdonos 1', email: 'owner1@example.com', flatNum: '1' },
    members: [{ name: 'Tulajdonos 2', email: 'owner2@example.com', flatNum: '2' }],
  };
  const partialRes = evaluateSzvbCompliance(largeBuilding);
  assert.equal(partialRes.totalSzvbCount, 2);
  assert.equal(partialRes.isCompliant, false);
  assert.equal(partialRes.showWarning, true);

  // 26 units with 3 members but NO chairperson -> warning
  largeBuilding.szvb = {
    chairperson: null,
    members: [
      { name: 'Tulajdonos 1', email: 'owner1@example.com', flatNum: '1' },
      { name: 'Tulajdonos 2', email: 'owner2@example.com', flatNum: '2' },
      { name: 'Tulajdonos 3', email: 'owner3@example.com', flatNum: '3' },
    ],
  };
  const noChairRes = evaluateSzvbCompliance(largeBuilding);
  assert.equal(noChairRes.hasChairperson, false);
  assert.equal(noChairRes.isCompliant, false);
  assert.equal(noChairRes.showWarning, true);

  // 26 units with 1 chairperson + 2 members -> compliant (no warning)
  largeBuilding.szvb = {
    chairperson: { name: 'Tulajdonos 1', email: 'owner1@example.com', flatNum: '1' },
    members: [
      { name: 'Tulajdonos 2', email: 'owner2@example.com', flatNum: '2' },
      { name: 'Tulajdonos 3', email: 'owner3@example.com', flatNum: '3' },
    ],
  };
  const okRes = evaluateSzvbCompliance(largeBuilding);
  assert.equal(okRes.totalSzvbCount, 3);
  assert.equal(okRes.hasChairperson, true);
  assert.equal(okRes.membersCount, 2);
  assert.equal(okRes.isCompliant, true);
  assert.equal(okRes.showWarning, false);
});

test('5. getBuildingOwnerCandidates deduplicates multi-flat owners and prevents chairperson/member duplication', () => {
  const flats = makeFlats(3);
  // Owner 1 owns flat 1 and flat 3
  flats[2].owners = [{ name: 'Tulajdonos 1', email: 'OWNER1@example.com' }];

  const candidates = getBuildingOwnerCandidates({ id: 'b1', flats });
  assert.equal(candidates.length, 2);
  const owner1 = candidates.find((c) => c.email === 'owner1@example.com');
  assert.deepEqual(owner1.flatNums, ['1', '3']);

  // normalizeBuildingSzvb deduplicates chairperson if also listed in members
  const norm = normalizeBuildingSzvb({
    id: 'b1',
    szvb: {
      chairperson: { name: 'Tulajdonos 1', email: 'owner1@example.com', flatNum: '1' },
      members: [
        { name: 'Tulajdonos 1', email: 'OWNER1@example.com', flatNum: '1' },
        { name: 'Tulajdonos 2', email: 'owner2@example.com', flatNum: '2' },
      ],
    },
  });
  assert.equal(norm.chairperson.email, 'owner1@example.com');
  assert.equal(norm.members.length, 1);
  assert.equal(norm.members[0].email, 'owner2@example.com');
});

test('6. Strictly verified SZVB role resolution (zero regular-owner privilege escalation)', () => {
  const building = {
    id: 'b1',
    name: 'Kossuth u. 4.',
    flats: makeFlats(5),
    szvb: {
      chairperson: { name: 'Tulajdonos 1', email: 'owner1@example.com', flatNum: '1' },
      members: [{ name: 'Tulajdonos 2', email: 'owner2@example.com', flatNum: '2' }],
    },
  };
  const archivedBuilding = {
    ...building,
    id: 'b-arch',
    archived: true,
  };

  // Chairperson verified
  const chairInfo = getUserBuildingSzvbInfo({ email: 'OWNER1@example.com' }, building);
  assert.equal(chairInfo?.role, 'chairperson');
  assert.equal(isUserBuildingSzvb({ email: 'owner1@example.com' }, building), true);

  // Member verified
  const memInfo = getUserBuildingSzvbInfo({ email: 'owner2@example.com' }, building);
  assert.equal(memInfo?.role, 'member');

  // Regular owner strictly denied (GDPR isolation)
  assert.equal(isUserBuildingSzvb({ email: 'owner3@example.com' }, building), false);
  // Similar email prefix strictly denied (no prefix matching!)
  assert.equal(isUserBuildingSzvb({ email: 'owner1@other.com' }, building), false);
  assert.equal(isUserBuildingSzvb({ email: 'owner10@example.com' }, building), false);

  // Archived building excluded from active SZVB roles
  const roles = getUserSzvbRolesAcrossBuildings({ email: 'owner1@example.com' }, [building, archivedBuilding]);
  assert.equal(roles.length, 1);
  assert.equal(roles[0].buildingId, 'b1');
  assert.equal(roles[0].szvbRole, 'chairperson');
});

test('7. syncSzvbToBuildingFlats keeps flat owner isBoardMember and boardRole flags in sync', () => {
  const flats = makeFlats(4);
  flats[3].owners[0].isBoardMember = true; // Previously a board member, now removed

  const nextSzvb = {
    chairperson: { name: 'Tulajdonos 1', email: 'owner1@example.com', flatNum: '1' },
    members: [{ name: 'Tulajdonos 2', email: 'owner2@example.com', flatNum: '2' }],
  };

  const synced = syncSzvbToBuildingFlats(flats, nextSzvb);
  assert.equal(synced[0].owners[0].isBoardMember, true);
  assert.equal(synced[0].owners[0].boardRole, 'chairperson');
  assert.equal(synced[1].owners[0].isBoardMember, true);
  assert.equal(synced[1].owners[0].boardRole, 'member');
  assert.equal(synced[2].owners[0].isBoardMember, false);
  assert.equal(synced[2].owners[0].boardRole ?? null, null);
  assert.equal(synced[3].owners[0].isBoardMember, false);
  assert.equal(synced[3].owners[0].boardRole, null);
});

test('8. getBuildingAlerts counts mixed unit types (flats, garages, offices), gates to managing KK, and supports X-dismissal', () => {
  const mixedUnits = [
    ...makeFlats(15, '100/0/A/').map((f) => ({ ...f, unitType: 'flat' })),
    ...makeFlats(6, '100/0/G/').map((f, i) => ({ ...f, id: `g-${i}`, flatNum: `G${i + 1}`, unitType: 'garage' })),
    ...makeFlats(5, '100/0/I/').map((f, i) => ({ ...f, id: `c-${i}`, flatNum: `I${i + 1}`, unitType: 'commercial' })),
  ]; // 15 + 6 + 5 = 26 distinct HRSZ units regardless of type!

  const building = { id: 'b-mixed', name: 'Vegyes Ház', flats: mixedUnits };
  const adminUser = { email: 'kk@example.com', role: 'admin' };
  const residentUser = { email: 'owner1@example.com', role: 'Owner' };
  const szvbUser = { email: 'owner1@example.com', role: 'szvb' };

  // Managing KK sees 1 alert routed to building-settings -> general tab
  const kkAlerts = getBuildingAlerts(building, { user: adminUser, buildings: [building] });
  assert.equal(kkAlerts.length, 1);
  assert.equal(kkAlerts[0].id, ALERT_ID_SZVB_STATUTORY_25);
  assert.equal(kkAlerts[0].targetMenu, 'building-settings');
  assert.equal(kkAlerts[0].targetTab, 'general');
  assert.equal(kkAlerts[0].dismissible, true);

  // Residents and SZVB users NEVER see KK management alerts
  assert.equal(getBuildingAlerts(building, { user: residentUser, buildings: [building] }).length, 0);
  assert.equal(getBuildingAlerts(building, { user: szvbUser, buildings: [building] }).length, 0);

  // Clicking X dismisses the alert cleanly and clears red dot count to 0
  const updatedBuildings = dismissBuildingAlertInList([building], 'b-mixed', ALERT_ID_SZVB_STATUTORY_25);
  assert.equal(isBuildingAlertDismissed(updatedBuildings[0], ALERT_ID_SZVB_STATUTORY_25), true);
  assert.equal(getBuildingAlerts(updatedBuildings[0], { user: adminUser, buildings: updatedBuildings }).length, 0);
});

test('9. buildSzvbUpdateNotifications emits detailed HU/EN grant, role-change, and revoke messages', () => {
  const building = { id: 'b1', name: 'Kossuth u. 4.' };
  const actor = { name: 'Közös Képviselő', email: 'kk@example.com' };

  const prevSzvb = {
    chairperson: { name: 'Elnök Régi', email: 'oldchair@example.com', flatNum: '1' },
    members: [
      { name: 'Tag Marad', email: 'stay@example.com', flatNum: '2' },
      { name: 'Tag Előlép', email: 'promote@example.com', flatNum: '3' },
    ],
  };

  const nextSzvb = {
    chairperson: { name: 'Tag Előlép', email: 'promote@example.com', flatNum: '3' },
    members: [
      { name: 'Tag Marad', email: 'stay@example.com', flatNum: '2' },
      { name: 'Új Tag', email: 'newmember@example.com', flatNum: '4' },
    ],
  };

  const notifs = buildSzvbUpdateNotifications({ prevSzvb, nextSzvb, building, actorUser: actor });
  // stay@example.com unchanged -> no notification; 3 affected users -> 3 notifications
  assert.equal(notifs.length, 3);

  const granted = notifs.find((n) => n.recipientEmail === 'newmember@example.com');
  assert.ok(granted);
  assert.equal(granted.type, 'szvb_updated');
  assert.equal(granted.meta.szvbAction, 'granted');
  assert.match(granted.messageHu, /Profilváltás/);
  assert.doesNotMatch(granted.messageHu, /SZVB Ellenőrző nézet|Váltás saját lakásomra|☰/);
  assert.match(granted.messageHu, /csak olvasás/i);
  assert.match(granted.messageHu, /hátraléklistája/);
  assert.match(granted.messageEn, /Switch Profile/);
  assert.doesNotMatch(granted.messageEn, /SZVB Audit View|Switch to My Apartment|☰/);
  assert.match(granted.messageEn, /Read-Only/i);
  assert.equal(granted.changes.length, 3);

  const promoted = notifs.find((n) => n.recipientEmail === 'promote@example.com');
  assert.ok(promoted);
  assert.equal(promoted.meta.szvbAction, 'modified');
  assert.match(promoted.messageHu, /SZVB Tag → SZVB Elnök/);

  const revoked = notifs.find((n) => n.recipientEmail === 'oldchair@example.com');
  assert.ok(revoked);
  assert.equal(revoked.meta.szvbAction, 'revoked');
  assert.match(revoked.titleHu, /visszavonva/i);
  assert.match(revoked.messageHu, /visszavonásra került/i);
  assert.match(revoked.messageEn, /revoked/i);
  assert.equal(revoked.changes[0].type, 'revoked');
});
