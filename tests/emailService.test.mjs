import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sendTransactionalEmail,
  resolveEffectiveEmailSettings,
  sendColleagueInviteCustomEmail,
} from '../src/services/emailService.js';

test('1. resolveEffectiveEmailSettings returns defaults when empty', () => {
  const resolved = resolveEffectiveEmailSettings({});
  assert.equal(resolved.isConfigured, false);
  assert.equal(resolved.provider, 'resend');
  assert.equal(resolved.apiKey, '');
  assert.equal(resolved.replyTo, '');
  assert.equal(resolved.senderName, 'TarsasApp');
});

test('2. resolveEffectiveEmailSettings picks explicit settings', () => {
  const resolved = resolveEffectiveEmailSettings({
    provider: 'brevo',
    apiKey: 'xkeysib-test-12345',
    replyTo: 'kk.bela@gmail.com',
    senderName: 'Alfa Ház Kft.',
    senderEmail: 'ertesito@alfa.hu',
  });
  assert.equal(resolved.isConfigured, true);
  assert.equal(resolved.provider, 'brevo');
  assert.equal(resolved.apiKey, 'xkeysib-test-12345');
  assert.equal(resolved.replyTo, 'kk.bela@gmail.com');
  assert.equal(resolved.senderName, 'Alfa Ház Kft.');
  assert.equal(resolved.senderEmail, 'ertesito@alfa.hu');
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

test('4. sendColleagueInviteCustomEmail skips when not configured', async () => {
  const res = await sendColleagueInviteCustomEmail({
    recipientName: 'Kovács Anna',
    recipientEmail: 'anna@example.com',
    emailSettings: {},
  });
  assert.equal(res.success, false);
  assert.equal(res.skipped, true);
  assert.equal(res.error, 'not-configured');
});

test('5. Resend and Brevo payloads include custom replyTo address', async () => {
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
        json: async () => ({ id: 'resend-msg-123' }),
      };
    };

    // Test Resend with custom replyTo
    const resendRes = await sendTransactionalEmail({
      to: 'kollega@alfa.hu',
      subject: 'Teszt meghívó',
      html: '<b>Hello</b>',
      text: 'Hello',
      replyTo: 'kk.personal@gmail.com',
      provider: 'resend',
      apiKey: 're_test_key_abc',
    });

    assert.equal(resendRes.success, true);
    assert.equal(resendRes.messageId, 'resend-msg-123');
    assert.equal(capturedUrl, 'https://api.resend.com/emails');
    assert.equal(capturedHeaders.Authorization, 'Bearer re_test_key_abc');
    assert.equal(capturedBody.reply_to, 'kk.personal@gmail.com');
    assert.deepEqual(capturedBody.to, ['kollega@alfa.hu']);

    // Test Brevo with custom replyTo
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        json: async () => ({ messageId: 'brevo-msg-456' }),
      };
    };

    const brevoRes = await sendTransactionalEmail({
      to: 'kollega@alfa.hu',
      subject: 'Teszt meghívó Brevo',
      html: '<b>Hello Brevo</b>',
      text: 'Hello Brevo',
      replyTo: 'kk.personal@gmail.com',
      provider: 'brevo',
      apiKey: 'xkeysib_test_key_123',
    });

    assert.equal(brevoRes.success, true);
    assert.equal(brevoRes.messageId, 'brevo-msg-456');
    assert.equal(capturedUrl, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(capturedHeaders['api-key'], 'xkeysib_test_key_123');
    assert.deepEqual(capturedBody.replyTo, { email: 'kk.personal@gmail.com' });
    assert.deepEqual(capturedBody.to, [{ email: 'kollega@alfa.hu' }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
