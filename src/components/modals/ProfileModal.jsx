import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  User, 
  Key, 
  Phone, 
  Mail, 
  Home, 
  Users, 
  Save, 
  Pencil, 
  Copy, 
  Check, 
  Menu, 
  X,
  Briefcase,
  ShieldCheck,
  SlidersHorizontal,
  MapPin,
  Clock,
  Bell,
  Volume2,
  VolumeX,
  Globe,
  Lock,
  LogOut,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Settings,
  Building2,
  UserCheck
} from 'lucide-react';
import { resolveUserOrgContext, getNotificationsForUser } from '../../utils/teamPermissions';
import { formatPhoneNumber } from '../../utils/phone';
import { formatTaxNumber } from '../../utils/taxNumber';
import { formatAnnexItem } from '../../utils/annex';
import { ProfileSwitcherButton } from '../ProfileSwitcherButton';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';
import { playNotificationSound } from '../../utils/sound';

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

export function ProfileModal({
  isOpen,
  onClose,
  onOpenChangePassword,
  onOpenProfileSelector,
  onOpenDrawer,
  profileNavigation,
  onOpenTeamManagement
}) {
  const { 
    state, 
    t, 
    saveFlatMaster, 
    updateRepProfile, 
    updateOrganizationSettings,
    updateGlobalSettings, 
    setLanguage, 
    logout, 
    showToast, 
    getUserFlats,
    markNotificationRead,
  } = useApp();
  
  const { currentUser, flats, buildings, currentBuildingId, currentLang, repProfile, globalSettings, lastSyncTime } = state;
  const isEn = currentLang === 'en';
  const isHu = !isEn;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  // Team permission update notifications for current user
  const [showAllTeamNotifications, setShowAllTeamNotifications] = useState(false);
  const userTeamNotifications = useMemo(() => {
    const notifs = getNotificationsForUser(state.notifications || [], currentUser);
    return notifs.filter((n) => n && n.type === 'team_updated');
  }, [state.notifications, currentUser]);
  const latestTeamNotification = userTeamNotifications[0] || null;

  // Navigation tab for Admin Settings view: Option A (personal, company, security, preferences)
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'company' | 'security' | 'preferences'

  const orgCtx = resolveUserOrgContext(currentUser, state.organizations, buildings);
  const isStaff = Boolean(orgCtx.isStaff);

  // Clipboard copy status indicator
  const [copiedKey, setCopiedKey] = useState(null);

  // 1. Personal Profile form state (User / Representative)
  const [isEditingRep, setIsEditingRep] = useState(false);
  const [repName, setRepName] = useState('');
  const [repEmail, setRepEmail] = useState('');
  const [repPhone, setRepPhone] = useState('');
  const [repOfficeHours, setRepOfficeHours] = useState('');

  // 2. Company / Organization Profile form state (Owner / Admin)
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyRepName, setCompanyRepName] = useState('');
  const [companyTaxNumber, setCompanyTaxNumber] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyOfficeHours, setCompanyOfficeHours] = useState('');
  const [companyShowCentralContactToResidents, setCompanyShowCentralContactToResidents] = useState(false);

  // 3. Account & Security state
  const [rememberMe, setRememberMe] = useState(true);

  // 4. Global Preferences state
  const [notifBankErrors, setNotifBankErrors] = useState(true);
  const [notifExpiringLoans, setNotifExpiringLoans] = useState(true);
  const [notifUpcomingAssemblies, setNotifUpcomingAssemblies] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [debugLogging, setDebugLogging] = useState(false);

  // Tenant editable fields
  const flat = (flats || []).find(f => f.flatNum === currentUser?.flatNum);
  const currentBuilding = (buildings || []).find(b => b.id === currentBuildingId) || buildings[0];
  const [isEditingTenantContact, setIsEditingTenantContact] = useState(false);
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantEmergencyContact, setTenantEmergencyContact] = useState('');
  const [tenantNotes, setTenantNotes] = useState('');

  const myFlats = getUserFlats ? getUserFlats(currentUser, buildings) : [];
  const profileLabel = isAdmin 
    ? (t.settings_title || "Fiók / Rendszerbeállítások") 
    : (myFlats.length > 1 ? (t.menu_my_flats || "Profilom / Lakásaim") : (t.menu_my_flat || "Profilom / Lakásom"));
  const ProfileIcon = isAdmin ? Settings : Home;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      // Load Personal Profile
      const prof = repProfile || {};
      setRepName(prof.name || currentUser?.name || '');
      setRepEmail(prof.email || currentUser?.email || '');
      setRepPhone(prof.phone ? formatPhoneNumber(prof.phone) : '');
      setRepOfficeHours(prof.officeHours || 'H-P: 08:00 - 16:00');
      setIsEditingRep(false);

      // Load Company Profile
      const org = orgCtx.org;
      setCompanyName(org?.name || prof.companyName || '');
      setCompanyRepName(org?.centralContact?.name || prof.companyName || prof.name || '');
      setCompanyTaxNumber(formatTaxNumber(org ? (org.taxNumber || '') : (prof.taxNumber || '')));
      setCompanyAddress(org?.centralContact?.address || prof.address || '');
      setCompanyPhone(org?.centralContact?.phone ? formatPhoneNumber(org.centralContact.phone) : (prof.phone ? formatPhoneNumber(prof.phone) : ''));
      setCompanyEmail(org?.centralContact?.email || prof.email || '');
      setCompanyOfficeHours(org?.centralContact?.officeHours || prof.officeHours || 'H-P: 08:00 - 16:00');
      setCompanyShowCentralContactToResidents(Boolean(org?.showCentralContactToResidents ?? prof.showCentralContactToResidents ?? false));
      setIsEditingCompany(false);

      // Load Global Settings
      const sett = globalSettings || {};
      setRememberMe(sett.rememberMe !== undefined ? sett.rememberMe : (localStorage.getItem("tarsashaz_remember_me") === "true"));
      setSoundEnabled(sett.soundEffectsEnabled !== false);
      
      const notifs = sett.notifications || {};
      setNotifBankErrors(notifs.bankErrors !== false);
      setNotifExpiringLoans(notifs.expiringLoans !== false);
      setNotifUpcomingAssemblies(notifs.upcomingAssemblies !== false);

      const dev = sett.devSettings || {};
      setDebugLogging(Boolean(dev.debugLogging));

      // Tenant details
      if (flat) {
        setTenantPhone(flat.phone ? formatPhoneNumber(flat.phone) : '');
        setTenantEmergencyContact(flat.emergencyContact || '');
        setTenantNotes(flat.notes || '');
      }
      setIsEditingTenantContact(false);
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen, repProfile, globalSettings, flat, currentUser]);

  if (!isOpen || !currentUser) return null;

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(isEn ? "Copied to clipboard!" : "Másolva a vágólapra!");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleClose = () => {
    onClose();
  };

  // 1. Save Personal Profile
  const handleSaveRepProfile = (e) => {
    e.preventDefault();
    if (!repName.trim()) {
      showToast(isEn ? "Name is required!" : "A név megadása kötelező!", "error");
      return;
    }
    const formattedPhone = repPhone ? formatPhoneNumber(repPhone.trim()) : '';
    setRepPhone(formattedPhone);

    updateRepProfile({
      name: repName.trim(),
      email: repEmail.trim(),
      phone: formattedPhone,
      officeHours: repOfficeHours.trim(),
    });

    setIsEditingRep(false);
  };

  // 2. Save Company Profile (Owner / Admin)
  const handleSaveCompanyProfile = (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      showToast(isEn ? "Company name is required!" : "A cégnév megadása kötelező!", "error");
      return;
    }
    const formattedPhone = companyPhone ? formatPhoneNumber(companyPhone.trim()) : '';
    setCompanyPhone(formattedPhone);

    updateOrganizationSettings({
      name: companyName.trim(),
      taxNumber: formatTaxNumber(companyTaxNumber).trim(),
      centralContact: {
        name: (companyRepName || companyName).trim(),
        phone: formattedPhone,
        email: companyEmail.trim(),
        address: companyAddress.trim(),
        officeHours: companyOfficeHours.trim(),
      },
      showCentralContactToResidents: companyShowCentralContactToResidents,
    });

    setIsEditingCompany(false);
  };

  // 2. Remember Me Toggle
  const handleToggleRememberMe = (val) => {
    setRememberMe(val);
    try {
      localStorage.setItem("tarsashaz_remember_me", val ? "true" : "false");
    } catch (e) {}
    updateGlobalSettings({ rememberMe: val });
  };

  // 3. Language Selection
  const handleSelectLanguage = (lang) => {
    if (lang === currentLang) return;
    setLanguage(lang);
  };

  // 4. Notifications Toggle
  const handleToggleNotification = (key, val) => {
    const updated = {
      bankErrors: key === 'bankErrors' ? val : notifBankErrors,
      expiringLoans: key === 'expiringLoans' ? val : notifExpiringLoans,
      upcomingAssemblies: key === 'upcomingAssemblies' ? val : notifUpcomingAssemblies
    };
    if (key === 'bankErrors') setNotifBankErrors(val);
    if (key === 'expiringLoans') setNotifExpiringLoans(val);
    if (key === 'upcomingAssemblies') setNotifUpcomingAssemblies(val);

    updateGlobalSettings({ notifications: updated });
  };

  // 5. Sound Effects Toggle & Test
  const handleToggleSound = (val) => {
    setSoundEnabled(val);
    try {
      localStorage.setItem("tarsashaz_sound_effects", val ? "true" : "false");
    } catch (e) {}
    updateGlobalSettings({ soundEffectsEnabled: val });
    if (val) {
      playNotificationSound('success');
    }
  };

  const handleTestSound = () => {
    playNotificationSound('success');
  };

  // 6. Developer debug toggle
  const handleToggleDebug = (val) => {
    setDebugLogging(val);
    updateGlobalSettings({
      devSettings: { debugLogging: val }
    });
  };

  // 7. Cache clear
  const handleClearCache = () => {
    try {
      sessionStorage.clear();
      showToast(isEn ? "Local temporary cache cleared successfully!" : "Helyi gyorsítótár sikeresen kiürítve!");
    } catch (e) {}
  };

  // Tenant contact save
  const handleSaveTenantContact = (e) => {
    e.preventDefault();
    if (!flat) return;
    const formatted = tenantPhone ? formatPhoneNumber(tenantPhone.trim()) : '';
    setTenantPhone(formatted);
    saveFlatMaster(flat.flatNum, {
      phone: formatted,
      emergencyContact: tenantEmergencyContact.trim(),
      notes: tenantNotes.trim()
    });
    setIsEditingTenantContact(false);
    showToast(isEn ? "Contact info updated!" : "Elérhetőségek sikeresen frissítve!");
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#F3F4F6] flex flex-col overflow-hidden animate-fadeIn">
      {/* Sticky Header Container */}
      <div className="sticky top-0 z-10 w-full shadow-xs">
        <ImpersonationBanner onExit={handleClose} />
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 md:px-8 py-3 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Left: Menu & Website Logo -> Back to Home */}
          <div className="flex items-center justify-start gap-2 sm:gap-2.5 flex-1 min-w-0">
            {onOpenDrawer && (
              <button
                type="button"
                onClick={onOpenDrawer}
                className="w-8 h-8 sm:w-9 sm:h-8.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 shadow-2xs transition-all cursor-pointer flex-shrink-0 hover:border-gray-300"
                title={isHu ? "Menü megnyitása" : "Open Menu"}
                aria-label={isHu ? "Menü megnyitása" : "Open Menu"}
              >
                <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-gray-700" />
              </button>
            )}
            <NavLogoButton onClick={handleClose} />
          </div>

          {/* Center: Title & Subtitle */}
          <div className="flex items-center justify-center text-center px-1 sm:px-2 flex-shrink-0 max-w-[55%] sm:max-w-[50%]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                <ProfileIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 text-left sm:text-center">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 font-display truncate">
                  {profileLabel}
                </h2>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate block">
                  {isAdmin 
                    ? (t.settings_subtitle || "Közös képviseleti vállalkozói profil és portfólió beállítások")
                    : `${flat?.flatNum || currentUser.flatNum}. ${isHu ? 'lakás' : 'flat'}`}
                </span>
              </div>
            </div>
          </div>

          {/* Right side: Profile Selector & Close */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 flex-1 flex-shrink-0">
            {!isAdmin && onOpenProfileSelector && myFlats.length > 1 && (
              <ProfileSwitcherButton onOpenProfileSelector={onOpenProfileSelector} />
            )}

            <button
              onClick={handleClose}
              className="w-8 h-8 sm:w-9 sm:h-8.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors shadow-2xs cursor-pointer flex-shrink-0"
              title={isHu ? "Bezárás" : "Close"}
              aria-label={isHu ? "Bezárás" : "Close"}
            >
              <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 md:py-8">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Team Permission Changes Notification Card */}
          {latestTeamNotification && (
            <div className={`p-5 rounded-2xl border transition-all ${
              !latestTeamNotification.read
                ? 'bg-blue-50/70 border-blue-200 shadow-sm'
                : 'bg-white border-gray-200 shadow-2xs'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200/70">
                <div className="flex items-start sm:items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    !latestTeamNotification.read ? 'bg-[#1E3A8A] text-white shadow-xs' : 'bg-gray-100 text-gray-700'
                  }`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 font-display">
                        {isEn ? (latestTeamNotification.titleEn || 'Condominium Access Updated') : (latestTeamNotification.titleHu || 'Házkezelési jogosultságaid módosultak')}
                      </h3>
                      {!latestTeamNotification.read && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1E3A8A] text-white animate-pulse">
                          {isEn ? 'New' : 'Új'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {latestTeamNotification.actorName || latestTeamNotification.actorEmail
                        ? (isEn
                            ? `${latestTeamNotification.actorName || latestTeamNotification.actorEmail} updated your access permissions:`
                            : `${latestTeamNotification.actorName || latestTeamNotification.actorEmail} módosította a jogosultságaidat:`)
                        : (isEn ? 'Recent permission updates:' : 'Legutóbbi jogosultság változások:')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatNotifTime(latestTeamNotification.createdAt, isEn)}
                  </span>
                  {!latestTeamNotification.read ? (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(latestTeamNotification.id)}
                      className="px-3 py-1.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold shadow-2xs cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{t.profile_permissions_acknowledge_btn || (isEn ? 'Acknowledge' : 'Tudomásul vettem')}</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      {t.profile_permissions_acknowledged_badge || (isEn ? 'Acknowledged' : 'Tudomásul véve')}
                    </span>
                  )}
                </div>
              </div>

              {/* Breakdown of changes */}
              <div className="mt-3.5 space-y-2">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {t.team_detailed_changes || (isEn ? 'Detailed changes:' : 'Részletes változások:')}
                </div>
                {Array.isArray(latestTeamNotification.changes) && latestTeamNotification.changes.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {latestTeamNotification.changes.map((ch, idx) => {
                      const badgeStyle = ch.type === 'granted'
                        ? 'bg-emerald-100/90 text-emerald-800 border-emerald-300'
                        : ch.type === 'revoked'
                        ? 'bg-rose-100/90 text-rose-800 border-rose-300'
                        : 'bg-amber-100/90 text-amber-800 border-amber-300';
                      const badgeText = ch.type === 'granted'
                        ? (t.team_change_granted || (isEn ? '+ Granted' : '+ Megadva'))
                        : ch.type === 'revoked'
                        ? (t.team_change_revoked || (isEn ? '− Revoked' : '− Visszavonva'))
                        : (t.team_change_modified || (isEn ? '~ Modified' : '~ Módosítva'));

                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-gray-200/80 shadow-2xs text-xs text-gray-800"
                        >
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${badgeStyle}`}>
                            {badgeText}
                          </span>
                          <span className="font-medium text-slate-800 leading-relaxed">
                            {isEn ? (ch.labelEn || ch.labelHu) : (ch.labelHu || ch.labelEn)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white border border-gray-200 text-xs text-gray-600">
                    {isEn ? (latestTeamNotification.messageEn || latestTeamNotification.messageHu) : (latestTeamNotification.messageHu || latestTeamNotification.messageEn)}
                  </div>
                )}
              </div>

              {/* History toggle if there are more team notifications */}
              {userTeamNotifications.length > 1 && (
                <div className="mt-3 pt-2.5 border-t border-gray-200/60 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {isEn
                      ? `${userTeamNotifications.length} permission updates recorded`
                      : `${userTeamNotifications.length} korábbi jogosultság-módosítás rögzítve`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllTeamNotifications((prev) => !prev)}
                    className="text-[#1E3A8A] font-bold hover:underline cursor-pointer"
                  >
                    {showAllTeamNotifications
                      ? (isEn ? 'Hide past updates' : 'Előzmények elrejtése')
                      : (isEn ? 'View past updates' : 'Korábbi változtatások megtekintése')}
                  </button>
                </div>
              )}

              {showAllTeamNotifications && userTeamNotifications.length > 1 && (
                <div className="mt-3 space-y-3 pt-3 border-t border-gray-200/60">
                  {userTeamNotifications.slice(1).map((notif) => (
                    <div key={notif.id} className="p-3 rounded-xl bg-white/80 border border-gray-200 text-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span className="font-semibold text-gray-700">
                          {isEn ? (notif.titleEn || 'Access Update') : (notif.titleHu || 'Jogosultság módosítás')}
                        </span>
                        <span>{formatNotifTime(notif.createdAt, isEn)}</span>
                      </div>
                      {Array.isArray(notif.changes) && notif.changes.length > 0 ? (
                        <div className="space-y-1">
                          {notif.changes.map((ch, cIdx) => (
                            <div key={cIdx} className="flex items-center gap-2 text-[11px] text-gray-700">
                              <span className="font-bold text-gray-500">•</span>
                              <span>{isEn ? (ch.labelEn || ch.labelHu) : (ch.labelHu || ch.labelEn)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600">{isEn ? notif.messageEn : notif.messageHu}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* COMMON REPRESENTATIVE & SYSTEM SETTINGS VIEW (ADMIN/SUPERADMIN) */}
          {/* ============================================================== */}
          {isAdmin ? (
            <>
              {/* Top Navigation Tabs */}
              <div className="bg-white rounded-2xl border border-gray-200 p-1.5 shadow-2xs flex items-center gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('personal')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer flex-1 justify-center ${
                    activeTab === 'personal' || activeTab === 'profile'
                      ? 'bg-[#1E3A8A] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>{t.settings_tab_personal || (isEn ? "Personal Profile" : "Személyes profil")}</span>
                </button>

                {!isStaff && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('company')}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer flex-1 justify-center ${
                      activeTab === 'company'
                        ? 'bg-[#1E3A8A] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>{t.settings_tab_company || (isEn ? "Company Profile" : "Céges profil")}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer flex-1 justify-center ${
                    activeTab === 'security'
                      ? 'bg-[#1E3A8A] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t.settings_tab_security || "Fiók & Biztonság"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('preferences')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer flex-1 justify-center ${
                    activeTab === 'preferences'
                      ? 'bg-[#1E3A8A] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>{t.settings_tab_preferences || "Alkalmazás-beállítások"}</span>
                </button>
              </div>

              {/* TAB 1: SZEMÉLYES PROFIL & ELÉRHETŐSÉGEK */}
              {(activeTab === 'personal' || activeTab === 'profile') && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-bold">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 font-display">
                          {t.personal_profile_title || (isEn ? "Personal Contact & Profile" : "Személyes Elérhetőségek & Profil")}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {isStaff
                            ? (t.personal_profile_desc_staff || (isEn ? "These direct contact details appear to residents on condominiums where you are the assigned building manager." : "Ezek a közvetlen elérhetőségeid jelennek meg a lakóknak azokon a társasházakon, ahol te vagy a kijelölt felelős házkezelő."))
                            : (t.personal_profile_desc_owner || (isEn ? "Your personal direct contact and login details. Official company representation details are managed under Team & Access Permissions." : "A saját közvetlen kapcsolattartási és belépési adataid. A képviseleti cég hivatalos adatait a Csapat & Jogosultságok menüpontban kezelheted."))}
                        </p>
                      </div>
                    </div>

                    {!isEditingRep && (
                      <button
                        type="button"
                        onClick={() => setIsEditingRep(true)}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#1E3A8A]" />
                        <span>{t.edit || "Szerkesztés"}</span>
                      </button>
                    )}
                  </div>

                  {/* Company / Organization Context Box (Staff only) */}
                  {isStaff && orgCtx.org?.name && (
                    <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-700">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#1E3A8A] flex-shrink-0" />
                        <span>
                          {t.staff_profile_company_badge || (isEn ? "Central Company:" : "Központi cég:")}{' '}
                          <strong>{orgCtx.org?.name}</strong>
                        </span>
                      </div>
                      {Boolean(orgCtx.org?.taxNumber) && (
                        <span className="text-gray-500 font-medium">
                          {isEn ? "Tax ID:" : "Adószám:"}{' '}
                          <strong className="text-gray-800 font-mono">{formatTaxNumber(orgCtx.org.taxNumber)}</strong>
                        </span>
                      )}
                    </div>
                  )}

                  {!isEditingRep ? (
                    /* Read-only Personal Profile */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      {/* Name */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0 mr-2">
                          <span className="text-gray-400 text-[10px] uppercase font-bold block mb-1">
                            {t.personal_profile_name_label || (isEn ? "Name" : "Név")}
                          </span>
                          <span className="font-bold text-gray-900 text-sm truncate block">
                            {repName || currentUser?.name || "Nincs megadva"}
                          </span>
                        </div>
                        {repName && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(repName, 'rep-name')}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer flex-shrink-0"
                            title="Másolás"
                          >
                            {copiedKey === 'rep-name' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      {/* Direct Phone */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0 mr-2">
                          <span className="text-gray-400 text-[10px] uppercase font-bold block mb-1 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{t.personal_profile_direct_phone || (isEn ? "Direct Phone" : "Közvetlen telefonszám")}</span>
                          </span>
                          <span className="font-bold text-gray-900 text-sm truncate block">
                            {repPhone || "Nincs megadva"}
                          </span>
                        </div>
                        {repPhone && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(repPhone, 'rep-phone')}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer flex-shrink-0"
                            title="Másolás"
                          >
                            {copiedKey === 'rep-phone' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      {/* Direct Email */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0 mr-2">
                          <span className="text-gray-400 text-[10px] uppercase font-bold block mb-1 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-[#1E3A8A]" />
                            <span>{t.personal_profile_direct_email || (isEn ? "Direct Email" : "Közvetlen e-mail cím")}</span>
                          </span>
                          <span className="font-bold text-gray-900 text-sm truncate block">
                            {repEmail || currentUser?.email || "Nincs megadva"}
                          </span>
                        </div>
                        {repEmail && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(repEmail, 'rep-email')}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer flex-shrink-0"
                            title="Másolás"
                          >
                            {copiedKey === 'rep-email' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      {/* Office Hours */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0 mr-2">
                          <span className="text-gray-400 text-[10px] uppercase font-bold block mb-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>{t.personal_profile_office_hours || (isEn ? "Office / Availability Hours" : "Fogadási / elérhetőségi idő")}</span>
                          </span>
                          <span className="font-bold text-gray-900 text-sm truncate block">
                            {repOfficeHours || "Nincs megadva"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Edit Personal Profile Form */
                    <form onSubmit={handleSaveRepProfile} className="space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            {t.personal_profile_name_label || (isEn ? "Name" : "Név")} *
                          </label>
                          <input
                            type="text"
                            value={repName}
                            onChange={(e) => setRepName(e.target.value)}
                            placeholder="Kovács János"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                            required
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            {t.personal_profile_direct_phone || (isEn ? "Direct Phone" : "Közvetlen telefonszám")}
                          </label>
                          <input
                            type="tel"
                            value={repPhone}
                            onChange={(e) => setRepPhone(e.target.value)}
                            placeholder="+36 20 123 4567"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            {t.personal_profile_direct_email || (isEn ? "Direct Email" : "Közvetlen e-mail cím")}
                          </label>
                          <input
                            type="email"
                            value={repEmail}
                            onChange={(e) => setRepEmail(e.target.value)}
                            placeholder="kovacs.janos@gmail.com"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            {t.personal_profile_office_hours || (isEn ? "Office / Availability Hours" : "Fogadási / elérhetőségi idő")}
                          </label>
                          <input
                            type="text"
                            value={repOfficeHours}
                            onChange={(e) => setRepOfficeHours(e.target.value)}
                            placeholder="Hétfő - Péntek: 08:00 - 16:00"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => {
                            const prof = repProfile || {};
                            setRepName(prof.name || currentUser?.name || '');
                            setRepEmail(prof.email || currentUser?.email || '');
                            setRepPhone(prof.phone ? formatPhoneNumber(prof.phone) : '');
                            setRepOfficeHours(prof.officeHours || 'H-P: 08:00 - 16:00');
                            setIsEditingRep(false);
                          }}
                          className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          {t.cancel || "Mégse"}
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-[#1E3A8A] hover:bg-blue-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          <span>{t.save || "Mentés"}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 2: CÉGES / KÖZÖS KÉPVISELETI PROFIL (CSAK OWNER / ADMIN) */}
              {activeTab === 'company' && !isStaff && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-bold">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 font-display">
                          {t.settings_company_title || (isEn ? "Condominium Management Company Profile" : "Közös Képviseleti Vállalkozói Profil")}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {t.settings_company_desc || (isEn ? "This official organization data appears on formal documents, balance statements, and as the central company contact for condominiums." : "Ez a hivatalos cégadat szerepel a hivatalos dokumentumokon, egyenlegközlőkön és a társasházak központi elérhetőségeként.")}
                        </p>
                      </div>
                    </div>

                    {!isEditingCompany && (
                      <button
                        type="button"
                        onClick={() => setIsEditingCompany(true)}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#1E3A8A]" />
                        <span>{t.edit || "Szerkesztés"}</span>
                      </button>
                    )}
                  </div>

                  {!isEditingCompany ? (
                    /* Read-only Company Profile */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      {/* Company Name */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0 mr-2">
                          <span className="text-gray-400 text-[10px] uppercase font-bold block mb-1">
                            {t.settings_company_name || (isEn ? "Company / Business Name" : "Cégnév / Vállalkozás megnevezése")}
                          </span>
                          <span className="font-bold text-gray-900 text-sm truncate block">
                            {companyName || "Nincs megadva"}
                          </span>
                        </div>
                        {companyName && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(companyName, 'company-name')}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer flex-shrink-0"
                            title="Másolás"
                          >
                            {copiedKey === 'company-name' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      {/* Company Tax ID */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0 mr-2">
                          <span className="text-gray-400 text-[10px] uppercase font-bold block mb-1">
                            {t.settings_company_tax_number || (isEn ? "Tax ID / Number" : "Adószám")}
                          </span>
                          <span className="font-bold text-gray-900 text-sm truncate block font-mono">
                            {formatTaxNumber(companyTaxNumber) || "Nincs megadva"}
                          </span>
                        </div>
                        {companyTaxNumber && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(companyTaxNumber, 'company-tax')}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer flex-shrink-0"
                            title="Másolás"
                          >
                            {copiedKey === 'company-tax' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      {/* Central Email */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0 mr-2">
                          <span className="text-gray-400 text-[10px] uppercase font-bold block mb-1 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-[#1E3A8A]" />
                            <span>{t.settings_central_email || (isEn ? "Central Email" : "Központi e-mail cím")}</span>
                          </span>
                          <span className="font-bold text-gray-900 text-sm truncate block">
                            {companyEmail || "Nincs megadva"}
                          </span>
                        </div>
                        {companyEmail && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(companyEmail, 'company-email')}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer flex-shrink-0"
                            title="Másolás"
                          >
                            {copiedKey === 'company-email' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      {/* Central Phone */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0 mr-2">
                          <span className="text-gray-400 text-[10px] uppercase font-bold block mb-1 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{t.settings_central_phone || (isEn ? "Central Phone" : "Központi telefonszám")}</span>
                          </span>
                          <span className="font-bold text-gray-900 text-sm truncate block">
                            {companyPhone || "Nincs megadva"}
                          </span>
                        </div>
                        {companyPhone && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(companyPhone, 'company-phone')}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer flex-shrink-0"
                            title="Másolás"
                          >
                            {copiedKey === 'company-phone' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      {/* Headquarters / Office Address */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0 mr-2">
                          <span className="text-gray-400 text-[10px] uppercase font-bold block mb-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-red-500" />
                            <span>{t.settings_office_address || (isEn ? "Office / Headquarters Address" : "Iroda / Levelezési cím")}</span>
                          </span>
                          <span className="font-bold text-gray-900 text-sm truncate block">
                            {companyAddress || "Nincs megadva"}
                          </span>
                        </div>
                        {companyAddress && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(companyAddress, 'company-address')}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer flex-shrink-0"
                            title="Másolás"
                          >
                            {copiedKey === 'company-address' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      {/* Office Hours */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0 mr-2">
                          <span className="text-gray-400 text-[10px] uppercase font-bold block mb-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>{t.settings_office_hours || (isEn ? "Office Hours" : "Ügyfélfogadási idő")}</span>
                          </span>
                          <span className="font-bold text-gray-900 text-sm truncate block">
                            {companyOfficeHours || "Nincs megadva"}
                          </span>
                        </div>
                      </div>

                      {/* Escalation Channel Status Indicator */}
                      <div className="sm:col-span-2 p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-gray-700">
                          <ShieldCheck className="w-4 h-4 text-[#1E3A8A]" />
                          <div>
                            <span className="font-bold block">
                              {isEn ? "Resident-Facing Visibility & Escalation" : "Lakóknak megjelenő adatok és eszkaláció"}:
                            </span>
                            <span className="text-[11px] text-gray-500 block">
                              {isEn
                                ? "Configured per-building when assigning team members under Csapat & Jogosultságok (Team & Permissions)."
                                : "A Csapat & Jogosultságok menüpontban, a munkatársak házankénti kiosztásánál állítható be."}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Edit Company Profile Form */
                    <form onSubmit={handleSaveCompanyProfile} className="space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            {t.settings_company_name || (isEn ? "Company / Business Name" : "Cégnév / Vállalkozás megnevezése")} *
                          </label>
                          <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Alfa Társasházkezelő Kft."
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                            required
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            {t.settings_company_tax_number || (isEn ? "Tax ID / Number" : "Adószám")}
                          </label>
                          <input
                            type="text"
                            value={companyTaxNumber}
                            onChange={(e) => setCompanyTaxNumber(formatTaxNumber(e.target.value))}
                            placeholder="12345678-1-42"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            {t.settings_central_phone || (isEn ? "Central Phone" : "Központi telefonszám")}
                          </label>
                          <input
                            type="tel"
                            value={companyPhone}
                            onChange={(e) => setCompanyPhone(e.target.value)}
                            placeholder="+36 1 234 5678"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            {t.settings_central_email || (isEn ? "Central Email" : "Központi e-mail cím")}
                          </label>
                          <input
                            type="email"
                            value={companyEmail}
                            onChange={(e) => setCompanyEmail(e.target.value)}
                            placeholder="iroda@alfa.hu"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            {t.settings_office_address || (isEn ? "Office / Headquarters Address" : "Iroda / Levelezési cím")}
                          </label>
                          <input
                            type="text"
                            value={companyAddress}
                            onChange={(e) => setCompanyAddress(e.target.value)}
                            placeholder="1011 Budapest, Fő utca 1."
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            {t.settings_office_hours || (isEn ? "Office Hours" : "Ügyfélfogadási idő")}
                          </label>
                          <input
                            type="text"
                            value={companyOfficeHours}
                            onChange={(e) => setCompanyOfficeHours(e.target.value)}
                            placeholder="Hétfő - Péntek: 09:00 - 16:00"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => {
                            const org = orgCtx.org;
                            const prof = repProfile || {};
                            setCompanyName(org?.name || prof.companyName || '');
                            setCompanyRepName(org?.centralContact?.name || prof.companyName || prof.name || '');
                            setCompanyTaxNumber(formatTaxNumber(org ? (org.taxNumber || '') : (prof.taxNumber || '')));
                            setCompanyAddress(org?.centralContact?.address || prof.address || '');
                            setCompanyPhone(org?.centralContact?.phone ? formatPhoneNumber(org.centralContact.phone) : (prof.phone ? formatPhoneNumber(prof.phone) : ''));
                            setCompanyEmail(org?.centralContact?.email || prof.email || '');
                            setCompanyOfficeHours(org?.centralContact?.officeHours || prof.officeHours || 'H-P: 08:00 - 16:00');
                            setCompanyShowCentralContactToResidents(Boolean(org?.showCentralContactToResidents ?? prof.showCentralContactToResidents ?? false));
                            setIsEditingCompany(false);
                          }}
                          className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-colors cursor-pointer"
                        >
                          {t.cancel || "Mégse"}
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-[#1E3A8A] hover:bg-blue-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          <span>{t.save || "Mentés"}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 3: FIÓK ÉS BIZTONSÁG */}
              {activeTab === 'security' && (
                <div className="space-y-5">
                  {/* Account Summary & Password Change */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900 font-display">
                            {t.settings_security_title || "Hitelesítés és Munkamenet"}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {t.settings_change_password_desc || "Kezelje jelszavát és az aktív eszközök biztonsági beállításait."}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <span className="text-gray-400 text-[10px] uppercase font-bold block mb-1">
                          {t.settings_logged_in_as || "Bejelentkezett felhasználó"}
                        </span>
                        <span className="font-bold text-gray-900 text-sm block">
                          {currentUser.email}
                        </span>
                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-blue-100 text-[#1E3A8A] text-[10px] font-bold">
                          {currentUser.role === 'superadmin' ? 'Rendszergazda' : 'Közös Képviselet (Admin)'}
                        </span>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between">
                        <div>
                          <span className="text-gray-400 text-[10px] uppercase font-bold block mb-1">
                            {t.change_password || "Jelszó módosítása"}
                          </span>
                          <span className="text-xs text-gray-600 block mb-2">
                            {isHu ? "Rendszeres jelszóváltás javasolt a fiók védelmében." : "Regular password updates are recommended."}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={onOpenChangePassword}
                          className="w-full py-2 px-3 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>{t.change_password || "Jelszó megváltoztatása"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Remember Me Toggle */}
                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                      <div className="min-w-0 pr-4">
                        <span className="text-sm font-bold text-gray-900 block">
                          {t.settings_remember_me || "„Emlékezz rám” funkció"}
                        </span>
                        <span className="text-xs text-gray-500 block">
                          {t.settings_remember_me_desc || "Maradjon bejelentkezve ezen a készüléken a böngésző bezárása után is."}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => handleToggleRememberMe(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E3A8A]"></div>
                      </label>
                    </div>

                    {/* Active Session & Logout */}
                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-gray-900 block flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>{t.settings_session_active || "Aktív munkamenet állapota"}</span>
                        </span>
                        <span className="text-xs text-gray-500 block mt-0.5">
                          {t.settings_session_active_desc || "Biztonságos kapcsolat aktív hitelesítéssel ezen a készüléken."}
                        </span>
                        {lastSyncTime && (
                          <span className="text-[11px] text-gray-400 block mt-1">
                            {t.settings_last_sync || "Utolsó szinkronizáció"}: {new Date(lastSyncTime).toLocaleTimeString()}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          handleClose();
                          logout();
                        }}
                        className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-red-200/60"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{t.settings_logout_all || "Kijelentkezés erről az eszközről"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: GLOBÁLIS ALKALMAZÁS-PREFERENCIÁK */}
              {activeTab === 'preferences' && (
                <div className="space-y-5">
                  {/* Default Language Selector */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
                      <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">
                          {t.settings_lang_title || "Alapértelmezett felületnyelv"}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {t.settings_lang_desc || "Válassza ki a portál nyelvét az egész fiókra vonatkozóan."}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleSelectLanguage('hu')}
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                          currentLang === 'hu'
                            ? 'border-[#1E3A8A] bg-blue-50/70 text-[#1E3A8A] shadow-xs'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">🇭🇺</span>
                          <span className="font-bold text-xs sm:text-sm">Magyar (Hungarian)</span>
                        </div>
                        {currentLang === 'hu' && <Check className="w-4 h-4 text-[#1E3A8A]" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectLanguage('en')}
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                          currentLang === 'en'
                            ? 'border-[#1E3A8A] bg-blue-50/70 text-[#1E3A8A] shadow-xs'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">🇬🇧</span>
                          <span className="font-bold text-xs sm:text-sm">English (Angol)</span>
                        </div>
                        {currentLang === 'en' && <Check className="w-4 h-4 text-[#1E3A8A]" />}
                      </button>
                    </div>
                  </div>

                  {/* Notification Settings */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">
                          {t.settings_notif_title || "Értesítési beállítások"}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {isHu ? "Rendszerszintű figyelmeztetések és emlékeztetők beállítása." : "Configure system-level alerts and reminders."}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 text-xs pt-1">
                      {/* Bank errors */}
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 pr-4">
                          <span className="text-sm font-bold text-gray-900 block">
                            {t.settings_notif_bank || "Banki szinkronizációs hibák"}
                          </span>
                          <span className="text-gray-500 block">
                            {t.settings_notif_bank_desc || "Azonnali felugró figyelmeztetés automatikus banki import hiba vagy egyenlegeltérés esetén."}
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={notifBankErrors}
                            onChange={(e) => handleToggleNotification('bankErrors', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E3A8A]"></div>
                        </label>
                      </div>

                      {/* Expiring loans */}
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                        <div className="min-w-0 pr-4">
                          <span className="text-sm font-bold text-gray-900 block">
                            {t.settings_notif_loans || "Lejáró hitelek & célbefizetések"}
                          </span>
                          <span className="text-gray-500 block">
                            {t.settings_notif_loans_desc || "Rendszerértesítés 30 nappal a társasházi hitelek és törlesztők lejárata előtt."}
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={notifExpiringLoans}
                            onChange={(e) => handleToggleNotification('expiringLoans', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E3A8A]"></div>
                        </label>
                      </div>

                      {/* Upcoming assemblies */}
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                        <div className="min-w-0 pr-4">
                          <span className="text-sm font-bold text-gray-900 block">
                            {t.settings_notif_assemblies || "Közelgő közgyűlések & határidők"}
                          </span>
                          <span className="text-gray-500 block">
                            {t.settings_notif_assemblies_desc || "Automatikus határidő-emlékeztetők a közgyűlési meghívók kiküldéséről és határidőkről."}
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={notifUpcomingAssemblies}
                            onChange={(e) => handleToggleNotification('upcomingAssemblies', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E3A8A]"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Sound Effects */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">
                            {t.settings_sound_title || "Rendszerhangok & visszajelzések"}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {t.settings_sound_desc || "Kellemes hangjelzés sikeres mentéskor, befizetés rögzítésekor és figyelmeztetéskor."}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleTestSound}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                        title={t.settings_sound_test || "Hang tesztelése"}
                      >
                        <Volume2 className="w-3.5 h-3.5 text-[#1E3A8A]" />
                        <span>{t.settings_sound_test || "Hang tesztelése"}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="min-w-0 pr-4">
                        <span className="text-sm font-bold text-gray-900 block">
                          {isHu ? "Rendszerhangok lejátszása" : "Enable Sound Effects"}
                        </span>
                        <span className="text-xs text-gray-500 block">
                          {isHu ? "Web Audio API alapú finom visszajelző hangok." : "Web Audio API synthesized notification feedback."}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={soundEnabled}
                          onChange={(e) => handleToggleSound(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E3A8A]"></div>
                      </label>
                    </div>
                  </div>

                  {/* Developer & Advanced Settings */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                        <Settings className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">
                          {t.settings_dev_title || "Fejlesztői & Haladó Beállítások"}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {isHu ? "Rendszerdiagnosztika és fejlesztői eszközök." : "System diagnostics and developer tools."}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 text-xs pt-1">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 pr-4">
                          <span className="text-sm font-bold text-gray-900 block">
                            {t.settings_dev_debug || "Fejlesztői naplózás engedélyezése"}
                          </span>
                          <span className="text-gray-500 block">
                            {isHu ? "Részletes állapotváltozások és Firebase RTDB hívások naplózása a böngésző konzolján." : "Verbose state changes and RTDB call logging in browser console."}
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={debugLogging}
                            onChange={(e) => handleToggleDebug(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E3A8A]"></div>
                        </label>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold text-gray-900 block">
                            {t.settings_dev_cache_clear || "Helyi munkamenet-gyorsítótár ürítése"}
                          </span>
                          <span className="text-gray-500 block">
                            {isHu ? "Ideiglenes munkameneti adatok törlése a böngészőből." : "Clears temporary session data from browser storage."}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearCache}
                          className="px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                          <span>{isHu ? "Gyorsítótár törlése" : "Clear Cache"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              </>
          ) : (
            /* ============================================================== */
            /* RESIDENT / TENANT PROFILE VIEW                                 */
            /* ============================================================== */
            <div className="space-y-6">
              {/* Resident Apartment Card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-bold">
                      <Home className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 font-display">
                        {flat?.flatNum || currentUser.flatNum}. {isEn ? "Apartment" : "lakás"}
                      </h4>
                      <span className="text-xs text-gray-500 font-medium">
                        {currentBuilding?.name}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onOpenChangePassword}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5 text-[#1E3A8A]" />
                    <span>{t.change_password}</span>
                  </button>
                </div>

                {/* Apartment specifications */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="text-gray-400 block mb-0.5 text-[10px] uppercase font-bold">{t.flats_area}</span>
                    <span className="font-bold text-gray-900 text-sm">{flat?.area ? `${flat.area} m²` : '-'}</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="text-gray-400 block mb-0.5 text-[10px] uppercase font-bold">{t.flats_residents}</span>
                    <span className="font-bold text-gray-900 text-sm">{flat?.residents || 1} {isEn ? "prs" : "fő"}</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="text-gray-400 block mb-0.5 text-[10px] uppercase font-bold">{t.flats_ownership_share || "Tulajdoni hányad"}</span>
                    <span className="font-bold text-gray-900 text-sm font-mono">{flat?.ownershipShare || '-'}</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="text-gray-400 block mb-0.5 text-[10px] uppercase font-bold">{t.flat_card_floor || "Emelet"}</span>
                    <span className="font-bold text-gray-900 text-sm">{flat?.floor || '-'}</span>
                  </div>
                </div>

                {/* Tenant Contact Information */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {isEn ? "Contact Information" : "Elérhetőségek"}
                    </h5>
                    {!isEditingTenantContact && (
                      <button
                        type="button"
                        onClick={() => setIsEditingTenantContact(true)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>{t.edit || "Szerkesztés"}</span>
                      </button>
                    )}
                  </div>

                  {!isEditingTenantContact ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span className="text-gray-400 block mb-0.5">{t.phone}</span>
                        <span className="font-bold text-gray-900 text-sm">{tenantPhone || (isEn ? "Not provided" : "Nincs megadva")}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span className="text-gray-400 block mb-0.5">{isEn ? "Emergency Contact" : "Vészhelyzeti kapcsolat"}</span>
                        <span className="font-bold text-gray-900 text-sm">{tenantEmergencyContact || (isEn ? "Not provided" : "Nincs megadva")}</span>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveTenantContact} className="space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">{t.phone}</label>
                          <input
                            type="tel"
                            value={tenantPhone}
                            onChange={(e) => setTenantPhone(e.target.value)}
                            placeholder="+36 30 123 4567"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">{isEn ? "Emergency Contact" : "Vészhelyzeti kapcsolat"}</label>
                          <input
                            type="text"
                            value={tenantEmergencyContact}
                            onChange={(e) => setTenantEmergencyContact(e.target.value)}
                            placeholder="Név és telefonszám"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">{t.notes || "Megjegyzések"}</label>
                        <textarea
                          rows={2}
                          value={tenantNotes}
                          onChange={(e) => setTenantNotes(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingTenantContact(false)}
                          className="px-3.5 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                        >
                          {t.cancel || "Mégse"}
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{t.save || "Mentés"}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Resident Security & Authentication Card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 font-display">
                        {t.settings_security_title || (isEn ? "Security & Authentication" : "Biztonság és Hitelesítés")}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {isEn ? "Manage your apartment login credentials." : "Kezelje lakása belépési adatait és jelszavát."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block mb-0.5">
                      {t.change_password || (isEn ? "Change Password" : "Jelszó megváltoztatása")}
                    </span>
                    <span className="text-xs text-gray-500 block">
                      {isEn
                        ? "To update your password, verify your current password and choose a new password of at least 10 characters."
                        : "A jelszó módosításához erősítse meg a jelenlegi jelszavát, majd adjon meg egy új, legalább 10 karakteres jelszót."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenChangePassword}
                    className="px-4 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer shrink-0"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{t.change_password || (isEn ? "Change Password" : "Jelszó megváltoztatása")}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
