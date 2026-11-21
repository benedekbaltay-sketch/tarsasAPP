import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Users,
  UserPlus,
  Building2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Check,
  Copy,
  Link2,
  Search,
  Edit3,
  PauseCircle,
  PlayCircle,
  Trash2,
  ArrowRightLeft,
  Lock,
  Landmark,
  Crown,
  Clock,
  Mail,
  Phone,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { useBackdropClose } from '../../utils/useBackdropClose';
import {
  resolveUserOrgContext,
  getAccessibleBuildings,
  canUserManageTeam,
  canActorManageTargetMember,
  normalizeEmail,
} from '../../utils/teamPermissions';
import { formatPhoneNumber } from '../../utils/phone';

export function TeamManagementModal({ isOpen, onClose }) {
  const {
    state,
    t,
    showToast,
    inviteOrAttachTeamMember,
    updateTeamMember,
    toggleTeamMemberActive,
    removeTeamMember,
    handoverMemberBuildings,
    revokeTeamInvite,
    updateOrganizationSettings,
  } = useApp();

  const { currentUser, currentLang, buildings, organizations, repProfile } = state;
  const isEn = currentLang === 'en';
  const isHu = !isEn;

  const backdropProps = useBackdropClose(onClose);

  const orgCtx = useMemo(
    () => resolveUserOrgContext(currentUser, organizations, buildings),
    [currentUser, organizations, buildings]
  );

  const canManage = useMemo(
    () => canUserManageTeam(currentUser, organizations, buildings),
    [currentUser, organizations, buildings]
  );

  const orgBuildings = useMemo(
    () => getAccessibleBuildings(currentUser, buildings || [], organizations || []),
    [currentUser, buildings, organizations]
  );

  // Active sub-tab: 'members' | 'invite' | 'company'
  const [activeTab, setActiveTab] = useState('members');

  // Invite / Edit form state
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formScope, setFormScope] = useState('selected'); // 'all' | 'selected'
  const [formBuildingIds, setFormBuildingIds] = useState([]);
  const [buildingSearch, setBuildingSearch] = useState('');
  const [permCreateBuildings, setPermCreateBuildings] = useState(false);
  const [permManageTeam, setPermManageTeam] = useState(false);
  const [permEditBankAccounts, setPermEditBankAccounts] = useState(false);

  // Latest generated invite URL banner
  const [generatedInviteBanner, setGeneratedInviteBanner] = useState(null); // { email, url }
  const [copiedInviteKey, setCopiedInviteKey] = useState(null);

  // Handover dialog state
  const [handoverFromMember, setHandoverFromMember] = useState(null);
  const [handoverTargetId, setHandoverTargetId] = useState('');

  // Remove member confirmation state
  const [removeTargetMember, setRemoveTargetMember] = useState(null);
  const [resetPersonalContactsOnRemove, setResetPersonalContactsOnRemove] = useState(true);

  // Company central contact form (Owner only)
  const [orgName, setOrgName] = useState('');
  const [centralName, setCentralName] = useState('');
  const [centralPhone, setCentralPhone] = useState('');
  const [centralEmail, setCentralEmail] = useState('');
  const [centralHours, setCentralHours] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab('members');
      setEditingMemberId(null);
      setGeneratedInviteBanner(null);
      setHandoverFromMember(null);
      setRemoveTargetMember(null);

      const org = orgCtx.org;
      setOrgName(org?.name || repProfile?.companyName || repProfile?.name || currentUser?.name || '');
      setCentralName(org?.centralContact?.name || repProfile?.companyName || repProfile?.name || '');
      setCentralPhone(org?.centralContact?.phone || repProfile?.phone || '');
      setCentralEmail(org?.centralContact?.email || repProfile?.email || currentUser?.email || '');
      setCentralHours(org?.centralContact?.officeHours || repProfile?.officeHours || '');
    }
  }, [isOpen, orgCtx.org?.id]);

  if (!isOpen || !currentUser || !canManage) return null;

  const members = Array.isArray(orgCtx.org?.members) ? orgCtx.org.members : [];
  const ownerMember = members.find((m) => m && m.orgRole === 'owner') || {
    id: 'owner-implicit',
    email: orgCtx.ownerEmail || currentUser.email,
    name: orgCtx.org?.ownerName || currentUser.name || currentUser.email,
    orgRole: 'owner',
    active: true,
    buildingScope: 'all',
  };
  const staffMembers = members.filter((m) => m && m.orgRole !== 'owner');
  const pendingInvites = (orgCtx.org?.invites || []).filter((inv) => inv && inv.status === 'pending');

  const filteredOrgBuildings = orgBuildings.filter((b) => {
    const q = buildingSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (b.name || '').toLowerCase().includes(q) ||
      (b.address || '').toLowerCase().includes(q)
    );
  });

  const resetInviteForm = () => {
    setEditingMemberId(null);
    setFormEmail('');
    setFormName('');
    setFormScope('selected');
    setFormBuildingIds([]);
    setBuildingSearch('');
    setPermCreateBuildings(false);
    setPermManageTeam(false);
    setPermEditBankAccounts(false);
  };

  const openNewInviteForm = () => {
    resetInviteForm();
    setActiveTab('invite');
  };

  const openEditMemberForm = (member) => {
    setEditingMemberId(member.id);
    setFormEmail(member.email || '');
    setFormName(member.name || '');
    setFormScope(member.buildingScope === 'all' ? 'all' : 'selected');
    setFormBuildingIds(Array.isArray(member.buildingIds) ? [...member.buildingIds] : []);
    setBuildingSearch('');
    setPermCreateBuildings(Boolean(member.permissions?.canCreateBuildings));
    setPermManageTeam(Boolean(member.permissions?.canManageTeam));
    setPermEditBankAccounts(Boolean(member.permissions?.canEditBankAccounts));
    setActiveTab('invite');
  };

  const toggleBuildingSelection = (bId) => {
    setFormBuildingIds((prev) =>
      prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId]
    );
  };

  const handleSaveMember = (e) => {
    e.preventDefault();
    const permissionsPayload = {
      canCreateBuildings: permCreateBuildings,
      canManageTeam: permManageTeam,
      canEditBankAccounts: permEditBankAccounts,
    };

    if (editingMemberId) {
      const ok = updateTeamMember(editingMemberId, {
        name: formName,
        buildingScope: formScope,
        buildingIds: formBuildingIds,
        permissions: permissionsPayload,
      });
      if (ok) {
        resetInviteForm();
        setActiveTab('members');
      }
      return;
    }

    const res = inviteOrAttachTeamMember({
      email: formEmail,
      name: formName,
      buildingScope: formScope,
      buildingIds: formBuildingIds,
      permissions: permissionsPayload,
    });

    if (res?.success) {
      setGeneratedInviteBanner({
        email: res.member?.email || formEmail,
        url: res.inviteUrl,
      });
      resetInviteForm();
      setActiveTab('members');
    }
  };

  const handleCopyText = (text, key) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedInviteKey(key);
      showToast(isEn ? 'Invite link copied to clipboard!' : 'Meghívó link a vágólapra másolva!');
      setTimeout(() => setCopiedInviteKey(null), 2200);
    });
  };

  const handleConfirmHandover = () => {
    if (!handoverFromMember || !handoverTargetId) return;
    const ok = handoverMemberBuildings(handoverFromMember.id, handoverTargetId);
    if (ok) {
      setHandoverFromMember(null);
      setHandoverTargetId('');
    }
  };

  const handleConfirmRemove = () => {
    if (!removeTargetMember) return;
    const ok = removeTeamMember(removeTargetMember.id, {
      resetPersonalContacts: resetPersonalContactsOnRemove,
    });
    if (ok) {
      setRemoveTargetMember(null);
    }
  };

  const handleSaveCompanySettings = (e) => {
    e.preventDefault();
    updateOrganizationSettings({
      name: orgName,
      centralContact: {
        name: centralName.trim(),
        phone: formatPhoneNumber(centralPhone),
        email: centralEmail.trim(),
        officeHours: centralHours.trim(),
      },
    });
  };

  // Buildings displaying a given member's personal contact
  const getPersonalContactBuildingsForEmail = (email) => {
    const clean = normalizeEmail(email);
    if (!clean) return [];
    return orgBuildings.filter(
      (b) =>
        b.contactDisplayMode === 'manager' &&
        normalizeEmail(b.managerContact?.email) === clean
    );
  };

  const canGrantCreate = orgCtx.isOwner || orgCtx.isSuperAdmin || orgCtx.permissions.canCreateBuildings;
  const canGrantManageTeam = orgCtx.isOwner || orgCtx.isSuperAdmin || orgCtx.permissions.canManageTeam;
  const canGrantEditBank = orgCtx.isOwner || orgCtx.isSuperAdmin || orgCtx.permissions.canEditBankAccounts;

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://tarsashaz-cfe5d.web.app';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn cursor-default"
      {...backdropProps}
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 px-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 font-display truncate">
                {t.team_modal_title || (isEn ? 'Team & Access Permissions' : 'Csapat & Jogosultságok')}
              </h3>
              <p className="text-xs text-gray-500 truncate">
                {t.team_modal_subtitle || (
                  isEn
                    ? 'Attach colleagues by email, assign condominiums, and manage security permissions.'
                    : 'Munkatársak e-mail csatolása, társasházak kiosztása és jogosultságok kezelése.'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
            title={t.close || (isEn ? 'Close' : 'Bezárás')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Navigation Tabs */}
        <div className="px-5 pt-3 pb-2.5 border-b border-gray-100 bg-gray-50/40 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('members');
                setEditingMemberId(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'members'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t.team_tab_members || (isEn ? 'Team Members' : 'Munkatársak')}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'members' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {1 + staffMembers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={openNewInviteForm}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'invite'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>
                {editingMemberId
                  ? (t.team_tab_edit_member || (isEn ? 'Edit Colleague' : 'Munkatárs szerkesztése'))
                  : (t.team_tab_invite || (isEn ? 'Attach / Invite Colleague' : 'Munkatárs csatolása'))}
              </span>
            </button>

            {(orgCtx.isOwner || orgCtx.isSuperAdmin) && (
              <button
                type="button"
                onClick={() => setActiveTab('company')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'company'
                    ? 'bg-[#1E3A8A] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{t.team_tab_company || (isEn ? 'Company Info' : 'Céges elérhetőség')}</span>
              </button>
            )}
          </div>

          {activeTab === 'members' && (
            <button
              type="button"
              onClick={openNewInviteForm}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t.team_invite_btn || (isEn ? '+ Attach Email' : '+ E-mail csatolása')}</span>
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Generated Invite Link Banner */}
          {generatedInviteBanner && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2 animate-fadeIn">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <Link2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    {t.team_invite_ready_title || (
                      isEn
                        ? `Invite link ready for ${generatedInviteBanner.email}`
                        : `Meghívó link elkészült: ${generatedInviteBanner.email}`
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setGeneratedInviteBanner(null)}
                  className="text-emerald-700 hover:text-emerald-900 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-emerald-800">
                {t.team_invite_ready_desc || (
                  isEn
                    ? 'Send this single-use 7-day invite link to your colleague. Only the matching email address can accept it.'
                    : 'Küldd el ezt a 7 napig érvényes, e-mail címhez kötött linket a munkatársnak. A fiókját azonnal a kijelölt házakkal látja majd.'
                )}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedInviteBanner.url}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-[11px] font-mono text-gray-800 select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopyText(generatedInviteBanner.url, 'banner')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                >
                  {copiedInviteKey === 'banner' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isEn ? 'Copy' : 'Másolás'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 1: MEMBERS & PENDING INVITES                               */}
          {/* ============================================================== */}
          {activeTab === 'members' && (
            <div className="space-y-5">
              {/* Security Summary Strip */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#1E3A8A] flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-700 leading-relaxed">
                  <b className="text-[#1E3A8A]">
                    {t.team_security_banner_title || (isEn ? 'Owner-Protected Security Model:' : 'Tulajdonosi védelmi modell:')}
                  </b>{' '}
                  {t.team_security_banner_desc || (
                    isEn
                      ? 'Colleagues fully manage their assigned buildings, but only the Owner can delete condominiums. Bank account numbers stay locked unless explicitly enabled—and any change always sends a highlighted red alert to the Owner.'
                      : 'A munkatársak teljes körűen kezelhetik a rájuk bízott társasházakat, de házat kizárólag a tulajdonos törölhet. A bankszámlaszám alapból zárolt, és ha engedélyezve is van, minden módosításról kiemelt piros értesítést kap a tulajdonos.'
                  )}
                </div>
              </div>

              {/* Owner Card (Locked at top) */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  {t.team_owner_section || (isEn ? 'Organization Owner' : 'Szervezet tulajdonosa')}
                </span>
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border border-blue-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                      <Crown className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-xs">{ownerMember.name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#1E3A8A] text-white text-[10px] font-bold">
                          {t.team_role_owner || (isEn ? 'Owner' : 'Tulajdonos')}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">{ownerMember.email}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-lg bg-white border border-blue-200 text-[#1E3A8A] text-[10px] font-bold">
                      {isEn ? `All buildings (${orgBuildings.length})` : `Összes ház (${orgBuildings.length})`}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-white border border-blue-200 text-emerald-700 text-[10px] font-bold">
                      {isEn ? 'Full control & Delete' : 'Teljes jogkör & Törlés'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Staff Members List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {t.team_staff_section || (isEn ? 'Attached Colleagues' : 'Csatolt munkatársak')} ({staffMembers.length})
                  </span>
                </div>

                {staffMembers.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 text-center space-y-2">
                    <Users className="w-8 h-8 text-gray-300 mx-auto" />
                    <p className="text-xs font-bold text-gray-700">
                      {t.team_no_staff_title || (isEn ? 'No colleagues attached yet' : 'Még nincs csatolt munkatárs')}
                    </p>
                    <p className="text-[11px] text-gray-500 max-w-md mx-auto">
                      {t.team_no_staff_desc || (
                        isEn
                          ? 'Attach your colleagues by email to delegate condominiums automatically without needing admin support.'
                          : 'Csatolj munkatársakat e-mail cím alapján, és oszd ki nekik a kezelt társasházakat önkiszolgáló módon, külső adminisztráció nélkül.'
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={openNewInviteForm}
                      className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs shadow-xs cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{t.team_invite_first_btn || (isEn ? 'Attach First Colleague' : 'Első munkatárs hozzáadása')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {staffMembers.map((m) => {
                      const isSuspended = m.active === false;
                      const assignedBuildings =
                        m.buildingScope === 'all'
                          ? orgBuildings
                          : orgBuildings.filter((b) => (m.buildingIds || []).includes(b.id));
                      const canEditThis = canActorManageTargetMember(orgCtx, m, null, currentUser.email).allowed;

                      return (
                        <div
                          key={m.id}
                          className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                            isSuspended
                              ? 'bg-gray-50 border-gray-200 opacity-75'
                              : 'bg-white border-gray-200 hover:border-blue-200'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                                  isSuspended
                                    ? 'bg-gray-200 text-gray-500'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                }`}
                              >
                                {(m.name || m.email || '?').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-gray-900 text-xs">{m.name}</span>
                                  {isSuspended ? (
                                    <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                                      {t.team_status_suspended || (isEn ? 'Suspended' : 'Felfüggesztve')}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                      {t.team_status_active || (isEn ? 'Active' : 'Aktív')}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-500 truncate">{m.email}</div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            {canEditThis && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openEditMemberForm(m)}
                                  className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 hover:text-[#1E3A8A] text-gray-600 transition-colors cursor-pointer"
                                  title={t.edit || (isEn ? 'Edit' : 'Szerkesztés')}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {staffMembers.length >= 2 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setHandoverFromMember(m);
                                      const other = staffMembers.find((x) => x.id !== m.id);
                                      setHandoverTargetId(other?.id || '');
                                    }}
                                    className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 transition-colors cursor-pointer"
                                    title={t.team_handover_btn || (isEn ? 'Hand over buildings' : 'Házak átadása másnak')}
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleTeamMemberActive(m.id, isSuspended)}
                                  className={`p-1.5 rounded-lg border border-gray-200 bg-white transition-colors cursor-pointer ${
                                    isSuspended
                                      ? 'hover:bg-emerald-50 hover:text-emerald-700 text-gray-600'
                                      : 'hover:bg-amber-50 hover:text-amber-700 text-gray-600'
                                  }`}
                                  title={
                                    isSuspended
                                      ? (t.team_reactivate_btn || (isEn ? 'Reactivate access' : 'Hozzáférés újraaktiválása'))
                                      : (t.team_suspend_btn || (isEn ? 'Suspend access' : 'Azonnali felfüggesztés'))
                                  }
                                >
                                  {isSuspended ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRemoveTargetMember(m);
                                    setResetPersonalContactsOnRemove(true);
                                  }}
                                  className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-red-50 hover:text-red-600 text-gray-500 transition-colors cursor-pointer"
                                  title={t.delete || (isEn ? 'Remove' : 'Eltávolítás')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Assigned Buildings & Permissions Pills */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-[#1E3A8A] border border-blue-100 text-[10px] font-bold">
                              <Building2 className="w-3 h-3" />
                              {m.buildingScope === 'all'
                                ? (isEn ? `All buildings (${orgBuildings.length})` : `Összes ház (${orgBuildings.length})`)
                                : (isEn ? `${assignedBuildings.length} building(s)` : `${assignedBuildings.length} társasház`)}
                            </span>

                            {m.permissions?.canCreateBuildings && (
                              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold">
                                {t.team_perm_create_short || (isEn ? '+ Create buildings' : '+ Új ház létrehozás')}
                              </span>
                            )}
                            {m.permissions?.canManageTeam && (
                              <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-bold">
                                {t.team_perm_manage_short || (isEn ? 'Manage team' : 'Csapat kezelés')}
                              </span>
                            )}
                            {m.permissions?.canEditBankAccounts ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                                <Landmark className="w-3 h-3" />
                                {t.team_perm_bank_short || (isEn ? 'Edit IBAN (alerts Owner)' : 'Bankszámla módosítás (értesítéssel)')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-semibold">
                                <Lock className="w-2.5 h-2.5" />
                                {t.team_perm_bank_locked_short || (isEn ? 'IBAN locked' : 'Bankszámla zárolt')}
                              </span>
                            )}
                          </div>

                          {/* Preview assigned building names when selected */}
                          {m.buildingScope !== 'all' && assignedBuildings.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {assignedBuildings.slice(0, 5).map((b) => (
                                <span
                                  key={b.id}
                                  className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10px] font-medium truncate max-w-[180px]"
                                >
                                  {b.name}
                                </span>
                              ))}
                              {assignedBuildings.length > 5 && (
                                <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold">
                                  +{assignedBuildings.length - 5}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pending Invites */}
              {pendingInvites.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                    {t.team_pending_invites || (isEn ? 'Pending Invite Links' : 'Függőben lévő meghívó linkek')} ({pendingInvites.length})
                  </span>
                  <div className="space-y-1.5">
                    {pendingInvites.map((inv) => {
                      const invUrl = `${origin}/?invite=${encodeURIComponent(inv.token)}`;
                      return (
                        <div
                          key={inv.id}
                          className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-900 truncate">{inv.email}</div>
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-800">
                              <Clock className="w-3 h-3" />
                              <span>
                                {isEn ? 'Expires:' : 'Lejárat:'}{' '}
                                {inv.expiresAt ? String(inv.expiresAt).slice(0, 10) : '7d'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyText(invUrl, inv.id)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-200 text-amber-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              {copiedInviteKey === inv.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              <span>{isEn ? 'Copy link' : 'Link másolása'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => revokeTeamInvite(inv.id)}
                              className="px-2 py-1 rounded-lg bg-white hover:bg-red-50 border border-gray-200 text-gray-500 hover:text-red-600 font-semibold text-[11px] cursor-pointer"
                            >
                              {t.team_revoke_btn || (isEn ? 'Revoke' : 'Visszavonás')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Inline Handover Panel */}
              {handoverFromMember && (
                <div className="p-4 rounded-xl bg-indigo-50/80 border border-indigo-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                      <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                      <span>
                        {t.team_handover_title || (
                          isEn
                            ? `Hand over buildings from ${handoverFromMember.name}`
                            : `${handoverFromMember.name} házainak átadása`
                        )}
                      </span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setHandoverFromMember(null)}
                      className="text-indigo-500 hover:text-indigo-800 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                      value={handoverTargetId}
                      onChange={(e) => setHandoverTargetId(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-semibold"
                    >
                      {staffMembers
                        .filter((x) => x.id !== handoverFromMember.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name} ({x.email})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleConfirmHandover}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                    >
                      {t.team_handover_confirm || (isEn ? 'Transfer Buildings' : 'Házak átadása')}
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Remove Confirmation (with Personal Contact Reset check!) */}
              {removeTargetMember && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <h4 className="font-bold text-red-950 text-xs">
                        {isEn
                          ? `Remove ${removeTargetMember.name} (${removeTargetMember.email})?`
                          : `Eltávolítod ${removeTargetMember.name} (${removeTargetMember.email}) munkatársat?`}
                      </h4>
                      <p className="text-[11px] text-red-800">
                        {isEn
                          ? 'They will immediately lose access to all company condominiums.'
                          : 'Azonnal elveszíti a hozzáférést az összes céges társasházhoz.'}
                      </p>
                      {getPersonalContactBuildingsForEmail(removeTargetMember.email).length > 0 && (
                        <label className="flex items-start gap-2 pt-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={resetPersonalContactsOnRemove}
                            onChange={(e) => setResetPersonalContactsOnRemove(e.target.checked)}
                            className="mt-0.5 rounded text-red-600"
                          />
                          <span className="text-[11px] font-semibold text-red-950">
                            {isEn
                              ? `Reset resident contact back to central company details on ${getPersonalContactBuildingsForEmail(removeTargetMember.email).length} building(s) showing their personal contact.`
                              : `Állítsa vissza a központi céges elérhetőséget azon a(z) ${getPersonalContactBuildingsForEmail(removeTargetMember.email).length} társasháznál, ahol az ő személyes elérhetősége volt megjelenítve.`}
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRemoveTargetMember(null)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 font-semibold text-xs cursor-pointer"
                    >
                      {t.cancel || (isEn ? 'Cancel' : 'Mégse')}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRemove}
                      className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer"
                    >
                      {t.team_confirm_remove_btn || (isEn ? 'Remove Colleague' : 'Végleges eltávolítás')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: ATTACH / INVITE OR EDIT COLLEAGUE                       */}
          {/* ============================================================== */}
          {activeTab === 'invite' && (
            <form onSubmit={handleSaveMember} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    {t.team_email_label || (isEn ? 'Colleague Email Address' : 'Munkatárs e-mail címe')} *
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      disabled={Boolean(editingMemberId)}
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="kollega@ceg.hu"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A] disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    {t.team_name_label || (isEn ? 'Full Name' : 'Munkatárs neve')}
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={isEn ? 'e.g. Anna Kovács' : 'pl. Kovács Anna'}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                  />
                </div>
              </div>

              {/* Building Scope Assignment */}
              <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#1E3A8A]" />
                    <span>{t.team_buildings_label || (isEn ? 'Assigned Condominiums' : 'Kezelt társasházak kiosztása')}</span>
                  </label>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setFormScope('selected')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                        formScope === 'selected' ? 'bg-[#1E3A8A] text-white' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {t.team_scope_selected || (isEn ? 'Selected Buildings' : 'Kiválasztott házak')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormScope('all')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                        formScope === 'all' ? 'bg-[#1E3A8A] text-white' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {t.team_scope_all || (isEn ? 'All Company Buildings' : 'Minden céges ház')}
                    </button>
                  </div>
                </div>

                {formScope === 'all' ? (
                  <p className="text-[11px] text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                    {isEn
                      ? `This colleague will automatically have full operational management access to all ${orgBuildings.length} current and future company condominiums.`
                      : `Ez a munkatárs automatikusan teljes körű operatív kezelési hozzáférést kap mind a(z) ${orgBuildings.length} jelenlegi és jövőbeli céges társasházhoz.`}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={buildingSearch}
                          onChange={(e) => setBuildingSearch(e.target.value)}
                          placeholder={isEn ? 'Filter buildings...' : 'Házak szűrése...'}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormBuildingIds(orgBuildings.map((b) => b.id))}
                        className="px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-[11px] font-semibold text-gray-700 cursor-pointer"
                      >
                        {isEn ? 'Select all' : 'Összes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormBuildingIds([])}
                        className="px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-[11px] font-semibold text-gray-600 cursor-pointer"
                      >
                        {isEn ? 'Clear' : 'Törlés'}
                      </button>
                    </div>

                    <div className="max-h-44 overflow-y-auto bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                      {filteredOrgBuildings.length === 0 ? (
                        <div className="p-4 text-center text-[11px] text-gray-400">
                          {isEn ? 'No buildings found.' : 'Nem található társasház.'}
                        </div>
                      ) : (
                        filteredOrgBuildings.map((b) => {
                          const checked = formBuildingIds.includes(b.id);
                          return (
                            <label
                              key={b.id}
                              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                                checked ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleBuildingSelection(b.id)}
                                className="w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-gray-900 truncate">{b.name}</div>
                                {b.address && <div className="text-[10px] text-gray-500 truncate">{b.address}</div>}
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Owner-Controlled Security Permissions */}
              <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-3">
                <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-[#1E3A8A]" />
                  <span>{t.team_permissions_title || (isEn ? 'Special Security Permissions' : 'Kiemelt jogosultságok')}</span>
                </h4>

                <div className="space-y-2.5">
                  {/* 1. Create New Buildings */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                      canGrantCreate ? 'cursor-pointer hover:bg-gray-50 border-gray-200' : 'opacity-55 bg-gray-50 border-gray-100 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!canGrantCreate}
                      checked={permCreateBuildings}
                      onChange={(e) => setPermCreateBuildings(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A]"
                    />
                    <div>
                      <div className="font-bold text-gray-900 text-xs">
                        {t.team_perm_create_title || (isEn ? 'Can create new condominiums' : 'Új társasház létrehozása')}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {t.team_perm_create_desc || (
                          isEn
                            ? 'Newly created condominiums automatically belong to your company organization and are visible to the Owner.'
                            : 'A munkatárs által létrehozott új társasházak automatikusan a cég tulajdonába kerülnek, és a tulajdonos is azonnal látja őket.'
                        )}
                      </p>
                    </div>
                  </label>

                  {/* 2. Manage Team */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                      canGrantManageTeam ? 'cursor-pointer hover:bg-gray-50 border-gray-200' : 'opacity-55 bg-gray-50 border-gray-100 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!canGrantManageTeam}
                      checked={permManageTeam}
                      onChange={(e) => setPermManageTeam(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A]"
                    />
                    <div>
                      <div className="font-bold text-gray-900 text-xs">
                        {t.team_perm_manage_title || (isEn ? 'Can invite & assign colleagues' : 'Munkatársak meghívása és házak kiosztása')}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {t.team_perm_manage_desc || (
                          isEn
                            ? 'Allows managing team assignments (e.g. Office Manager), but cannot modify the Owner or grant permissions they lack.'
                            : 'Irodavezetői szerepkör: munkatársak meghívása és házak kiosztása. A tulajdonost nem módosíthatja és nem adhat magasabb jogkört a sajátjánál.'
                        )}
                      </p>
                    </div>
                  </label>

                  {/* 3. Edit Bank Account Numbers (IBAN) — with mandatory red alert warning! */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                      permEditBankAccounts
                        ? 'bg-red-50/70 border-red-200'
                        : canGrantEditBank
                        ? 'cursor-pointer hover:bg-gray-50 border-gray-200'
                        : 'opacity-55 bg-gray-50 border-gray-100 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!canGrantEditBank}
                      checked={permEditBankAccounts}
                      onChange={(e) => setPermEditBankAccounts(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-red-600 focus:ring-red-500"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5 flex-wrap">
                        <span>{t.team_perm_bank_title || (isEn ? 'Can modify bank account numbers (IBAN)' : 'Bankszámlaszámok módosítása')}</span>
                        <span className="px-1.5 py-0.2 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                          {isEn ? 'Owner alerted' : 'Tulajdonosi értesítéssel'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        {t.team_perm_bank_desc || (
                          isEn
                            ? 'Disabled by default for fraud protection. Even when checked, the Owner ALWAYS receives a highlighted pale-red security notification whenever this colleague modifies any bank account number.'
                            : 'Alapértelmezetten zárolt a pénzügyi biztonság érdekében. Ha bepipálod, a tulajdonos akkor is MINDEN bankszámlaszám-módosításról kiemelt, halvány piros biztonsági értesítést kap.'
                        )}
                      </p>
                    </div>
                  </label>

                  {/* 4. Permanent Owner-Only Lock: Delete Buildings */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <Lock className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-700 text-xs">
                        {t.team_perm_delete_locked_title || (isEn ? 'Delete condominiums — Strictly Owner Only' : 'Társasházak törlése — Kizárólag tulajdonosnak')}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t.team_perm_delete_locked_desc || (
                          isEn
                            ? 'Colleagues can never delete condominium buildings. This safeguard cannot be delegated.'
                            : 'Munkatársak semmilyen körülmények között nem törölhetnek társasházat. Ez a védelem nem adható át.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    resetInviteForm();
                    setActiveTab('members');
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  {t.cancel || (isEn ? 'Cancel' : 'Mégse')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {editingMemberId
                      ? (t.save || (isEn ? 'Save Changes' : 'Módosítások mentése'))
                      : (t.team_submit_invite || (isEn ? 'Attach & Generate Invite Link' : 'Csatolás & Meghívó létrehozása'))}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* TAB 3: COMPANY CENTRAL CONTACT (OWNER ONLY)                    */}
          {/* ============================================================== */}
          {activeTab === 'company' && (orgCtx.isOwner || orgCtx.isSuperAdmin) && (
            <form onSubmit={handleSaveCompanySettings} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 text-[11px] text-slate-700">
                {t.team_company_info_desc || (
                  isEn
                    ? 'This central company contact is displayed to residents on every condominium set to "Central Company Contact". Individual buildings can switch to display the assigned building manager\'s own contact inside Building Settings.'
                    : 'Ez a központi céges elérhetőség jelenik meg a lakók felületén minden olyan társasháznál, ahol a „Céges központi elérhetőség” mód aktív. Az egyes házak beállításaiban a ház tényleges kezelője átválthatja saját elérhetőségre.'
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">
                    {t.team_org_name_label || (isEn ? 'Company / Management Name' : 'Cég / Közös Képviselet neve')}
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder={isEn ? 'e.g. Alpha Property Management Ltd.' : 'pl. Alfa Társasházkezelő Kft.'}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    {t.team_central_contact_name || (isEn ? 'Displayed Representative Name' : 'Megjelenített képviseleti név')}
                  </label>
                  <input
                    type="text"
                    value={centralName}
                    onChange={(e) => setCentralName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    {t.team_central_phone || (isEn ? 'Central Phone Number' : 'Központi telefonszám')}
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={centralPhone}
                      onChange={(e) => setCentralPhone(e.target.value)}
                      onBlur={() => setCentralPhone(formatPhoneNumber(centralPhone))}
                      placeholder="+36 30 123 4567"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    {t.team_central_email || (isEn ? 'Central Email' : 'Központi e-mail cím')}
                  </label>
                  <input
                    type="email"
                    value={centralEmail}
                    onChange={(e) => setCentralEmail(e.target.value)}
                    placeholder="iroda@ceg.hu"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    {t.team_office_hours || (isEn ? 'Office Hours (optional)' : 'Ügyfélfogadási idő (opcionális)')}
                  </label>
                  <input
                    type="text"
                    value={centralHours}
                    onChange={(e) => setCentralHours(e.target.value)}
                    placeholder={isEn ? 'Mon–Thu 9:00–16:00' : 'H–Cs 9:00–16:00'}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{t.save || (isEn ? 'Save Company Details' : 'Cégadatok mentése')}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
