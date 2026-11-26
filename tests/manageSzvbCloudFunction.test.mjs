import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeSzvbPayload,
  computeSzvbMembershipPlan,
} from '../functions/src/szvbCore.js';

const sampleUnits = [
  {
    id: 'u-1',
    unitCode: '1',
    ownerUids: ['uid-1'],
    owners: [{ name: 'Kovács János', email: 'janos@example.com', isBoardMember: false }],
  },
  {
    id: 'u-2',
    unitCode: '2',
    ownerUids: ['uid-2'],
    owners: [{ name: 'Nagy Éva', email: 'eva@example.com', isBoardMember: false }],
  },
  {
    id: 'u-3',
    unitCode: '3',
    ownerUids: ['uid-3'],
    owners: [{ name: 'Szabó Péter', email: 'peter@example.com', isBoardMember: false }],
  },
  {
    id: 'u-4',
    unitCode: '4',
    ownerUids: ['uid-admin'],
    owners: [{ name: 'Admin Tulaj', email: 'admin@example.com', isBoardMember: false }],
  },
];

const actor = { uid: 'uid-admin', email: 'admin@example.com', role: 'admin', name: 'Közös Képviselő' };

test('1. sanitizeSzvbPayload deduplicates chairperson out of members and removes duplicate emails', () => {
  const clean = sanitizeSzvbPayload({
    chairperson: { name: 'Kovács János', email: ' JANOS@example.com ', flatNum: '1' },
    members: [
      { name: 'Kovács János', email: 'janos@example.com', flatNum: '1' },
      { name: 'Nagy Éva', email: 'eva@example.com', flatNum: '2' },
      { name: 'Nagy Éva Dup', email: 'EVA@example.com', flatNum: '2' },
    ],
  });

  assert.equal(clean.chairperson.email, 'janos@example.com');
  assert.equal(clean.members.length, 1);
  assert.equal(clean.members[0].email, 'eva@example.com');
});

test('2. Appointing 1 chairperson + 2 members atomically promotes members/{uid} to role=szvb, preserves unitIds, syncs units & builds 3 bilingual notifications', () => {
  const existingMembersByUid = new Map([
    ['uid-1', { uid: 'uid-1', email: 'janos@example.com', role: 'owner', unitIds: ['u-1'], active: true }],
    ['uid-2', { uid: 'uid-2', email: 'eva@example.com', role: 'owner', unitIds: ['u-2'], active: true }],
    ['uid-3', { uid: 'uid-3', email: 'peter@example.com', role: 'owner', unitIds: ['u-3'], active: true }],
  ]);
  const resolvedUidByEmail = new Map([
    ['janos@example.com', 'uid-1'],
    ['eva@example.com', 'uid-2'],
    ['peter@example.com', 'uid-3'],
  ]);

  const plan = computeSzvbMembershipPlan({
    buildingId: 'b-1',
    buildingName: 'Kossuth u. 4.',
    prevSzvb: null,
    nextSzvbRaw: {
      chairperson: { name: 'Kovács János', email: 'janos@example.com', flatNum: '1' },
      members: [
        { name: 'Nagy Éva', email: 'eva@example.com', flatNum: '2' },
        { name: 'Szabó Péter', email: 'peter@example.com', flatNum: '3' },
      ],
    },
    existingMembersByUid,
    resolvedUidByEmail,
    units: sampleUnits,
    actor,
  });

  assert.deepEqual(plan.promotedUids.sort(), ['uid-1', 'uid-2', 'uid-3']);
  assert.equal(plan.revokedUids.length, 0);
  assert.equal(plan.memberWrites.length, 3);

  const chairWrite = plan.memberWrites.find((w) => w.uid === 'uid-1');
  assert.equal(chairWrite.memberDoc.role, 'szvb');
  assert.equal(chairWrite.memberDoc.szvbRole, 'chairperson');
  assert.deepEqual(chairWrite.memberDoc.unitIds, ['u-1']);
  assert.equal(chairWrite.userMembershipPatch.role, 'szvb');

  const memberWrite = plan.memberWrites.find((w) => w.uid === 'uid-2');
  assert.equal(memberWrite.memberDoc.role, 'szvb');
  assert.equal(memberWrite.memberDoc.szvbRole, 'member');
  assert.deepEqual(memberWrite.memberDoc.unitIds, ['u-2']);

  // All 3 units synchronized
  assert.equal(plan.unitUpdates.length, 3);
  const u1 = plan.unitUpdates.find((u) => u.unitId === 'u-1');
  assert.equal(u1.owners[0].isBoardMember, true);
  assert.equal(u1.owners[0].boardRole, 'chairperson');

  // 3 rich bilingual notifications with switching guide & read-only scope
  assert.equal(plan.notificationsToSend.length, 3);
  const chairNotif = plan.notificationsToSend.find((n) => n.uid === 'uid-1').notification;
  assert.equal(chairNotif.type, 'szvb_updated');
  assert.equal(chairNotif.meta.szvbAction, 'granted');
  assert.match(chairNotif.messageHu, /Lakás \/ SZVB/);
  assert.match(chairNotif.messageEn, /Flat \/ SZVB/);
});

