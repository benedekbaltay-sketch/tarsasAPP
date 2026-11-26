import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeEconomicAuditor,
  isEconomicAuditorActive,
  isUserBuildingEconomicAuditor,
  getUserEconomicAuditorRolesAcrossBuildings,
  calculateBuildingAnnualTurnover,
  evaluateEconomicAuditorCompliance,
  buildEconomicAuditorUpdateNotifications,
  buildAuditActivityNotifications,
} from '../src/utils/economicAuditor.js';
import {
  getBuildingAlerts,
  dismissBuildingAlertInList,
  ALERT_ID_SZVB_STATUTORY_25,
  ALERT_ID_AUDITOR_STATUTORY_50_10M,
} from '../src/utils/buildingAlerts.js';
import {
  resolveUserProfiles,
  getActiveProfileKey,
  resolveInitialLoginProfile,
} from '../src/utils/userProfiles.js';
import {
  resolveUserOrgContext,
  canUserManageBuilding,
  canUserEditBankAccountNumbers,
} from '../src/utils/teamPermissions.js';

function makeBuildingWithFlats(count, overrides = {}) {
  const bId = overrides.id || 'b-51a';
  const flats = [];
  for (let i = 1; i <= count; i += 1) {
    const email = `${bId}-owner${i}@example.com`;
    flats.push({
      flatNum: String(i),
      hrsz: `1000/1/A/${i}`,
      unitType: i % 5 === 0 ? 'garage' : 'flat',
      ownerName: `Tulajdonos ${i}`,
      email,
      owners: [{ name: `Tulajdonos ${i}`, email }],
    });
  }
  return {
    id: bId,
    name: overrides.name || 'Nagy Társasház',
    flats,
    transactions: [],
    expenses: [],
    szvb: { chairperson: null, members: [] },
    ...overrides,
  };
}

test('1. Tht. 51/A. § compliance triggers over 50 units OR over 10M HUF turnover, and clears on auditor OR qualified SZVB exemption', () => {
  // Small building (12 units, low turnover) -> NOT required
  const smallB = makeBuildingWithFlats(12, {
    transactions: [{ id: 't1', date: '2025-05-01', amount: 2_000_000, status: 'Verified' }],
    expenses: [{ id: 'e1', date: '2025-06-01', amount: 1_500_000 }],
  });
  const smallEval = evaluateEconomicAuditorCompliance(smallB, { nowDateStr: '2026-03-01' });
  assert.equal(smallEval.required, false);
  assert.equal(smallEval.showWarning, false);
  assert.equal(smallEval.annualTurnoverHuf, 3_500_000);

  // Small building (12 units) with >10M HUF turnover -> REQUIRED!
  const highTurnoverB = makeBuildingWithFlats(12, {
    transactions: [{ id: 't1', date: '2025-05-01', amount: 6_500_000, status: 'Verified' }],
    expenses: [{ id: 'e1', date: '2025-06-01', amount: 4_200_000 }],
  });
  const highEval = evaluateEconomicAuditorCompliance(highTurnoverB, { nowDateStr: '2026-03-01' });
  assert.equal(highEval.required, true);
  assert.equal(highEval.triggeredByUnits, false);
  assert.equal(highEval.triggeredByTurnover, true);
  assert.equal(highEval.annualTurnoverHuf, 10_700_000);
  assert.equal(highEval.showWarning, true);

  // Over 50 units (52 units) with 0 turnover -> REQUIRED!
  const largeB = makeBuildingWithFlats(52);
  const largeEval = evaluateEconomicAuditorCompliance(largeB, { nowDateStr: '2026-03-01' });
  assert.equal(largeEval.required, true);
  assert.equal(largeEval.triggeredByUnits, true);
  assert.equal(largeEval.showWarning, true);

  // Qualified SZVB member appointed as Financial Auditor clears warning AND preserves isSzvbMember flag
  const exemptB = makeBuildingWithFlats(52, {
    economicAuditor: sanitizeEconomicAuditor({
      enabled: true,
      type: 'internal',
      name: 'Tulajdonos 1',
      email: 'b-51a-owner1@example.com',
      flatNum: '1',
      isSzvbMember: true,
      exemptQualifiedSzvbMember: true,
    }),
  });
  assert.equal(exemptB.economicAuditor.isSzvbMember, true);
  const exemptEval = evaluateEconomicAuditorCompliance(exemptB, { nowDateStr: '2026-03-01' });
  assert.equal(exemptEval.required, true);
  assert.equal(exemptEval.hasActiveAuditor, true);
  assert.equal(exemptEval.isExemptByQualifiedSzvb, true);
  assert.equal(exemptEval.compliant, true);
  assert.equal(exemptEval.showWarning, false);

  // Active appointed external auditor clears warning
  const appointedB = makeBuildingWithFlats(52, {
    economicAuditor: sanitizeEconomicAuditor({
      enabled: true,
      type: 'external',
      name: 'Dr. Könyvvizsgáló Anna',
      email: 'anna@audit.hu',
      validFrom: '2026-01-01',
      validTo: '2026-12-31',
    }),
  });
  assert.equal(evaluateEconomicAuditorCompliance(appointedB, { nowDateStr: '2026-06-01' }).showWarning, false);
  // Expired engagement re-triggers warning and revokes active status!
  assert.equal(isEconomicAuditorActive(appointedB.economicAuditor, '2027-01-02'), false);
  assert.equal(evaluateEconomicAuditorCompliance(appointedB, { nowDateStr: '2027-01-02' }).showWarning, true);
});

