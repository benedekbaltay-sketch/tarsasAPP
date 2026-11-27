import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Mail } from 'lucide-react';
import { resolveUserProfiles, getNotificationsForActiveProfile } from '../utils/userProfiles';

/**
 * Header Mail & Notifications trigger button.
 * Opens the full-screen Communication Center directly on click (just like Calendar),
 * while displaying the live per-profile unread counter badge.
 */
export function NotificationBell({ onOpenCommunicationCenter }) {
  const { state, t } = useApp();
  const { currentUser, currentLang, notifications, buildings, organizations, users } = state;
  const isEn = currentLang === 'en';

  const allUserProfiles = useMemo(
    () =>
      resolveUserProfiles(currentUser, {
        buildings,
        organizations,
        users,
      }).allProfiles,
    [currentUser, buildings, organizations, users]
  );

  const userNotifications = useMemo(
    () => getNotificationsForActiveProfile(notifications || [], currentUser, allUserProfiles),
    [notifications, currentUser, allUserProfiles]
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

  const label = t.notif_title || (isEn ? 'Mail & Notifications' : 'Levelezés és Értesítések');

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof onOpenCommunicationCenter === 'function') {
          onOpenCommunicationCenter();
        }
      }}
      aria-label={label}
      title={label}
      className={`relative flex items-center justify-center w-8.5 h-8 sm:w-9 sm:h-8.5 rounded-xl border transition-all cursor-pointer active:scale-95 shadow-2xs ${
        hasUnreadCritical
          ? 'border-red-200 bg-red-50/70 hover:bg-red-50 text-red-700'
          : 'border-gray-200 bg-white hover:bg-blue-50/70 hover:border-blue-300 hover:text-[#1E3A8A] text-gray-700'
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
  );
}