test('3. Revoking an SZVB member atomically downgrades back to owner (active if owns unit, inactive if 0 units) and restores GDPR isolation', () => {
  const existingMembersByUid = new Map([
    ['uid-1', { uid: 'uid-1', email: 'janos@example.com', role: 'szvb', szvbRole: 'chairperson', unitIds: ['u-1'], active: true }],
    ['uid-ext', { uid: 'uid-ext', email: 'ext@example.com', role: 'szvb', szvbRole: 'member', unitIds: [], active: true }],
  ]);
  const resolvedUidByEmail = new Map([
    ['janos@example.com', 'uid-1'],
    ['ext@example.com', 'uid-ext'],
  ]);

  const plan = computeSzvbMembershipPlan({
    buildingId: 'b-1',
    buildingName: 'Kossuth u. 4.',
    prevSzvb: {
      chairperson: { name: 'Kovács János', email: 'janos@example.com', flatNum: '1' },
      members: [{ name: 'Külsős', email: 'ext@example.com', flatNum: '' }],
    },
    nextSzvbRaw: { chairperson: null, members: [] },
    existingMembersByUid,
    resolvedUidByEmail,
    units: sampleUnits,
    actor,
  });

  assert.deepEqual(plan.revokedUids.sort(), ['uid-1', 'uid-ext']);

  // Owner with flat downgraded to active 'owner' keeping unitIds=['u-1']
  const w1 = plan.memberWrites.find((w) => w.uid === 'uid-1');
  assert.equal(w1.memberDoc.role, 'owner');
  assert.equal(w1.memberDoc.szvbRole, null);
  assert.equal(w1.memberDoc.active, true);
  assert.deepEqual(w1.memberDoc.unitIds, ['u-1']);

  // Member without owned units deactivated
  const wExt = plan.memberWrites.find((w) => w.uid === 'uid-ext');
  assert.equal(wExt.memberDoc.role, 'owner');
  assert.equal(wExt.memberDoc.active, false);

  // Revocation notifications generated for both
  assert.equal(plan.notificationsToSend.length, 2);
  assert.equal(plan.notificationsToSend[0].notification.meta.szvbAction, 'revoked');
  assert.match(plan.notificationsToSend[0].notification.titleHu, /visszavonva/i);
});

test('4. Existing building admin is NEVER downgraded when added to or removed from SZVB', () => {
  const existingMembersByUid = new Map([
    ['uid-admin', { uid: 'uid-admin', email: 'admin@example.com', role: 'admin', unitIds: ['u-4'], active: true }],
  ]);
  const resolvedUidByEmail = new Map([['admin@example.com', 'uid-admin']]);

  // Appoint admin as SZVB chairperson -> role stays 'admin'!
  const grantPlan = computeSzvbMembershipPlan({
    buildingId: 'b-1',
    buildingName: 'Kossuth u. 4.',
    prevSzvb: null,
    nextSzvbRaw: {
      chairperson: { name: 'Admin Tulaj', email: 'admin@example.com', flatNum: '4' },
      members: [],
    },
    existingMembersByUid,
    resolvedUidByEmail,
    units: sampleUnits,
    actor,
  });
  const grantWrite = grantPlan.memberWrites.find((w) => w.uid === 'uid-admin');
  assert.equal(grantWrite.memberDoc.role, 'admin');
  assert.equal(grantWrite.memberDoc.szvbRole, 'chairperson');

  // Remove admin from SZVB -> role STILL stays 'admin'!
  const revokePlan = computeSzvbMembershipPlan({
    buildingId: 'b-1',
    buildingName: 'Kossuth u. 4.',
    prevSzvb: {
      chairperson: { name: 'Admin Tulaj', email: 'admin@example.com', flatNum: '4' },
      members: [],
    },
    nextSzvbRaw: { chairperson: null, members: [] },
    existingMembersByUid: new Map([
      ['uid-admin', { uid: 'uid-admin', email: 'admin@example.com', role: 'admin', szvbRole: 'chairperson', unitIds: ['u-4'], active: true }],
    ]),
    resolvedUidByEmail,
    units: sampleUnits,
    actor,
  });
  const revokeWrite = revokePlan.memberWrites.find((w) => w.uid === 'uid-admin');
  assert.equal(revokeWrite.memberDoc.role, 'admin');
  assert.equal(revokeWrite.memberDoc.szvbRole, null);
});

test('5. Role change (member -> chairperson) updates szvbRole and handles unresolved emails cleanly', () => {
  const existingMembersByUid = new Map([
    ['uid-2', { uid: 'uid-2', email: 'eva@example.com', role: 'szvb', szvbRole: 'member', unitIds: ['u-2'], active: true }],
  ]);
  const resolvedUidByEmail = new Map([['eva@example.com', 'uid-2']]); // 'noauth@example.com' has no Auth account yet

  const plan = computeSzvbMembershipPlan({
    buildingId: 'b-1',
    buildingName: 'Kossuth u. 4.',
    prevSzvb: {
      chairperson: null,
      members: [{ name: 'Nagy Éva', email: 'eva@example.com', flatNum: '2' }],
    },
    nextSzvbRaw: {
      chairperson: { name: 'Nagy Éva', email: 'eva@example.com', flatNum: '2' },
      members: [{ name: 'Nincs Fiókja', email: 'noauth@example.com', flatNum: '9' }],
    },
    existingMembersByUid,
    resolvedUidByEmail,
    units: sampleUnits,
    actor,
  });

  assert.deepEqual(plan.modifiedUids, ['uid-2']);
  assert.deepEqual(plan.unresolvedEmails, ['noauth@example.com']);
  assert.equal(plan.notificationsToSend.length, 1);
  assert.equal(plan.notificationsToSend[0].notification.meta.szvbAction, 'modified');
  assert.match(plan.notificationsToSend[0].notification.messageHu, /SZVB Tag → SZVB Elnök/);
});
