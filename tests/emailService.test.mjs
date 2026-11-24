import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sendTransactionalEmail,
  resolveEffectiveEmailSettings,
  resolveBuildingResidentEmail,
  sendColleagueInviteCustomEmail,
  sendResidentCustomNoticeEmail,
} from '../src/services/emailService.js';

test('1. resolveEffectiveEmailSettings defaults strictly to Resend provider', () => {
  const resolved = resolveEffectiveEmailSettings({});
  assert.equal(resolved.isConfigured, false);
  assert.equal(resolved.provider, 'resend');
  assert.equal(resolved.apiKey, '');
  assert.equal(resolved.senderName, 'HazApp');
});

test('2. resolveBuildingResidentEmail dynamically extracts building resident contact email', () => {
  const sampleOrg = {
    id: 'org-1',
    centralContact: {
      name: 'Alfa Kft.',
      email: 'kozpont@alfa.hu',
    },
  };

  // Case A: Building with personal manager contact
  const buildingWithManager = {
    id: 'b-1',
    organizationId: 'org-1',
    contactDisplayMode: 'manager',
    managerContact: {
      name: 'Kovács Gábor',
      email: 'Gabor.Kezelo@Alfa.hu',
    },
  };
  const emailA = resolveBuildingResidentEmail(buildingWithManager, {}, [sampleOrg]);
  assert.equal(emailA, 'gabor.kezelo@alfa.hu');

  // Case B: Building with central company contact mode
  const buildingWithCompany = {
    id: 'b-2',
    organizationId: 'org-1',
    contactDisplayMode: 'company',
  };
  const emailB = resolveBuildingResidentEmail(buildingWithCompany, {}, [sampleOrg]);
  assert.equal(emailB, 'kozpont@alfa.hu');

  // Case C: Missing building
  assert.equal(resolveBuildingResidentEmail(null), '');
});

test('3. sendTransactionalEmail validates recipient and API key', async () => {
  // Invalid recipient
  const res1 = await sendTransactionalEmail({
    to: 'invalid-email',
    apiKey: 're_123456789',
  });
  assert.equal(res1.success, false);
  assert.equal(res1.error, 'invalid-recipient');

  // Missing API key
  const res2 = await sendTransactionalEmail({
    to: 'valid@example.com',
    apiKey: '',
  });
  assert.equal(res2.success, false);
  assert.equal(res2.error, 'missing-api-key');
});

test('4. sendColleagueInviteCustomEmail automatically sets reply_to to building manager contact', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = null;
  let capturedHeaders = null;
  let capturedBody = null;

  try {
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'resend-msg-999' }),
      };
    };

    const targetBuilding = {
      id: 'b-petofi',
      name: 'Petőfi u. 12.',
      contactDisplayMode: 'manager',
      managerContact: {
        name: 'Varga Tamás',
        email: 'varga.tamas@gmail.com',
      },
    };

    const res = await sendColleagueInviteCustomEmail({
      recipientName: 'Kovács Anna',
      recipientEmail: 'anna@alfa.hu',
      orgName: 'Alfa Ház Kft.',
      inviterName: 'Kovács Béla',
      inviterEmail: 'bela@alfa.hu',
      targetBuilding,
      emailSettings: { apiKey: 're_mock_key_123' },
    });

    assert.equal(res.success, true);
    assert.equal(res.messageId, 'resend-msg-999');
    assert.equal(capturedUrl, 'https://api.resend.com/emails');
    assert.equal(capturedHeaders.Authorization, 'Bearer re_mock_key_123');
    // Reply-To matches the condominium's active resident contact email automatically!
    assert.equal(capturedBody.reply_to, 'varga.tamas@gmail.com');
    assert.deepEqual(capturedBody.to, ['anna@alfa.hu']);
    assert.match(capturedBody.subject, /TarsasApp meghívó/);
    assert.match(capturedBody.html, /Jelszó beállítása és fiók aktiválása/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('5. sendColleagueInviteCustomEmail falls back to inviterEmail if no building contact', async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody = null;

  try {
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'resend-msg-fallback' }),
      };
    };

    await sendColleagueInviteCustomEmail({
      recipientEmail: 'uj.kollega@alfa.hu',
      inviterEmail: 'fonok@alfa.hu',
      targetBuilding: null,
      emailSettings: { apiKey: 're_mock_key_123' },
    });

    assert.equal(capturedBody.reply_to, 'fonok@alfa.hu');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('6. sendResidentCustomNoticeEmail builds branded HTML, dynamic reply_to and sends via Resend', async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody = null;

  try {
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'resend-custom-notice-123' }),
      };
    };

    const targetBuilding = {
      id: 'b-batyu',
      name: 'Batyu u. 21.',
      email: 'kk@batyu21.hu',
    };

    const result = await sendResidentCustomNoticeEmail({
      recipientEmail: 'lako12@batyu.hu',
      recipientName: 'Kovács János',
      flatNum: '12',
      targetBuilding,
      senderUser: { email: 'manager@kezelo.hu' },
      subject: 'Fontos felújítási tájékoztató',
      bodyText: 'Tisztelt Kovács János!\n\nA jövő héten liftjavítás lesz.',
      category: 'general',
      includeGreeting: true,
      emailSettings: { apiKey: 're_valid_api_key_test' },
    });

    assert.equal(result.success, true);
    assert.equal(result.messageId, 'resend-custom-notice-123');
    assert.deepEqual(capturedBody.to, ['lako12@batyu.hu']);
    assert.equal(capturedBody.subject, 'Fontos felújítási tájékoztató');
    assert.equal(capturedBody.reply_to, 'kk@batyu21.hu');
    assert.ok(capturedBody.html.includes('kk@batyu21.hu'));
    assert.ok(!capturedBody.html.includes('<strong>Batyu u. 21.</strong>'));
    assert.ok(capturedBody.html.includes('Kovács János'));
    assert.ok(capturedBody.html.includes('12. lakás'));
    assert.ok(capturedBody.html.includes('liftjavítás'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

