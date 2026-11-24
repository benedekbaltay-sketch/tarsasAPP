/**
 * Authoritative Invisible Server Clock (Europe/Budapest)
 *
 * Syncs with Firebase Realtime Database's `.info/serverTimeOffset` so that
 * scheduled dunning rules, calendar "today" highlights, reminders, and
 * client-side timestamps rely on Google's NTP-synced server clock in the
 * `Europe/Budapest` timezone rather than the user's potentially drifted or
 * foreign-timezone computer clock.
 *
 * Pure JS (zero Firebase SDK import) so it works identically in browser and
 * Node.js unit tests. Falls back gracefully to local system time when offline.
 */

export const BUDAPEST_TIMEZONE = 'Europe/Budapest';

let _serverTimeOffsetMs = 0;
let _isSynced = false;
let _lastSyncedAtMs = 0;

/**
 * Sets the millisecond offset between server time and local client time
 * (serverTimeMs - clientTimeMs), typically from Firebase `.info/serverTimeOffset`.
 */
export function setServerTimeOffset(offsetMs) {
  const num = Number(offsetMs);
  if (!Number.isFinite(num)) return;
  _serverTimeOffsetMs = Math.round(num);
  _isSynced = true;
  _lastSyncedAtMs = Date.now();
}

/**
 * Resets the server clock offset (primarily for unit tests).
 */
export function resetServerClock() {
  _serverTimeOffsetMs = 0;
  _isSynced = false;
  _lastSyncedAtMs = 0;
}

/**
 * Returns the currently applied server-vs-client offset in milliseconds.
 */
export function getServerTimeOffset() {
  return _serverTimeOffsetMs;
}

/**
 * Returns true if `.info/serverTimeOffset` has synchronized at least once.
 */
export function isServerClockSynced() {
  return _isSynced;
}

/**
 * Returns metadata about the last synchronization.
 */
export function getServerClockStatus() {
  return {
    offsetMs: _serverTimeOffsetMs,
    isSynced: _isSynced,
    lastSyncedAtMs: _lastSyncedAtMs,
    timeZone: BUDAPEST_TIMEZONE,
  };
}

/**
 * Attaches a live Firebase RTDB `.info/serverTimeOffset` listener.
 * Keeps the invisible clock continuously synchronized whenever the client
 * connects or reconnects to Firebase.
 *
 * @param {object} rtdb - Firebase Realtime Database instance
 * @param {Function} refFn - firebase/database `ref` function
 * @param {Function} onValueFn - firebase/database `onValue` function
 * @returns {Function} unsubscribe callback
 */
export function bindFirebaseServerTimeOffset(rtdb, refFn, onValueFn) {
  if (!rtdb || typeof refFn !== 'function' || typeof onValueFn !== 'function') {
    return () => {};
  }
  try {
    const offsetRef = refFn(rtdb, '.info/serverTimeOffset');
    const unsubscribe = onValueFn(
      offsetRef,
      (snap) => {
        const val = snap?.val?.();
        if (typeof val === 'number' && Number.isFinite(val)) {
          setServerTimeOffset(val);
        }
      },
      () => {
        // Silent fallback to local clock on connection/permission error
      }
    );
    return typeof unsubscribe === 'function' ? unsubscribe : () => {};
  } catch {
    return () => {};
  }
}

/**
 * Returns the authoritative current timestamp in milliseconds (UTC epoch),
 * adjusted by the Firebase server offset.
 */
export function getServerNowMs() {
  return Date.now() + _serverTimeOffsetMs;
}

/**
 * Returns the authoritative current `Date` instant (UTC epoch adjusted by server offset).
 */
export function getServerNow() {
  return new Date(getServerNowMs());
}

/**
 * Returns the authoritative current ISO-8601 UTC timestamp string.
 */
export function getServerIsoString() {
  return getServerNow().toISOString();
}

/**
 * Extracts normalized date & time components in the `Europe/Budapest` timezone.
 * If no `date` is provided, uses `getServerNow()` (server-synced clock).
 */
export function getBudapestNowParts(date = null) {
  const d = (date instanceof Date && !Number.isNaN(date.getTime()))
    ? date
    : (date !== null && date !== undefined && !Number.isNaN(new Date(date).getTime()))
      ? new Date(date)
      : getServerNow();

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUDAPEST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const getPart = (type) => parts.find((p) => p.type === type)?.value || '';
  const year = getPart('year');
  const month = getPart('month');
  const day = Number(getPart('day')) || 1;
  // Some JS engines format midnight as '24' in hour12: false mode; normalize to 0
  const rawHour = Number(getPart('hour')) || 0;
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(getPart('minute')) || 0;
  const second = Number(getPart('second')) || 0;

  const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const totalMinutes = hour * 60 + minute;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr,
    timeStr,
    totalMinutes,
  };
}

/**
 * Returns today's date string (`YYYY-MM-DD`) in `Europe/Budapest` using the server clock.
 */
export function getBudapestTodayYMD(date = null) {
  return getBudapestNowParts(date).dateStr;
}

/**
 * Returns a local-midnight `Date` object whose `getFullYear()`, `getMonth()`,
 * and `getDate()` match the exact current calendar day in `Europe/Budapest`.
 * Ideal for Calendar grid state (`year`, `month`, `weekDays`, "Today" button)
 * so the calendar never drifts even if the user's OS timezone or clock is wrong.
 */
export function getBudapestCalendarDate(date = null) {
  const { year, month, day } = getBudapestNowParts(date);
  return new Date(Number(year), Number(month) - 1, Number(day));
}