test('2. Extensible buildingAlerts emits BOTH 25-unit SZVB alert and 50-unit/10M Auditor alert (count=2), independently dismissible', () => {
  const largeB = makeBuildingWithFlats(54);
  const kkUser = { email: 'kk@example.com', role: 'admin' };

  const alerts = getBuildingAlerts(largeB, { user: kkUser, organizations: [], buildings: [largeB] });
  assert.equal(alerts.length, 2);
  assert.deepEqual(
    alerts.map((a) => a.id),
    [ALERT_ID_SZVB_STATUTORY_25, ALERT_ID_AUDITOR_STATUTORY_50_10M]
  );

  // Dismiss only the auditor alert -> SZVB alert stays active (count=1)
  const afterDismiss = dismissBuildingAlertInList([largeB], largeB.id, ALERT_ID_AUDITOR_STATUTORY_50_10M);
  const remaining = getBuildingAlerts(afterDismiss[0], { user: kkUser, organizations: [], buildings: afterDismiss });
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, ALERT_ID_SZVB_STATUTORY_25);

  // Non-managing roles (auditor, szvb, Owner) NEVER see KK statutory alerts
  assert.equal(getBuildingAlerts(largeB, { user: { email: 'a@b.hu', role: 'auditor' } }).length, 0);
  assert.equal(getBuildingAlerts(largeB, { user: { email: 'a@b.hu', role: 'szvb' } }).length, 0);
});

test('3. Internal & External Economic Auditor multi-profile resolution and strict active-role isolation', () => {
  const b1 = makeBuildingWithFlats(10, {
    id: 'b1',
    name: 'Kossuth u. 4.',
    economicAuditor: sanitizeEconomicAuditor({
      enabled: true,
      type: 'internal',
      name: 'Tulajdonos 1',
      email: 'b1-owner1@example.com',
      flatNum: '1',
    }),
  });
  const b2 = makeBuildingWithFlats(10, {
    id: 'b2',
    name: 'Batyu u. 21.',
    economicAuditor: sanitizeEconomicAuditor({
      enabled: true,
      type: 'external',
      name: 'Külső Audit Kft.',
      email: 'kulso@audit.hu',
      companyName: 'Audit Pro Kft.',
    }),
  });
  const b3 = makeBuildingWithFlats(10, {
    id: 'b3',
    name: 'Napfény u. 8.',
    economicAuditor: sanitizeEconomicAuditor({
      enabled: true,
      type: 'external',
      name: 'Külső Audit Kft.',
      email: 'kulso@audit.hu',
      companyName: 'Audit Pro Kft.',
    }),
  });

  // Internal owner who is also Economic Auditor -> nested with linkedOwnerProfileId
  const internalProfiles = resolveUserProfiles(
    { email: 'b1-owner1@example.com' },
    { buildings: [b1, b2, b3], organizations: [], users: [] }
  );
  assert.equal(internalProfiles.ownerProfiles.length, 1);
  assert.equal(internalProfiles.auditorProfiles.length, 1);
  assert.equal(internalProfiles.auditorProfiles[0].isInternal, true);
  assert.equal(internalProfiles.auditorProfiles[0].linkedOwnerProfileId, 'owner:b1:1');

  // External auditor overseeing 2 different buildings -> 2 external auditor profiles, 0 owner/kk profiles
  const externalProfiles = resolveUserProfiles(
    { email: 'KULSO@AUDIT.HU' },
    { buildings: [b1, b2, b3], organizations: [], users: [] }
  );
  assert.equal(externalProfiles.kkProfile, null);
  assert.equal(externalProfiles.ownerProfiles.length, 0);
  assert.equal(externalProfiles.auditorProfiles.length, 2);
  assert.equal(externalProfiles.auditorProfiles[0].isInternal, false);
  assert.equal(externalProfiles.auditorProfiles[0].linkedOwnerProfileId, null);
  assert.equal(resolveInitialLoginProfile(externalProfiles.allProfiles, null).id, 'auditor:b2');
  assert.equal(getActiveProfileKey({ role: 'auditor', buildingId: 'b2' }), 'auditor:b2');

  // Strict active-role isolation: even if the same email is KK org owner, active role='auditor' has ZERO KK write access
  const orgs = [
    {
      id: 'org-1',
      name: 'KK Kft.',
      ownerEmail: 'b1-owner1@example.com',
      members: [{ id: 'm1', email: 'b1-owner1@example.com', orgRole: 'owner', active: true, buildingScope: 'all' }],
    },
  ];
  const activeAuditorSession = { email: 'b1-owner1@example.com', role: 'auditor', buildingId: 'b1' };
  assert.equal(resolveUserOrgContext(activeAuditorSession, orgs, [b1]).isOwner, false);
  assert.equal(canUserManageBuilding(activeAuditorSession, b1, orgs, [b1]), false);
  assert.equal(canUserEditBankAccountNumbers(activeAuditorSession, b1, orgs, [b1]), false);
  assert.equal(isUserBuildingEconomicAuditor(activeAuditorSession, b1), true);
  assert.equal(isUserBuildingEconomicAuditor(activeAuditorSession, b2), false);
});

