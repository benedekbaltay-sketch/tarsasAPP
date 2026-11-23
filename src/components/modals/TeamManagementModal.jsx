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
  ArrowLeft,
  Lock,
  Landmark,
  Crown,
  Clock,
  Mail,
  Phone,
  MapPin,
  AlertTriangle,
  Settings,
  Send,
  Loader2,
  CheckCircle2,
  UserCheck,
  Eye,
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
    resendTeamInviteEmail,
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

  const backdropProps = useBackdropClose(onClose, { enableEscape: false });

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
  const [formPhone, setFormPhone] = useState('');
  const [formScope, setFormScope] = useState('selected'); // 'all' | 'selected'
  const [formBuildingIds, setFormBuildingIds] = useState([]);
  const [formBuildingAssignments, setFormBuildingAssignments] = useState({});
  const [allScopeDefaults, setAllScopeDefaults] = useState({
    role: 'manager',
    canEditBankAccounts: false,
    showManagerContact: false,
    showCentralContact: false,
  });
  const [selectedBuildingConfigTab, setSelectedBuildingConfigTab] = useState('all');
  const [buildingSearch, setBuildingSearch] = useState('');
  const [permCreateBuildings, setPermCreateBuildings] = useState(false);
  const [permManageTeam, setPermManageTeam] = useState(false);
  const [permEditBankAccounts, setPermEditBankAccounts] = useState(false);

  const [copiedInviteKey, setCopiedInviteKey] = useState(null);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [resendingKey, setResendingKey] = useState(null);

  // Handover dialog state
  const [handoverFromMember, setHandoverFromMember] = useState(null);
  const [handoverTargetId, setHandoverTargetId] = useState('');

  // Remove member confirmation state
  const [removeTargetMember, setRemoveTargetMember] = useState(null);
  const [resetPersonalContactsOnRemove, setResetPersonalContactsOnRemove] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('members');
      setEditingMemberId(null);
      setHandoverFromMember(null);
      setRemoveTargetMember(null);
    }
  }, [isOpen, orgCtx.org?.id]);

  // Keyboard Escape listener: close sub-modals first, then main modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (removeTargetMember) {
          e.stopPropagation();
          setRemoveTargetMember(null);
        } else if (handoverFromMember) {
          e.stopPropagation();
          setHandoverFromMember(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, removeTargetMember, handoverFromMember]);

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
    setFormPhone('');
    setFormScope('selected');
    setFormBuildingIds([]);
    setFormBuildingAssignments({});
    setAllScopeDefaults({
      role: 'manager',
      canEditBankAccounts: false,
      showManagerContact: false,
      showCentralContact: false,
    });
    setSelectedBuildingConfigTab('all');
    setBuildingSearch('');
    setPermCreateBuildings(false);
    setPermManageTeam(false);
    setPermEditBankAccounts(false);
  };

  const openNewInviteForm = () => {
    resetInviteForm();
    const initialAssignments = {};
    orgBuildings.forEach((b) => {
      initialAssignments[b.id] = {
        role: 'manager',
        canEditBankAccounts: false,
        showManagerContact: false,
        showCentralContact: Boolean(b.showCentralContactToResidents),
      };
    });
    setAllScopeDefaults({
      role: 'manager',
      canEditBankAccounts: false,
      showManagerContact: false,
      showCentralContact: false,
    });
    setFormBuildingAssignments(initialAssignments);
    setSelectedBuildingConfigTab('all');
    setActiveTab('invite');
  };

  const openEditMemberForm = (member) => {
    setEditingMemberId(member.id);
    setFormEmail(member.email || '');
    setFormName(member.name || '');
    setFormPhone(member.phone || '');
    setFormScope(member.buildingScope === 'all' ? 'all' : 'selected');
    const bIds = Array.isArray(member.buildingIds) ? [...member.buildingIds] : [];
    setFormBuildingIds(bIds);
    setBuildingSearch('');
    setPermCreateBuildings(Boolean(member.permissions?.canCreateBuildings));
    setPermManageTeam(Boolean(member.permissions?.canManageTeam));
    setPermEditBankAccounts(Boolean(member.permissions?.canEditBankAccounts));

    const initialAssignments = {};
    orgBuildings.forEach((b) => {
      const existing = member.buildingAssignments?.[b.id];
      if (existing) {
        initialAssignments[b.id] = {
          role: existing.role === 'viewer' ? 'viewer' : 'manager',
          canEditBankAccounts: Boolean(existing.canEditBankAccounts),
          showManagerContact: Boolean(existing.showManagerContact),
          showCentralContact: Boolean(existing.showCentralContact),
        };
      } else {
        const isManagerHere = b.contactDisplayMode === 'manager' && normalizeEmail(b.managerContact?.email) === normalizeEmail(member.email);
        initialAssignments[b.id] = {
          role: 'manager',
          canEditBankAccounts: Boolean(member.permissions?.canEditBankAccounts),
          showManagerContact: isManagerHere,
          showCentralContact: Boolean(b.showCentralContactToResidents),
        };
      }
    });
    const existingRoles = Object.values(member.buildingAssignments || {}).map((a) => a?.role).filter(Boolean);
    const initialRole = existingRoles.length > 0 && existingRoles.every((r) => r === 'viewer') ? 'viewer' : 'manager';
    setAllScopeDefaults({
      role: initialRole,
      canEditBankAccounts: Boolean(member.permissions?.canEditBankAccounts),
      showManagerContact: false,
      showCentralContact: false,
    });
    setFormBuildingAssignments(initialAssignments);
    setSelectedBuildingConfigTab('all');
    setActiveTab('invite');
  };

  const toggleBuildingSelection = (bId) => {
    setFormBuildingIds((prev) => {
      const exists = prev.includes(bId);
      if (exists) {
        return prev.filter((id) => id !== bId);
      }
      return [...prev, bId];
    });

    setFormBuildingAssignments((prev) => {
      if (prev[bId]) return prev;
      const targetB = orgBuildings.find((b) => b.id === bId);
      return {
        ...prev,
        [bId]: {
          role: allScopeDefaults.role || 'manager',
          canEditBankAccounts: Boolean(allScopeDefaults.canEditBankAccounts || permEditBankAccounts),
          showManagerContact: Boolean(allScopeDefaults.showManagerContact),
          showCentralContact: allScopeDefaults.showCentralContact !== undefined
            ? Boolean(allScopeDefaults.showCentralContact)
            : Boolean(targetB?.showCentralContactToResidents),
        },
      };
    });
  };

  const updateBuildingAssignment = (bId, key, value) => {
    setFormBuildingAssignments((prev) => ({
      ...prev,
      [bId]: {
        role: allScopeDefaults.role || 'manager',
        canEditBankAccounts: false,
        showManagerContact: false,
        showCentralContact: false,
        ...(prev[bId] || {}),
        [key]: value,
      },
    }));
  };

  const copyAssignmentToAllSelected = (sourceBId) => {
    const src = formBuildingAssignments[sourceBId] || {
      role: allScopeDefaults.role || 'manager',
      canEditBankAccounts: false,
      showManagerContact: false,
      showCentralContact: false,
    };
    setFormBuildingAssignments((prev) => {
      const next = { ...prev };
      formBuildingIds.forEach((id) => {
        next[id] = { ...src };
      });
      return next;
    });
    showToast(t.team_copied_assignments || (isEn ? 'Settings copied to all selected buildings!' : 'Beállítások átmásolva az összes kiválasztott házra!'));
  };

  const getActiveAssignment = () => {
    if (formScope === 'all') {
      return {
        role: allScopeDefaults.role || 'manager',
        canEditBankAccounts: Boolean(allScopeDefaults.canEditBankAccounts || permEditBankAccounts),
        showManagerContact: Boolean(allScopeDefaults.showManagerContact),
        showCentralContact: Boolean(allScopeDefaults.showCentralContact),
      };
    }
    const targetBId = selectedBuildingConfigTab !== 'all' ? selectedBuildingConfigTab : (formBuildingIds[0] || null);
    if (!targetBId || !formBuildingAssignments[targetBId]) {
      return {
        role: allScopeDefaults.role || 'manager',
        canEditBankAccounts: Boolean(allScopeDefaults.canEditBankAccounts || permEditBankAccounts),
        showManagerContact: Boolean(allScopeDefaults.showManagerContact),
        showCentralContact: Boolean(allScopeDefaults.showCentralContact),
      };
    }
    if (selectedBuildingConfigTab !== 'all') {
      return formBuildingAssignments[targetBId];
    }
    const first = formBuildingAssignments[targetBId] || {};
    const allSameRole = formBuildingIds.every((id) => (formBuildingAssignments[id]?.role || 'manager') === (first.role || 'manager'));
    const allSameManager = formBuildingIds.every((id) => Boolean(formBuildingAssignments[id]?.showManagerContact) === Boolean(first.showManagerContact));
    const allSameCentral = formBuildingIds.every((id) => Boolean(formBuildingAssignments[id]?.showCentralContact) === Boolean(first.showCentralContact));
    const allSameBank = formBuildingIds.every((id) => Boolean(formBuildingAssignments[id]?.canEditBankAccounts) === Boolean(first.canEditBankAccounts));

    return {
      role: allSameRole ? (first.role || 'manager') : (allScopeDefaults.role || 'manager'),
      showManagerContact: allSameManager ? Boolean(first.showManagerContact) : Boolean(allScopeDefaults.showManagerContact),
      showCentralContact: allSameCentral ? Boolean(first.showCentralContact) : Boolean(allScopeDefaults.showCentralContact),
      canEditBankAccounts: allSameBank ? Boolean(first.canEditBankAccounts) : Boolean(allScopeDefaults.canEditBankAccounts),
    };
  };

  const setUnifiedAssignmentValue = (key, value) => {
    // 1. Always update allScopeDefaults so defaults for any unselected or future building are kept
    setAllScopeDefaults((prev) => ({ ...prev, [key]: value }));

    if (key === 'canEditBankAccounts') {
      setPermEditBankAccounts(Boolean(value));
    }

    // 2. Always update all buildings when editing 'all' or formScope === 'all'
    setFormBuildingAssignments((prev) => {
      const next = { ...prev };
      if (selectedBuildingConfigTab === 'all' || formScope === 'all') {
        const targetIds = formBuildingIds.length > 0 ? formBuildingIds : orgBuildings.map((b) => b.id);
        targetIds.forEach((bId) => {
          next[bId] = {
            role: allScopeDefaults.role || 'manager',
            canEditBankAccounts: false,
            showManagerContact: false,
            showCentralContact: false,
            ...(next[bId] || {}),
            [key]: value,
          };
        });
      } else {
        const targetB = orgBuildings.find((b) => b.id === selectedBuildingConfigTab);
        next[selectedBuildingConfigTab] = {
          role: allScopeDefaults.role || 'manager',
          canEditBankAccounts: false,
          showManagerContact: false,
          showCentralContact: Boolean(targetB?.showCentralContactToResidents),
          ...(next[selectedBuildingConfigTab] || {}),
          [key]: value,
        };
      }
      return next;
    });
  };

  const handleSaveMember = async (e) => {
    e.preventDefault();
    if (isSubmittingInvite) return;
    const permissionsPayload = {
      canCreateBuildings: permCreateBuildings,
      canManageTeam: permManageTeam,
      canEditBankAccounts: permEditBankAccounts,
    };

    // Build finalized per-building assignments payload
    const assignmentsPayload = {};
    if (formScope === 'all') {
      orgBuildings.forEach((b) => {
        assignmentsPayload[b.id] = {
          role: allScopeDefaults.role || 'manager',
          canEditBankAccounts: Boolean(allScopeDefaults.canEditBankAccounts || permEditBankAccounts),
          showManagerContact: Boolean(allScopeDefaults.showManagerContact),
          showCentralContact: Boolean(allScopeDefaults.showCentralContact),
        };
      });
    } else {
      formBuildingIds.forEach((bId) => {
        const item = formBuildingAssignments[bId] || {};
        assignmentsPayload[bId] = {
          role: item.role === 'viewer' ? 'viewer' : 'manager',
          canEditBankAccounts: Boolean(item.canEditBankAccounts),
          showManagerContact: Boolean(item.showManagerContact),
          showCentralContact: Boolean(item.showCentralContact),
        };
      });
    }

    if (editingMemberId) {
      const ok = updateTeamMember(editingMemberId, {
        name: formName,
        phone: formPhone,
        buildingScope: formScope,
        buildingIds: formBuildingIds,
        permissions: permissionsPayload,
        buildingAssignments: assignmentsPayload,
      });
      if (ok) {
        resetInviteForm();
        setActiveTab('members');
      }
      return;
    }

    setIsSubmittingInvite(true);
    try {
      const res = await inviteOrAttachTeamMember({
        email: formEmail,
        name: formName,
        phone: formPhone,
        buildingScope: formScope,
        buildingIds: formBuildingIds,
        permissions: permissionsPayload,
        buildingAssignments: assignmentsPayload,
      });

      if (res?.success) {
        resetInviteForm();
        setActiveTab('members');
      }
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleResendEmail = async (email, token = '', key = '') => {
    if (!resendTeamInviteEmail || resendingKey) return;
    setResendingKey(key || email);
    try {
      await resendTeamInviteEmail(email, token);
    } finally {
      setResendingKey(null);
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

  const currentAssignment = getActiveAssignment();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn cursor-default"
      {...backdropProps}
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 px-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80 flex-shrink-0 gap-3">
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

          <div className="flex items-center gap-2 flex-shrink-0">
            {activeTab === 'members' && (
              <button
                type="button"
                onClick={openNewInviteForm}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                title={isEn ? 'Attach colleague by email and assign permissions' : 'Munkatárs csatolása e-mail címmel és jogosultságok kiosztása'}
              >
                <UserPlus className="w-4 h-4" />
                <span>{t.team_add_colleague_btn || (isEn ? '+ Add Colleague & Assign Rights' : '+ Új munkatárs & Jogosultságok')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
              title={t.close || (isEn ? 'Close' : 'Bezárás')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Back / Mode Bar when inside Invite / Edit form */}
        {activeTab === 'invite' && (
          <div className="px-5 pt-3 pb-2.5 border-b border-gray-100 bg-gray-50/40 flex items-center justify-between gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                resetInviteForm();
                setActiveTab('members');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 hover:text-gray-900 font-bold text-xs transition-all cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4 text-[#1E3A8A]" />
              <span>{t.team_back_to_members || (isEn ? 'Back to Colleagues' : 'Vissza a munkatársakhoz')}</span>
            </button>

            <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              {editingMemberId ? (
                <>
                  <Edit3 className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>{t.team_editing_title || (isEn ? 'Edit Colleague & Permissions' : 'Munkatárs és jogkörök szerkesztése')}</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t.team_new_invite_title || (isEn ? 'Add Colleague & Assign Rights' : 'Új munkatárs hozzáadása & Jogosultságok megadása')}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* ============================================================== */}
          {/* TAB 1: MEMBERS & PENDING INVITES                               */}
          {/* ============================================================== */}
          {activeTab === 'members' && (
            <div className="space-y-5">
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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-[#1E3A8A] border border-blue-200 text-[10px] font-bold">
                      <Building2 className="w-3 h-3" />
                      {isEn ? `All buildings (${orgBuildings.length})` : `Összes ház (${orgBuildings.length})`}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      <Check className="w-3 h-3 text-emerald-600" />
                      {t.team_perm_delete_short || (isEn ? 'Delete buildings' : 'Ház törlése')}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      <Check className="w-3 h-3 text-emerald-600" />
                      {t.team_perm_create_short || (isEn ? '+ Create buildings' : '+ Új ház létrehozás')}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      <Check className="w-3 h-3 text-emerald-600" />
                      {t.team_perm_manage_short || (isEn ? 'Manage team' : 'Csapat kezelés')}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      <Check className="w-3 h-3 text-emerald-600" />
                      {isEn ? 'IBAN edit' : 'Bankszámla módosítás'}
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
                                  disabled={resendingKey === `staff-${m.id}`}
                                  onClick={() => handleResendEmail(m.email, '', `staff-${m.id}`)}
                                  className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 transition-colors cursor-pointer disabled:opacity-50"
                                  title={t.team_resend_email_btn || (isEn ? 'Send / resend password setup email' : 'Jelszóbeállító e-mail küldése / újraküldése')}
                                >
                                  {resendingKey === `staff-${m.id}` ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5" />
                                  )}
                                </button>
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

                          {/* Assigned Buildings & Explicit Permissions Indicator Bar */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-gray-100">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-[#1E3A8A] border border-blue-100 text-[10px] font-bold">
                              <Building2 className="w-3 h-3" />
                              {m.buildingScope === 'all'
                                ? (isEn ? `All buildings (${orgBuildings.length})` : `Összes ház (${orgBuildings.length})`)
                                : (isEn ? `${assignedBuildings.length} building(s)` : `${assignedBuildings.length} társasház`)}
                            </span>

                            {Object.values(m.buildingAssignments || {}).some((a) => a?.showManagerContact) && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold"
                                title={isEn ? 'Colleague contact is visible to residents on assigned buildings' : 'A lakók az ő elérhetőségét látják a kijelölt házakon'}
                              >
                                <UserCheck className="w-3 h-3 text-purple-600" />
                                {isEn ? 'Resident Contact' : 'Lakói kapcsolattartó'}
                              </span>
                            )}

                            {/* 1. Create Buildings Permission */}
                            {m.permissions?.canCreateBuildings ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                <Check className="w-3 h-3 text-emerald-600" />
                                {t.team_perm_create_short || (isEn ? '+ Create buildings' : '+ Új ház létrehozás')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 text-[10px] font-semibold">
                                <Lock className="w-2.5 h-2.5" />
                                {t.team_perm_create_locked_short || (isEn ? 'Create locked' : 'Új ház zárolt')}
                              </span>
                            )}

                            {/* 2. Manage Team Permission */}
                            {m.permissions?.canManageTeam ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                <Check className="w-3 h-3 text-emerald-600" />
                                {t.team_perm_manage_short || (isEn ? 'Manage team' : 'Csapat kezelés')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 text-[10px] font-semibold">
                                <Lock className="w-2.5 h-2.5" />
                                {t.team_perm_manage_locked_short || (isEn ? 'Team locked' : 'Csapat zárolt')}
                              </span>
                            )}

                            {/* 3. Edit Bank Accounts Permission */}
                            {m.permissions?.canEditBankAccounts ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold"
                                title={isEn ? 'Can modify bank account numbers (alerted)' : 'Bankszámlaszámok módosítása (értesítéssel)'}
                              >
                                <Check className="w-3 h-3 text-emerald-600" />
                                {t.team_perm_bank_short || (isEn ? 'Edit IBAN (alerts Owner)' : 'Bankszámla módosítás (értesítéssel)')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 text-[10px] font-semibold">
                                <Lock className="w-2.5 h-2.5" />
                                {t.team_perm_bank_locked_short || (isEn ? 'IBAN locked' : 'Bankszámla zárolt')}
                              </span>
                            )}

                            {/* 4. Delete Buildings (Always Locked for Staff) */}
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 text-[10px] font-semibold"
                              title={t.team_perm_delete_locked_desc || (isEn ? 'Colleagues can never delete condominium buildings.' : 'Munkatársak semmilyen körülmények között nem törölhetnek társasházat.')}
                            >
                              <Lock className="w-2.5 h-2.5" />
                              {t.team_perm_delete_locked_short || (isEn ? 'Delete locked' : 'Ház törlés zárolt')}
                            </span>
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              disabled={resendingKey === `inv-${inv.id}`}
                              onClick={() => handleResendEmail(inv.email, inv.token, `inv-${inv.id}`)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {resendingKey === `inv-${inv.id}` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Send className="w-3 h-3" />
                              )}
                              <span>{t.team_resend_email_short || (isEn ? 'Resend email' : 'E-mail újraküldése')}</span>
                            </button>
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
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: ATTACH / INVITE OR EDIT COLLEAGUE                       */}
          {/* ============================================================== */}
          {activeTab === 'invite' && (
            <form onSubmit={handleSaveMember} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    {t.phone || (isEn ? 'Direct Phone Number' : 'Közvetlen telefonszám')}
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      onBlur={() => setFormPhone(formatPhoneNumber(formPhone))}
                      placeholder="+36 30 123 4567"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                    />
                  </div>
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
                  <div className="bg-white p-3.5 rounded-xl border border-blue-200">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {isEn
                        ? `This colleague will automatically manage all ${orgBuildings.length} company condominiums. Configure operational permissions and resident contact details below in the unified Permissions section.`
                        : `Ez a munkatárs automatikusan mind a(z) ${orgBuildings.length} céges társasházhoz hozzáfér. A kezelői szerepkört, jogosultságokat és a lakóknak megjelenő elérhetőségeket az alábbi kártyákon tudod beállítani.`}
                    </p>
                  </div>
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

                    <div className="max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                      {filteredOrgBuildings.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-400">
                          {isEn ? 'No buildings found.' : 'Nem található társasház.'}
                        </div>
                      ) : (
                        filteredOrgBuildings.map((b) => {
                          const checked = formBuildingIds.includes(b.id);
                          const assignment = formBuildingAssignments[b.id] || {
                            role: 'manager',
                            canEditBankAccounts: false,
                            showManagerContact: false,
                            showCentralContact: Boolean(b.showCentralContactToResidents),
                          };
                          return (
                            <label
                              key={b.id}
                              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                                checked ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleBuildingSelection(b.id)}
                                  className="w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer flex-shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-gray-900 truncate">{b.name}</div>
                                  {b.address && <div className="text-[11px] text-gray-500 truncate">{b.address}</div>}
                                </div>
                              </div>
                              {checked && (
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                      assignment.role === 'viewer'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-blue-100 text-[#1E3A8A]'
                                    }`}
                                  >
                                    {assignment.role === 'viewer'
                                      ? (isEn ? 'Viewer' : 'Megtekintő')
                                      : (isEn ? 'Manager' : 'Kezelő')}
                                  </span>
                                  {assignment.showManagerContact && (
                                    <span
                                      className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800"
                                      title={isEn ? "Colleague contact is visible to residents" : "A lakók az ő elérhetőségét látják"}
                                    >
                                      {isEn ? 'Contact' : 'Kapcsolattartó'}
                                    </span>
                                  )}
                                </div>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Unified Permissions & Visibility Settings Section */}
              <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-[#1E3A8A]" />
                    <span>{t.team_unified_permissions_title || (isEn ? 'Permissions & Resident Visibility' : 'Jogosultságok és lakói megjelenítés')}</span>
                  </h4>

                  {/* Multi-building Scope Switcher Toolbar */}
                  {formScope === 'selected' && formBuildingIds.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-gray-600">
                        {t.team_perm_scope_target_label || (isEn ? 'Target:' : 'Hatókör:')}
                      </span>
                      <select
                        value={selectedBuildingConfigTab}
                        onChange={(e) => setSelectedBuildingConfigTab(e.target.value)}
                        className="px-2.5 py-1 bg-gray-50 hover:bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#1E3A8A] cursor-pointer"
                      >
                        <option value="all">
                          {t.team_perm_scope_all_selected || (isEn ? `🌐 All selected buildings (${formBuildingIds.length})` : `🌐 Minden kiválasztott ház (${formBuildingIds.length} db)`)}
                        </option>
                        {formBuildingIds.map((id) => {
                          const b = orgBuildings.find((x) => x.id === id);
                          return (
                            <option key={id} value={id}>
                              🏢 {b?.name || id}
                            </option>
                          );
                        })}
                      </select>
                      {selectedBuildingConfigTab !== 'all' && (
                        <button
                          type="button"
                          onClick={() => copyAssignmentToAllSelected(selectedBuildingConfigTab)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title={t.team_perm_scope_apply_to_all || (isEn ? 'Apply this building to all selected' : 'Alkalmazás az összes kijelölt házra')}
                        >
                          <Copy className="w-3 h-3" />
                          <span className="hidden sm:inline">{t.team_perm_scope_apply_to_all || (isEn ? 'Apply to all' : 'Összesre alkalmaz')}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Card 1: Role Selector (Manager vs Viewer) */}
                  <div className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-blue-200 transition-all space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#1E3A8A]" />
                          <span>{t.team_role_card_title || (isEn ? 'Operational Permission Level on Condominiums' : 'Kezelői jogosultsági szint a házakon (Szerepkör)')}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {t.team_role_card_desc || (isEn
                            ? 'Choose whether this colleague has full operational editing rights or read-only viewer access on assigned condominiums.'
                            : 'Válaszd ki, hogy a munkatárs teljes körű operatív szerkesztési és könyvelési joggal rendelkezzen a kijelölt ház(ak)on, vagy csak ellenőrző megtekintő legyen.')}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setUnifiedAssignmentValue('role', 'manager')}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                          currentAssignment.role !== 'viewer'
                            ? 'bg-blue-50/70 border-2 border-[#1E3A8A] shadow-xs'
                            : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        <Shield className={`w-4 h-4 mt-0.5 flex-shrink-0 ${currentAssignment.role !== 'viewer' ? 'text-[#1E3A8A]' : 'text-gray-400'}`} />
                        <div>
                          <div className={`font-bold text-xs ${currentAssignment.role !== 'viewer' ? 'text-[#1E3A8A]' : 'text-gray-800'}`}>
                            {t.team_assign_role_manager || (isEn ? 'Full Manager' : 'Teljes kezelő')}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                            {t.team_role_manager_opt || (isEn ? 'Edit, post payments, handle resident balances and documents.' : 'Szerkesztés, könyvelés, lakói adatok és terhelések kezelése.')}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUnifiedAssignmentValue('role', 'viewer')}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                          currentAssignment.role === 'viewer'
                            ? 'bg-amber-50/70 border-2 border-amber-600 shadow-xs'
                            : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        <Eye className={`w-4 h-4 mt-0.5 flex-shrink-0 ${currentAssignment.role === 'viewer' ? 'text-amber-600' : 'text-gray-400'}`} />
                        <div>
                          <div className={`font-bold text-xs ${currentAssignment.role === 'viewer' ? 'text-amber-800' : 'text-gray-800'}`}>
                            {t.team_assign_role_viewer || (isEn ? 'Viewer (Read-only)' : 'Csak megtekintő')}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                            {t.team_role_viewer_opt || (isEn ? 'Read-only access: review balances and reports without editing rights.' : 'Kizárólag olvasási jog — egyenlegek és kimutatások ellenőrzése módosítás nélkül.')}
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Show Colleague Contact to Residents */}
                  <label className="flex items-start gap-3.5 p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(currentAssignment.showManagerContact)}
                      onChange={(e) => setUnifiedAssignmentValue('showManagerContact', e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-[#1E3A8A]" />
                        <span>{t.team_contact_manager_card_title || (isEn ? "Display colleague's contact to residents (Responsible Manager)" : "Az ő adatai jelenjenek meg a lakóknak mint képviselő / kezelő")}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                        {t.team_contact_manager_card_desc || (isEn
                          ? "When enabled, residents will see this colleague's name, phone, and email on their dashboard. If disabled, your company / owner contact remains visible."
                          : "Ha bepipálod, a lakók ezt a munkatársat látják a lakói felületen a ház felelős kezelőjeként (közvetlen név, telefon, e-mail). Ha nincs bepipálva, változatlanul a tulajdonos / központi cég elérhetőségei jelennek meg.")}
                      </p>
                    </div>
                  </label>

                  {/* Card 3: Central Company Escalation Channel */}
                  <label className="flex items-start gap-3.5 p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(currentAssignment.showCentralContact)}
                      onChange={(e) => setUnifiedAssignmentValue('showCentralContact', e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#1E3A8A]" />
                        <span>{t.team_contact_central_card_title || (isEn ? "Show central company details to residents (Escalation & Feedback channel)" : "Központi cégadatok megjelenítése a lakóknak (eszkaláció és visszacsatolás)")}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                        {t.team_contact_central_card_desc || (isEn
                          ? "Displays the company's central office phone and email below the manager's contact so residents have an escalation and quality assurance channel."
                          : "A lakói felületen a felelős házkezelő közvetlen adatai alatt diszkréten megjelenik a cég hivatalos központi telefonszáma és e-mail címe panaszkezelési és minőségbiztosítási eszkalációs csatornaként (visszacsatolási lehetőség a vezetés felé).")}
                      </p>
                    </div>
                  </label>

                  {/* Card 4: Can Edit Bank Accounts (IBAN) */}
                  <label
                    className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-colors ${
                      currentAssignment.canEditBankAccounts
                        ? 'bg-red-50/70 border-red-200'
                        : canGrantEditBank
                        ? 'cursor-pointer hover:bg-gray-50 border-gray-200 bg-white'
                        : 'opacity-55 bg-gray-50 border-gray-100 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!canGrantEditBank}
                      checked={Boolean(currentAssignment.canEditBankAccounts)}
                      onChange={(e) => setUnifiedAssignmentValue('canEditBankAccounts', e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5 flex-wrap">
                        <Landmark className="w-4 h-4 text-[#1E3A8A]" />
                        <span>{t.team_perm_bank_title || (isEn ? 'Can modify bank account numbers (IBAN)' : 'Bankszámlaszámok módosítása')}</span>
                        <span className="px-1.5 py-0.2 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                          {isEn ? 'Owner alerted' : 'Tulajdonosi értesítéssel'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                        {t.team_perm_bank_desc || (isEn
                          ? 'Disabled by default for fraud protection. Even when checked, the Owner ALWAYS receives a highlighted pale-red security notification whenever this colleague modifies any bank account number.'
                          : 'Alapértelmezetten zárolt a pénzügyi biztonság érdekében. Ha bepipálod, a tulajdonos akkor is MINDEN bankszámlaszám-módosításról kiemelt, halvány piros biztonsági értesítést kap.')}
                      </p>
                    </div>
                  </label>

                  {/* Card 5: Create New Buildings */}
                  <label
                    className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-colors ${
                      canGrantCreate ? 'cursor-pointer hover:bg-gray-50 border-gray-200 bg-white' : 'opacity-55 bg-gray-50 border-gray-100 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!canGrantCreate}
                      checked={permCreateBuildings}
                      onChange={(e) => setPermCreateBuildings(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#1E3A8A]" />
                        <span>{t.team_perm_create_title || (isEn ? 'Can create new condominiums' : 'Új társasház létrehozása')}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                        {t.team_perm_create_desc || (isEn
                          ? 'Newly created condominiums automatically belong to your company organization and are visible to the Owner.'
                          : 'A munkatárs által létrehozott új társasházak automatikusan a cég tulajdonába kerülnek, és a tulajdonos is azonnal látja őket.')}
                      </p>
                    </div>
                  </label>

                  {/* Card 6: Manage Team */}
                  <label
                    className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-colors ${
                      canGrantManageTeam ? 'cursor-pointer hover:bg-gray-50 border-gray-200 bg-white' : 'opacity-55 bg-gray-50 border-gray-100 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!canGrantManageTeam}
                      checked={permManageTeam}
                      onChange={(e) => setPermManageTeam(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#1E3A8A]" />
                        <span>{t.team_perm_manage_title || (isEn ? 'Can invite & assign colleagues' : 'Munkatársak meghívása és házak kiosztása')}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                        {t.team_perm_manage_desc || (isEn
                          ? 'Allows managing team assignments (e.g. Office Manager), but cannot modify the Owner or grant permissions they lack.'
                          : 'Irodavezetői szerepkör: munkatársak meghívása és házak kiosztása. A tulajdonost nem módosíthatja és nem adhat magasabb jogkört a sajátjánál.')}
                      </p>
                    </div>
                  </label>

                  {/* Card 7: Permanent Owner-Only Lock: Delete Buildings */}
                  <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <Lock className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-700 text-xs">
                        {t.team_perm_delete_locked_title || (isEn ? 'Delete condominiums — Strictly Owner Only' : 'Társasházak törlése — Kizárólag tulajdonosnak')}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {t.team_perm_delete_locked_desc || (isEn
                          ? 'Colleagues can never delete condominium buildings. This safeguard cannot be delegated.'
                          : 'Munkatársak semmilyen körülmények között nem törölhetnek társasházat. Ez a védelem nem adható át.')}
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
                  disabled={isSubmittingInvite}
                  className="px-5 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] disabled:opacity-60 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {isSubmittingInvite ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingMemberId ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>
                    {isSubmittingInvite
                      ? (isEn ? 'Sending invite email...' : 'Meghívó e-mail küldése...')
                      : editingMemberId
                      ? (t.save || (isEn ? 'Save Changes' : 'Módosítások mentése'))
                      : (t.team_submit_invite || (isEn ? 'Attach & Send Invite Email' : 'Csatolás & Meghívó e-mail küldése'))}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Dedicated Remove Colleague Confirmation Modal Popup */}
      {removeTargetMember && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setRemoveTargetMember(null)}
        >
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-2xs">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-gray-900">
                {t.team_remove_modal_title || (isEn ? 'Remove Colleague' : 'Munkatárs eltávolítása')}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {isEn ? (
                  <>Are you sure you want to remove <b>{removeTargetMember.name}</b> ({removeTargetMember.email})? They will immediately lose access to all company condominiums.</>
                ) : (
                  <>Biztosan el szeretnéd távolítani <b>{removeTargetMember.name}</b> ({removeTargetMember.email}) munkatársat? Azonnal elveszíti a hozzáférést az összes céges társasházhoz.</>
                )}
              </p>
            </div>

            {getPersonalContactBuildingsForEmail(removeTargetMember.email).length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-left">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetPersonalContactsOnRemove}
                    onChange={(e) => setResetPersonalContactsOnRemove(e.target.checked)}
                    className="mt-0.5 rounded text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                  />
                  <span className="text-[11px] font-semibold text-amber-950 leading-snug">
                    {isEn
                      ? `Reset resident contact back to central company details on ${getPersonalContactBuildingsForEmail(removeTargetMember.email).length} condominium(s) showing their personal contact.`
                      : `Állítsa vissza a központi céges elérhetőséget azon a(z) ${getPersonalContactBuildingsForEmail(removeTargetMember.email).length} társasháznál, ahol az ő személyes elérhetősége volt megjelenítve.`}
                  </span>
                </label>
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRemoveTargetMember(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                {t.cancel || (isEn ? 'Cancel' : 'Mégse')}
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-98"
              >
                {t.team_confirm_remove_btn || (isEn ? 'Remove Colleague' : 'Végleges eltávolítás')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
