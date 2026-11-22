import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Mail, ShieldAlert, Info, CheckCheck, X, Clock } from 'lucide-react';
import { getNotificationsForUser } from '../utils/teamPermissions';

function formatNotifTime(iso, isEn) {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 1) return isEn ? 'Just now' : 'Épp most';
  if (diffMin < 60) return isEn ? `${diffMin}m ago` : `${diffMin} perce`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return isEn ? `${diffH}h ago` : `${diffH} órája`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return isEn ? `${diffD}d ago` : `${diffD} napja`;
  try {
    return new Date(ts).toLocaleDateString(isEn ? 'en-GB' : 'hu-HU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso).slice(0, 10);
  }
}

export function NotificationBell() {
  const {
    state,
    t,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotification,
  } = useApp();
  const { currentUser, currentLang, notifications } = state;
  const isEn = currentLang === 'en';

  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const userNotifications = useMemo(
    () => getNotificationsForUser(notifications || [], currentUser),
    [notifications, currentUser]
  );

  const unreadCount = useMemo(
    () => userNotifications.filter((n) => !n.read).length,
    [userNotifications]
  );

  const hasUnreadCritical = useMemo(
    () => userNotifications.some((n) => !n.read && n.severity === 'critical'),
    [userNotifications]
  );

  if (!currentUser) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={t.notif_title || (isEn ? 'Notifications & Emails' : 'Értesítések & E-mailek')}
        title={t.notif_title || (isEn ? 'Notifications & Emails' : 'Értesítések & E-mailek')}
        className={`relative flex items-center justify-center w-8.5 h-8 sm:w-9 sm:h-8.5 rounded-xl border transition-all cursor-pointer active:scale-95 shadow-2xs ${
          isOpen
            ? 'border-[#1E3A8A] bg-blue-50 text-[#1E3A8A]'
            : hasUnreadCritical
            ? 'border-red-200 bg-red-50/70 hover:bg-red-50 text-red-700'
            : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-700'
        }`}
      >
        <Mail className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-extrabold leading-none flex items-center justify-center shadow-xs ring-2 ring-white"
            aria-label={isEn ? `${unreadCount} unread notifications` : `${unreadCount} olvasatlan értesítés`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={t.notif_title || (isEn ? 'Notifications & Emails' : 'Értesítések & E-mailek')}
          className="absolute -right-10 sm:right-0 mt-2 w-[min(22rem,calc(100vw-1.5rem))] sm:w-96 bg-white rounded-2xl border border-gray-200 shadow-2xl z-50 overflow-hidden animate-fadeIn"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-4 h-4 text-[#1E3A8A] flex-shrink-0" />
              <span className="text-xs font-bold text-gray-900 truncate">
                {t.notif_title || (isEn ? 'Notifications & Emails' : 'Értesítések & E-mailek')}
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-extrabold">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#1E3A8A] hover:underline cursor-pointer flex-shrink-0"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{t.notif_mark_all_read || (isEn ? 'Mark all read' : 'Mind olvasott')}</span>
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
            {userNotifications.length === 0 ? (
              <div className="py-10 px-6 text-center">
                <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2.5">
                  <Mail className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-xs font-semibold text-gray-500">
                  {t.notif_empty || (isEn ? 'You have no notifications or messages.' : 'Nincs új értesítésed vagy rendszerüzeneted.')}
                </p>
              </div>
            ) : (
              userNotifications.map((notif) => {
                const isCritical = notif.severity === 'critical';
                const title = isEn ? (notif.titleEn || notif.titleHu) : (notif.titleHu || notif.titleEn);
                const message = isEn ? (notif.messageEn || notif.messageHu) : (notif.messageHu || notif.messageEn);

                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.read) markNotificationRead(notif.id);
                    }}
                    className={`p-3.5 transition-colors cursor-pointer relative group border-l-4 ${
                      isCritical
                        ? notif.read
                          ? 'bg-red-50/55 hover:bg-red-50/80 border-l-red-400'
                          : 'bg-red-50/95 hover:bg-red-100/70 border-l-red-500'
                        : !notif.read
                        ? 'bg-blue-50/45 hover:bg-blue-50/75 border-l-[#1E3A8A]'
                        : 'bg-white hover:bg-gray-50 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isCritical
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100/80 text-[#1E3A8A]'
                        }`}
                      >
                        {isCritical ? (
                          <ShieldAlert className="w-4 h-4" />
                        ) : (
                          <Info className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 pr-5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isCritical && (
                            <span className="px-1.5 py-0.2 rounded bg-red-200/80 text-red-900 text-[9px] font-extrabold uppercase tracking-wider">
                              {t.notif_important_badge || (isEn ? 'Important' : 'Fontos')}
                            </span>
                          )}
                          <h5
                            className={`text-xs leading-snug ${
                              isCritical
                                ? 'font-bold text-red-950'
                                : !notif.read
                                ? 'font-bold text-gray-900'
                                : 'font-semibold text-gray-700'
                            }`}
                          >
                            {title}
                          </h5>
                          {!notif.read && (
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                isCritical ? 'bg-red-600' : 'bg-[#1E3A8A]'
                              }`}
                            />
                          )}
                        </div>

                        <p
                          className={`text-[11px] mt-1 leading-relaxed break-words ${
                            isCritical ? 'text-red-900/90' : 'text-gray-600'
                          }`}
                        >
                          {message}
                        </p>

                        {/* Structured old -> new bank account change breakdown */}
                        {Array.isArray(notif.changes) && notif.changes.length > 0 && (
                          <div className="mt-2 space-y-1 bg-white/70 border border-red-200/70 rounded-lg p-2">
                            {notif.changes.map((ch, idx) => (
                              <div key={idx} className="text-[10px] font-mono text-red-950 break-all">
                                <span className="font-sans font-bold text-red-800">
                                  {isEn ? ch.accountLabelEn : ch.accountLabelHu}:
                                </span>{' '}
                                <span className="line-through text-red-500/90">{ch.oldAccount}</span>{' '}
                                →{' '}
                                <span className="font-bold text-red-900">{ch.newAccount}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>{formatNotifTime(notif.createdAt, isEn)}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissNotification(notif.id);
                        }}
                        className="absolute top-2.5 right-2.5 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-black/5 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                        title={t.notif_dismiss || (isEn ? 'Dismiss' : 'Elrejtés')}
                        aria-label={t.notif_dismiss || (isEn ? 'Dismiss' : 'Elrejtés')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
