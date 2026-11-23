import React, { useState, useEffect } from 'react';
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
  UserCheck,
  Eye,
  EyeOff,
  Send,
  Loader2
} from 'lucide-react';
import { resolveUserOrgContext } from '../../utils/teamPermissions';
import { formatPhoneNumber } from '../../utils/phone';
import { formatAnnexItem } from '../../utils/annex';
import { ProfileSwitcherButton } from '../ProfileSwitcherButton';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';
import { playNotificationSound } from '../../utils/sound';
import { sendTestSettingsEmail } from '../../services/emailService';

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
    getUserFlats 
  } = useApp();
  
  const { currentUser, flats, buildings, currentBuildingId, currentLang, repProfile, globalSettings, lastSyncTime } = state;
  const isEn = currentLang === 'en';
  const isHu = !isEn;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

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

  // 5. Transactional Email & Reply-To state
  const [emailProvider, setEmailProvider] = useState('resend');
  const [emailApiKey, setEmailApiKey] = useState('');
  const [emailReplyTo, setEmailReplyTo] = useState('');
  const [emailSenderName, setEmailSenderName] = useState('');
  const [emailSenderEmail, setEmailSenderEmail] = useState('');
  const [showEmailApiKey, setShowEmailApiKey] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState(null);

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
    : (myFlats.length > 1 ? (t.menu_my_flats || "Lakásaim") : (t.menu_my_flat || "Lakásom"));
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

      // Load Transactional Email & Reply-To Settings
      const emailSett = sett.emailSettings || prof.emailSettings || {};
      setEmailProvider(emailSett.provider || 'resend');
      setEmailApiKey(emailSett.apiKey || '');
      setEmailReplyTo(emailSett.replyTo || '');
      setEmailSenderName(emailSett.senderName || '');
      setEmailSenderEmail(emailSett.senderEmail || '');
      setShowEmailApiKey(false);
      setTestEmailStatus(null);

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
      centralContact: {
        name: companyRepName.trim(),
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

  // 7. Save Email & Reply-To Settings
  const handleSaveEmailSettings = (e) => {
    if (e) e.preventDefault();
    const payload = {
      provider: emailProvider,
      apiKey: emailApiKey.trim(),
      replyTo: emailReplyTo.trim().toLowerCase(),
      senderName: emailSenderName.trim(),
      senderEmail: emailSenderEmail.trim().toLowerCase(),
    };
    updateGlobalSettings({ emailSettings: payload });
    updateRepProfile({ emailSettings: payload });
    showToast(t.settings_email_saved_toast || (isEn ? "Email and Reply-To settings saved successfully!" : "E-mail és válaszcím beállítások sikeresen elmentve!"));
  };

  // 8. Test Email Dispatch
  const handleSendTestEmail = async () => {
    if (!emailApiKey.trim()) {
      showToast((t.settings_email_api_key_label || "Szolgáltató API kulcs") + ": " + (isEn ? "Please enter an API key first." : "Kérjük, először adj meg egy API kulcsot!"), "error");
      return;
    }
    setIsSendingTestEmail(true);
    setTestEmailStatus(null);
    try {
      const target = emailReplyTo.trim() || repEmail.trim() || currentUser?.email;
      const res = await sendTestSettingsEmail({
        targetEmail: target,
        emailSettings: {
          provider: emailProvider,
          apiKey: emailApiKey.trim(),
          replyTo: emailReplyTo.trim().toLowerCase(),
          senderName: emailSenderName.trim(),
          senderEmail: emailSenderEmail.trim().toLowerCase(),
        },
        isEn,
      });
      if (res.success) {
        setTestEmailStatus({ success: true, message: `${t.settings_email_test_success_toast || "Teszt e-mail sikeresen elküldve:"} ${target}` });
        showToast(`${t.settings_email_test_success_toast || "Teszt e-mail sikeresen elküldve ide:"} ${target}`);
      } else {
        setTestEmailStatus({ success: false, message: res.message || res.error || "Ismeretlen hiba" });
        showToast(`${t.settings_email_test_failed_toast || "Teszt e-mail küldése sikertelen: "}${res.message || res.error}`, "error");
      }
    } catch (err) {
      setTestEmailStatus({ success: false, message: err?.message || "Hálózati hiba" });
      showToast(`${t.settings_email_test_failed_toast || "Teszt e-mail küldése sikertelen: "}${err?.message}`, "error");
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // 8. Cache clear
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

                  {/* Company / Organization Context Box */}
                  {isStaff && orgCtx.org?.name ? (
                    <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-2 text-xs text-gray-700">
                      <Building2 className="w-4 h-4 text-[#1E3A8A] flex-shrink-0" />
                      <span>
                        {t.staff_profile_company_badge || (isEn ? "Central Company:" : "Központi cég:")}{' '}
                        <strong>{orgCtx.org?.name}</strong>
                      </span>
                    </div>
                  ) : !isStaff && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Building2 className="w-4 h-4 text-[#1E3A8A] flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase font-bold text-gray-400 block">
                            {t.team_company_title || (isEn ? "Company Organization" : "Cég / Képviselet")}
                          </span>
                          <span className="font-bold text-gray-900 truncate block">
                            {orgCtx.org?.name || repProfile?.companyName || (isEn ? "No company configured yet" : "Nincs cég konfigurálva")}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('company')}
                        className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-200 text-[#1E3A8A] font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <span>{isEn ? "Edit Company Profile →" : "Cégprofil megtekintése / szerkesztése →"}</span>
                      </button>
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

                      {/* Displayed Representative Name */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0 mr-2">
                          <span className="text-gray-400 text-[10px] uppercase font-bold block mb-1">
                            {t.team_central_contact_name || (isEn ? "Displayed Representative Name" : "Megjelenített képviseleti név")}
                          </span>
                          <span className="font-bold text-gray-900 text-sm truncate block">
                            {companyRepName || "Nincs megadva"}
                          </span>
                        </div>
                        {companyRepName && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(companyRepName, 'company-rep')}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer flex-shrink-0"
                            title="Másolás"
                          >
                            {copiedKey === 'company-rep' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
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
                            {t.team_central_contact_name || (isEn ? "Displayed Representative Name" : "Megjelenített képviseleti név")}
                          </label>
                          <input
                            type="text"
                            value={companyRepName}
                            onChange={(e) => setCompanyRepName(e.target.value)}
                            placeholder="Kovács János közös képviselő"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
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

                  {/* Transactional Email & Custom Reply-To Settings */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-bold">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">
                          {t.settings_email_section_title || "Tranzakciós E-mail Küldés & Válaszcím (Reply-To)"}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {t.settings_email_section_desc || "Állíts be egy tetszőleges e-mail címet (pl. a személyes Gmail fiókodat), ahová a munkatársak és lakók válaszai közvetlenül megérkeznek, és kapcsold be a modern gombos e-mailek automatikus kiküldését."}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 text-xs">
                      {/* Highlighted Reply-To input (KK's personal / office reply email) */}
                      <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1.5">
                        <label className="block text-xs font-bold text-[#1E3A8A]">
                          {t.settings_email_reply_to_label || "Saját válasz e-mail cím (Reply-To)"}
                        </label>
                        <input
                          type="email"
                          value={emailReplyTo}
                          onChange={(e) => setEmailReplyTo(e.target.value)}
                          placeholder={t.settings_email_reply_to_placeholder || "pl. sajat.iroda@gmail.com"}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-blue-300 bg-white text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] text-xs"
                        />
                        <span className="text-[11px] text-blue-900/80 block leading-relaxed">
                          {t.settings_email_reply_to_hint || "Erre a címre érkeznek meg a válaszok, amikor a meghívott munkatárs vagy lakó a saját levelezőjében a 'Válasz' (Reply) gombra kattint."}
                        </span>
                      </div>

                      {/* Provider selection: Resend vs Brevo */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                          {t.settings_email_provider_label || "Tranzakciós e-mail szolgáltató"}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setEmailProvider('resend')}
                            className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                              emailProvider === 'resend'
                                ? 'border-[#1E3A8A] bg-blue-50/70 text-[#1E3A8A] font-bold shadow-2xs'
                                : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 font-medium'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold">Resend</div>
                              <div className="text-[10px] text-gray-500">{t.settings_email_provider_resend || "Havi 3 000 ingyenes levél"}</div>
                            </div>
                            {emailProvider === 'resend' && <Check className="w-4 h-4 text-[#1E3A8A]" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => setEmailProvider('brevo')}
                            className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                              emailProvider === 'brevo'
                                ? 'border-[#1E3A8A] bg-blue-50/70 text-[#1E3A8A] font-bold shadow-2xs'
                                : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 font-medium'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold">Brevo</div>
                              <div className="text-[10px] text-gray-500">{t.settings_email_provider_brevo || "Napi 300 ingyenes levél"}</div>
                            </div>
                            {emailProvider === 'brevo' && <Check className="w-4 h-4 text-[#1E3A8A]" />}
                          </button>
                        </div>
                      </div>

                      {/* API Key Input with visibility toggle */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-gray-700">
                            {t.settings_email_api_key_label || "Szolgáltató API kulcs"}
                          </label>
                          <a
                            href={emailProvider === 'resend' ? "https://resend.com/api-keys" : "https://app.brevo.com/settings/keys/api"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#1E3A8A] hover:underline flex items-center gap-1 font-semibold"
                          >
                            <span>{t.settings_email_api_key_help || "Ingyenes kulcs beszerzése:"} {emailProvider === 'resend' ? "resend.com" : "brevo.com"}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="relative">
                          <input
                            type={showEmailApiKey ? "text" : "password"}
                            value={emailApiKey}
                            onChange={(e) => setEmailApiKey(e.target.value)}
                            placeholder={emailProvider === 'resend' ? "re_123456789..." : "xkeysib-..."}
                            className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowEmailApiKey(!showEmailApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer p-1"
                            title={showEmailApiKey ? (isEn ? "Hide API key" : "Kulcs elrejtése") : (isEn ? "Show API key" : "Kulcs megjelenítése")}
                          >
                            {showEmailApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Optional Sender Name and Custom From Email */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            {t.settings_email_sender_name_label || "Megjelenő feladó neve (opcionális)"}
                          </label>
                          <input
                            type="text"
                            value={emailSenderName}
                            onChange={(e) => setEmailSenderName(e.target.value)}
                            placeholder="TarsasApp"
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            {t.settings_email_sender_email_label || "Egyedi küldő e-mail cím (opcionális)"}
                          </label>
                          <input
                            type="text"
                            value={emailSenderEmail}
                            onChange={(e) => setEmailSenderEmail(e.target.value)}
                            placeholder={emailProvider === 'resend' ? "onboarding@resend.dev" : "noreply@tarsasapp.hu"}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                          />
                        </div>
                      </div>

                      {/* Status Feedback banner if test was run */}
                      {testEmailStatus && (
                        <div
                          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                            testEmailStatus.success
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-red-50 text-red-800 border border-red-200'
                          }`}
                        >
                          {testEmailStatus.success ? <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                          <span className="truncate">{testEmailStatus.message}</span>
                        </div>
                      )}

                      {/* Action buttons: Save & Send Test */}
                      <div className="flex flex-wrap items-center gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={handleSaveEmailSettings}
                          className="px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{t.settings_email_save_btn || "E-mail beállítások mentése"}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSendingTestEmail || !emailApiKey.trim()}
                          onClick={handleSendTestEmail}
                          className="px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isSendingTestEmail ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1E3A8A]" />
                          ) : (
                            <Send className="w-3.5 h-3.5 text-[#1E3A8A]" />
                          )}
                          <span>{t.settings_email_test_btn || "Teszt e-mail küldése"}</span>
                        </button>
                      </div>
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
