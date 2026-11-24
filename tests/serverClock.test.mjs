import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BUDAPEST_TIMEZONE,
  setServerTimeOffset,
  resetServerClock,
  getServerTimeOffset,
  isServerClockSynced,
  getServerClockStatus,
  bindFirebaseServerTimeOffset,
  getServerNowMs,
  getServerNow,
  getServerIsoString,
  getBudapestNowParts,
  getBudapestTodayYMD,
  getBudapestCalendarDate,
} from '../src/utils/serverClock.js';
import { getBudapestTimeParts, shouldRuleAutoDispatchToday } from '../src/utils/dunningRules.js';

test('1. Server clock defaults to local time when unsynced and applies Firebase offset accurately', () => {
  resetServerClock();
  assert.equal(isServerClockSynced(), false);
  assert.equal(getServerTimeOffset(), 0);
  assert.equal(getServerClockStatus().timeZone, BUDAPEST_TIMEZONE);

  // Simulate client computer clock being 2 hours behind Google NTP server (+7,200,000 ms)
  const twoHoursMs = 2 * 60 * 60 * 1000;
  setServerTimeOffset(twoHoursMs);
  assert.equal(isServerClockSynced(), true);
  assert.equal(getServerTimeOffset(), twoHoursMs);

  const localNow = Date.now();
  const serverNow = getServerNowMs();
  const delta = serverNow - localNow;
  assert.ok(Math.abs(delta - twoHoursMs) < 100, `Expected ~2h delta, got ${delta}ms`);

  // ISO string reflects shifted server time
  const isoDate = new Date(getServerIsoString());
  assert.ok(Math.abs(isoDate.getTime() - (Date.now() + twoHoursMs)) < 100);

  // Invalid offsets are ignored safely
  setServerTimeOffset(NaN);
  assert.equal(getServerTimeOffset(), twoHoursMs);
  setServerTimeOffset(Infinity);
  assert.equal(getServerTimeOffset(), twoHoursMs);

  resetServerClock();
});

test('2. bindFirebaseServerTimeOffset subscribes to .info/serverTimeOffset and updates offset reactively', () => {
  resetServerClock();
  let capturedPath = null;
  let capturedCb = null;
  let unsubscribed = false;

  const mockRtdb = { app: 'mock' };
  const mockRef = (_db, path) => {
    capturedPath = path;
    return { path };
  };
  const mockOnValue = (_ref, cb) => {
    capturedCb = cb;
    return () => {
      unsubscribed = true;
    };
  };

  const unsub = bindFirebaseServerTimeOffset(mockRtdb, mockRef, mockOnValue);
  assert.equal(capturedPath, '.info/serverTimeOffset');
  assert.equal(typeof capturedCb, 'function');

  // Firebase emits -15 minutes drift (-900,000 ms)
  capturedCb({ val: () => -900000 });
  assert.equal(isServerClockSynced(), true);
  assert.equal(getServerTimeOffset(), -900000);

  unsub();
  assert.equal(unsubscribed, true);
  resetServerClock();
});

test('3. Europe/Budapest timezone conversion handles CET (winter), CEST (summer), and midnight accurately', () => {
  resetServerClock();

  // Winter CET (UTC+1): 2026-01-15T23:30:00Z -> 2026-01-16 00:30 in Budapest
  const winterUtc = new Date('2026-01-15T23:30:00.000Z');
  const winterParts = getBudapestNowParts(winterUtc);
  assert.equal(winterParts.dateStr, '2026-01-16');
  assert.equal(winterParts.hour, 0);
  assert.equal(winterParts.minute, 30);
  assert.equal(winterParts.timeStr, '00:30');
  assert.equal(getBudapestTodayYMD(winterUtc), '2026-01-16');

  const winterCal = getBudapestCalendarDate(winterUtc);
  assert.equal(winterCal.getFullYear(), 2026);
  assert.equal(winterCal.getMonth(), 0); // January
  assert.equal(winterCal.getDate(), 16);

  // Summer CEST (UTC+2): 2026-07-15T06:00:00Z -> 2026-07-15 08:00 in Budapest
  const summerUtc = new Date('2026-07-15T06:00:00.000Z');
  const summerParts = getBudapestNowParts(summerUtc);
  assert.equal(summerParts.dateStr, '2026-07-15');
  assert.equal(summerParts.hour, 8);
  assert.equal(summerParts.minute, 0);
  assert.equal(summerParts.timeStr, '08:00');
});

test('4. Dunning scheduler uses server clock offset when client clock is drifted', () => {
  resetServerClock();

  // Pick a target instant: 2026-05-15 08:30 Budapest (UTC+2 -> 06:30Z)
  const targetServerMs = new Date('2026-05-15T06:30:00.000Z').getTime();
  const offsetToTarget = targetServerMs - Date.now();
  setServerTimeOffset(offsetToTarget);

  // Without passing explicit date, getBudapestTimeParts uses server clock!
  const parts = getBudapestTimeParts();
  assert.equal(parts.dateStr, '2026-05-15');
  assert.equal(parts.day, 15);
  assert.equal(parts.hour, 8);
  assert.equal(parts.minute, 30);

  // Rule scheduled for day 15 at 08:00 should be due automatically
  const ruleDue = {
    id: 'rule-server-clock-test',
    enabled: true,
    checkDayOfMonth: 15,
    dispatchTime: '08:00',
    lastAutoDispatchedDate: null,
  };
  assert.equal(shouldRuleAutoDispatchToday(ruleDue), true);

  // Rule scheduled for day 15 at 09:00 must NOT fire yet at 08:30 Budapest server time
  const ruleLater = {
    id: 'rule-server-clock-later',
    enabled: true,
    checkDayOfMonth: 15,
    dispatchTime: '09:00',
    lastAutoDispatchedDate: null,
  };
  assert.equal(shouldRuleAutoDispatchToday(ruleLater), false);

  resetServerClock();
});