test('4. Bilingual notifications for auditor appointment, revocation, written opinion, and SZVB/KK observations', () => {
  const b1 = makeBuildingWithFlats(5, {
    id: 'b1',
    name: 'Kossuth u. 4.',
    szvb: {
      chairperson: { name: 'SZVB Elnök', email: 'szvb@example.com', flatNum: '2' },
      members: [],
    },
    economicAuditor: sanitizeEconomicAuditor({
      enabled: true,
      type: 'external',
      name: 'Külső Könyvvizsgáló',
      email: 'auditor@example.com',
    }),
  });
  const orgs = [{ id: 'o1', name: 'KK Kft.', ownerEmail: 'kk@example.com', members: [] }];

  // Appointment notification
  const grantNotifs = buildEconomicAuditorUpdateNotifications({
    building: b1,
    prevAuditor: null,
    nextAuditor: b1.economicAuditor,
    actorUser: { name: 'Közös Képviselő', email: 'kk@example.com' },
  });
  assert.equal(grantNotifs.length, 1);
  assert.equal(grantNotifs[0].recipientEmail, 'auditor@example.com');
  assert.equal(grantNotifs[0].targetProfile.type, 'auditor');
  assert.ok(grantNotifs[0].titleHu.includes('Gazdasági ellenőrzést segítő'));
  assert.ok(grantNotifs[0].titleEn.includes('Financial Auditor'));

  // Revocation notification
  const revokeNotifs = buildEconomicAuditorUpdateNotifications({
    building: b1,
    prevAuditor: b1.economicAuditor,
    nextAuditor: sanitizeEconomicAuditor({ enabled: false }),
    actorUser: { name: 'Közös Képviselő', email: 'kk@example.com' },
  });
  assert.equal(revokeNotifs.length, 1);
  assert.equal(revokeNotifs[0].meta.action, 'revoked');

  // Written opinion submitted by auditor -> notifies SZVB (owner profile) AND KK (kk profile)
  const opinionNotifs = buildAuditActivityNotifications({
    kind: 'opinion',
    building: b1,
    actorUser: { name: 'Külső Könyvvizsgáló', email: 'auditor@example.com' },
    item: { id: 'aop-1', year: 2025, title: '2025. évi ellenőri vélemény', fileName: 'velemeny.pdf' },
    organizations: orgs,
  });
  assert.equal(opinionNotifs.length, 2);
  const szvbNotif = opinionNotifs.find((n) => n.recipientEmail === 'szvb@example.com');
  const kkNotif = opinionNotifs.find((n) => n.recipientEmail === 'kk@example.com');
  assert.ok(szvbNotif);
  assert.equal(szvbNotif.targetProfile.type, 'owner');
  assert.equal(szvbNotif.targetProfile.flatNum, '2');
  assert.ok(kkNotif);
  assert.equal(kkNotif.targetProfile.type, 'kk');
});
