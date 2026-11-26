import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Users } from 'lucide-react';
import { resolveUserProfiles, getUnreadNotificationCountsByProfile } from '../utils/userProfiles';

export function ProfileSwitcherButton({ onOpenProfileSelector, className = "", label = null }) {
  const { state, t } = useApp();
  const { currentUser, buildings, organizations, users, notifications, currentLang } = state;

  const { allProfiles } = useMemo(
    () => resolveUserProfiles(currentUser, { buildings, organizations, users }),
    [currentUser, buildings, organizations, users]
  );

  const { hasOtherProfilesUnread, otherProfilesUnreadCount } = useMemo(
    () => getUnreadNotificationCountsByProfile(notifications || [], currentUser, allProfiles),
    [notifications, currentUser, allProfiles]
  );

  if (!currentUser || !onOpenProfileSelector) return null;

  // Show unified Profile Switcher whenever the verified email holds MORE than 1 profile
  // (e.g. KK + apartment, KK + SZVB, multiple apartments, or apartment + SZVB) — across ALL views including Portfolio!
  if (allProfiles.length <= 1) return null;

  const isHu = currentLang === 'hu' || !currentLang;
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';
  const isSzvbMode = currentUser.role === 'szvb';

  const buttonLabel =
    label || (t.profile_selector_btn || (isHu ? "Profilváltás" : "Switch Profile"));

  const tooltipText = hasOtherProfilesUnread
    ? (isHu
        ? `${buttonLabel} (${otherProfilesUnreadCount} olvasatlan értesítés másik profilban)`
        : `${buttonLabel} (${otherProfilesUnreadCount} unread notification(s) in another profile)`)
    : buttonLabel;

  return (
    <button
      type="button"
      onClick={onOpenProfileSelector}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border font-semibold text-xs shadow-2xs transition-all cursor-pointer flex-shrink-0 active:scale-95 ${
        isAdmin || isSzvbMode
          ? 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-800'
          : 'border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-[#1E3A8A] hover:border-blue-300'
      } ${className}`}
      title={tooltipText}
    >
      <Users className="w-3.5 h-3.5 text-[#1E3A8A] flex-shrink-0" />
      <span className="leading-none whitespace-nowrap hidden sm:inline">{buttonLabel}</span>
      {hasOtherProfilesUnread && (
        <span
          className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-white"
          aria-label={isHu ? "Olvasatlan értesítés másik profilban" : "Unread notification in another profile"}
        />
      )}
    </button>
  );
}
