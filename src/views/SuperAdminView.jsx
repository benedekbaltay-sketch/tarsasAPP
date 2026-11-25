import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { 
  Network, 
  Building, 
  User, 
  Home, 
  Mail, 
  Phone, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  ShieldCheck, 
  GitBranch, 
  Users, 
  Table as TableIcon,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Archive,
  RotateCcw,
  UserPlus,
  Edit3,
  Crown,
  X,
  Loader2,
  Building2
} from 'lucide-react';
import { formatCurrency } from '../utils/finances';
import { formatPhoneNumber } from '../utils/phone';
import { normalizeEmail } from '../utils/teamPermissions';

export function SuperAdminView({ onOpenEditFlatMaster }) {
  const {
    state,
    t,
    actAsUser,
    showToast,
    restoreArchivedBuilding,
    createOrganizationOwner,
    updateOrganizationOwnerEmail,
  } = useApp();
  const { buildings, users, organizations, currentLang } = state;
  const isEn = currentLang === 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('diagram'); // 'diagram' | 'table' | 'owners' | 'archive'
  const [collapsedBranches, setCollapsedBranches] = useState({}); // { [buildingId]: boolean }
  const [copiedId, setCopiedId] = useState(null);

  // Modal states (all rendered via createPortal to document.body)
  const [isCreateOwnerOpen, setIsCreateOwnerOpen] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerCompany, setNewOwnerCompany] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [newOwnerSendEmail, setNewOwnerSendEmail] = useState(true);
  const [isCreatingOwner, setIsCreatingOwner] = useState(false);

  const [editEmailOwner, setEditEmailOwner] = useState(null); // { orgId, email, name }
  const [editEmailValue, setEditEmailValue] = useState('');
  const [editEmailSendAuth, setEditEmailSendAuth] = useState(true);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  const [restoreTargetBuilding, setRestoreTargetBuilding] = useState(null);
  const [restoreSelectedOwnerKey, setRestoreSelectedOwnerKey] = useState('');

  // Lock body scroll & handle Escape when any SuperAdmin modal is open
  const anyModalOpen = Boolean(isCreateOwnerOpen || editEmailOwner || restoreTargetBuilding);
  useEffect(() => {
    if (!anyModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (!isCreatingOwner) setIsCreateOwnerOpen(false);
        if (!isUpdatingEmail) setEditEmailOwner(null);
        setRestoreTargetBuilding(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anyModalOpen, isCreatingOwner, isUpdatingEmail]);

  const activeBuildings = useMemo(
    () => (buildings || []).filter(b => b && !b.archived),
    [buildings]
  );

  const archivedBuildings = useMemo(
    () => (buildings || []).filter(b => b && b.archived),
    [buildings]
  );

  // Build unified list of all Organization Owners (explicit orgs + legacy implicit admin owners)
  const ownersList = useMemo(() => {
    const list = [];
    const seenEmails = new Set();
    const staffEmails = new Set();

    (organizations || []).forEach(org => {
      if (!org) return;
      (org.members || []).forEach(m => {
        if (m && m.orgRole !== 'owner' && m.email) {
          staffEmails.add(normalizeEmail(m.email));
        }
      });
    });

    (organizations || []).forEach(org => {
      if (!org) return;
      const email = normalizeEmail(org.ownerEmail);
      if (email) seenEmails.add(email);
      const orgActiveBuildings = activeBuildings.filter(b =>
        b.organizationId ? b.organizationId === org.id : org.includeLegacyBuildings !== false
      );
      const staffCount = (org.members || []).filter(m => m && m.orgRole !== 'owner').length;
      list.push({
        key: `org:${org.id}`,
        orgId: org.id,
        email: org.ownerEmail || '',
        name: org.ownerName || org.name || org.ownerEmail || 'Tulajdonos',
        companyName: org.name || '',
        phone: org.centralContact?.phone || '',
        buildingCount: orgActiveBuildings.length,
        staffCount,
        isLegacyImplicit: false,
        userObj: {
          id: `owner-${org.id}`,
          name: org.ownerName || org.name || org.ownerEmail || 'Közös Képviselő',
          email: org.ownerEmail || '',
          phone: org.centralContact?.phone || '',
          role: 'admin',
          flatNum: '0',
          orgId: org.id,
          orgRole: 'owner',
          isAdminUser: true,
        },
      });
    });

    // Also include legacy admin users who don't have an org record yet and aren't staff
    (users || []).forEach(u => {
      if (!u || u.role !== 'admin') return;
      const email = normalizeEmail(u.email);
      if (!email || seenEmails.has(email) || staffEmails.has(email)) return;
      seenEmails.add(email);
      const untaggedCount = activeBuildings.filter(b => !b.organizationId).length;
      list.push({
        key: `implicit:${email}`,
        orgId: null,
        email: u.email,
        name: u.name || u.email,
        companyName: '',
        phone: u.phone || '',
        buildingCount: untaggedCount,
        staffCount: 0,
        isLegacyImplicit: true,
        userObj: {
          ...u,
          role: 'admin',
          flatNum: '0',
          isAdminUser: true,
        },
      });
    });

    return list;
  }, [organizations, users, activeBuildings]);

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      showToast(isEn ? "Copied to clipboard!" : "Vágólapra másolva!");
      setTimeout(() => {
        setCopiedId(prev => prev === id ? null : prev);
      }, 2000);
    });
  };

  const toggleBranch = (buildingId) => {
    setCollapsedBranches(prev => ({
      ...prev,
      [buildingId]: !prev[buildingId]
    }));
  };

  const expandAll = () => setCollapsedBranches({});
  const collapseAll = () => {
    const all = {};
    activeBuildings.forEach(b => { all[b.id] = true; });
    setCollapsedBranches(all);
  };

  // Build the hierarchical data tree (active non-archived buildings only)
  const treeData = useMemo(() => {
    return activeBuildings.map(b => {
      // Find the representative (Owner / KK) from organization first, then fallback to users
      const matchedOrg = (organizations || []).find(o => o && (
        (b.organizationId && o.id === b.organizationId) ||
        (!b.organizationId && o.includeLegacyBuildings !== false)
      ));
      const repUser = matchedOrg
        ? {
            id: `org-rep-${matchedOrg.id}`,
            name: matchedOrg.ownerName || matchedOrg.name || b.repName || 'Közös Képviselő',
            email: matchedOrg.ownerEmail || b.email || '',
            phone: matchedOrg.centralContact?.phone || b.phone || '',
            role: 'admin',
            flatNum: '0',
            orgId: matchedOrg.id,
            orgRole: 'owner',
            buildingId: b.id,
          }
        : ((users || []).find(u =>
            u.role === 'admin' && (u.buildingId === b.id || (!u.buildingId && b.id === (activeBuildings?.[0]?.id)))
          ) || {
            id: `rep-${b.id}`,
            name: b.repName || 'Közös Képviselő',
            email: b.email || 'kk@tarsashaz.hu',
            phone: b.phone || '',
            role: 'admin',
            buildingId: b.id
          });

      // Format flat nodes with ALL associated emails
      const flats = (b.flats || []).map(f => {
        // Collect all distinct emails for this flat
        const emailSet = new Set();
        if (f.email && f.email.trim()) emailSet.add(f.email.trim());
        if (Array.isArray(f.owners)) {
          f.owners.forEach(o => {
            if (o.email && o.email.trim()) emailSet.add(o.email.trim());
            if (Array.isArray(o.emails)) {
              o.emails.forEach(em => {
                if (em && em.trim()) emailSet.add(em.trim());
              });
            }
          });
        }
        const allEmails = Array.from(emailSet);

        // Collect all phones
        const phoneSet = new Set();
        if (f.phone && f.phone.trim()) phoneSet.add(f.phone.trim());
        if (Array.isArray(f.owners)) {
          f.owners.forEach(o => {
            if (o.phone && o.phone.trim()) phoneSet.add(o.phone.trim());
            if (Array.isArray(o.phones)) {
              o.phones.forEach(ph => {
                if (ph && ph.trim()) phoneSet.add(ph.trim());
              });
            }
          });
        }
        const allPhones = Array.from(phoneSet);

        // Owner names string
        let ownerNames = f.ownerName || '-';
        if (Array.isArray(f.owners) && f.owners.length > 0) {
          ownerNames = f.owners.map(o => o.share ? `${o.name} (${o.share})` : o.name).join(', ');
        }

        // Resident user object for impersonation
        const residentUser = {
          id: f.flatNum,
          name: f.owners?.[0]?.name || f.ownerName || `${f.flatNum}. lakó`,
          email: allEmails[0] || f.email || '',
          role: 'Owner',
          flatNum: f.flatNum,
          buildingId: b.id
        };

        return {
          flatNum: f.flatNum,
          rawFlat: f,
          ownerNames,
          allEmails,
          allPhones,
          balance: f.balance || 0,
          renovationBalance: f.renovationBalance || 0,
          monthlyFee: f.monthlyFee || 0,
          renovationFee: f.renovationFee || 0,
          tenantCount: f.tenantCount || 1,
          residentUser
        };
      });

      return {
        buildingId: b.id,
        buildingName: b.name || 'Társasház',
        buildingAddress: b.address || '',
        repUser,
        flats,
        totalFlats: flats.length,
        reservesCommon: b.buildingInitialReserveCommon || 0,
        reservesRenovation: b.buildingInitialReserveRenovation || 0
      };
    });
  }, [activeBuildings, users, organizations]);

  // Global Statistics
  const stats = useMemo(() => {
    let totalFlats = 0;
    const emailSet = new Set();
    const repEmailSet = new Set();

    treeData.forEach(b => {
      totalFlats += b.totalFlats;
      if (b.repUser?.email) repEmailSet.add(b.repUser.email.toLowerCase().trim());
      b.flats.forEach(f => {
        f.allEmails.forEach(em => emailSet.add(em.toLowerCase().trim()));
      });
    });

    return {
      totalReps: ownersList.length || treeData.length,
      totalBuildings: treeData.length,
      totalArchived: archivedBuildings.length,
      totalFlats,
      totalEmails: emailSet.size + repEmailSet.size
    };
  }, [treeData, ownersList, archivedBuildings]);

  // Filtered tree based on search query
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return treeData;
    const q = searchQuery.toLowerCase().trim();

    return treeData.map(b => {
      const matchRepName = b.repUser?.name?.toLowerCase().includes(q);
      const matchRepEmail = b.repUser?.email?.toLowerCase().includes(q);
      const matchBuildingName = b.buildingName.toLowerCase().includes(q);
      const matchBuildingAddress = b.buildingAddress.toLowerCase().includes(q);

      const matchingFlats = b.flats.filter(f => {
        const matchFlatNum = f.flatNum.toLowerCase().includes(q);
        const matchOwners = f.ownerNames.toLowerCase().includes(q);
        const matchEmail = f.allEmails.some(em => em.toLowerCase().includes(q));
        const matchPhone = f.allPhones.some(ph => ph.replace(/\s+/g, '').includes(q.replace(/\s+/g, '')));
        return matchFlatNum || matchOwners || matchEmail || matchPhone;
      });

      if (matchRepName || matchRepEmail || matchBuildingName || matchBuildingAddress) {
        // If the KK or building matches, include all or matching flats
        return {
          ...b,
          flats: matchingFlats.length > 0 ? matchingFlats : b.flats,
          isExplicitMatch: true
        };
      }

      if (matchingFlats.length > 0) {
        return {
          ...b,
          flats: matchingFlats,
          isExplicitMatch: false
        };
      }

      return null;
    }).filter(Boolean);
  }, [treeData, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 py-6 space-y-6 animate-fadeIn">
      
      {/* Top Banner: SuperAdmin Dashboard Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl border border-indigo-800/30 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-400/30">
              <GitBranch className="w-3.5 h-3.5" />
              <span>{isEn ? "SuperAdmin Control Center" : "Rendszergazda Felügyelet"}</span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold font-display tracking-tight text-white">
              {t.superadmin_title || "Rendszergazda Központ"}
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200/80 max-w-2xl">
              {t.superadmin_subtitle || "Közös képviselők és leágazó albetétek interaktív hierarchia diagramja, teljes körű profil-átvételi lehetőséggel."}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 text-center">
              <span className="block text-[10px] text-indigo-200 uppercase font-bold tracking-wider">{t.total_reps || "Képviselők"}</span>
              <span className="text-base sm:text-lg font-black text-white">{stats.totalReps}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 text-center">
              <span className="block text-[10px] text-indigo-200 uppercase font-bold tracking-wider">{t.total_buildings || "Házak"}</span>
              <span className="text-base sm:text-lg font-black text-white">{stats.totalBuildings}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 text-center">
              <span className="block text-[10px] text-indigo-200 uppercase font-bold tracking-wider">{t.total_all_flats || "Lakások"}</span>
              <span className="text-base sm:text-lg font-black text-amber-300">{stats.totalFlats}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 text-center">
              <span className="block text-[10px] text-indigo-200 uppercase font-bold tracking-wider">{t.total_registered_emails || "E-mailek"}</span>
              <span className="text-base sm:text-lg font-black text-emerald-300">{stats.totalEmails}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar: Live Search, View Toggle, Expand/Collapse */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Live Search Input */}
        <div className="relative flex-1 min-w-[240px] max-w-lg">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search_superadmin_placeholder || "Keresés KK név, ház, lakásszám vagy e-mail alapján..."}
            className="w-full pl-10 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* View mode toggle & collapse/expand */}
        <div className="flex items-center gap-2 flex-wrap">
          {viewMode === 'diagram' && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={expandAll}
                className="px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 cursor-pointer transition-colors"
                title={t.expand_all || "Összes kinyitása"}
              >
                {t.expand_all || "Kinyitás"}
              </button>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 cursor-pointer transition-colors"
                title={t.collapse_all || "Összes becsukása"}
              >
                {t.collapse_all || "Becsukás"}
              </button>
            </div>
          )}

          <div className="inline-flex flex-wrap rounded-xl bg-gray-100 p-1 border border-gray-200 gap-0.5">
            <button
              type="button"
              onClick={() => setViewMode('diagram')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'diagram' ? 'bg-white text-indigo-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>{t.view_diagram || "Diagram"}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-indigo-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>{t.view_table || "Táblázat"}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('owners')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'owners' ? 'bg-white text-indigo-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-600" />
              <span>{t.superadmin_tab_owners || (isEn ? "Owners" : "Tulajdonosok")}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-extrabold">
                {ownersList.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('archive')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'archive' ? 'bg-white text-rose-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Archive className="w-3.5 h-3.5 text-rose-600" />
              <span>{t.superadmin_tab_archive || (isEn ? "Archive" : "Archívum")}</span>
              {archivedBuildings.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 font-extrabold">
                  {archivedBuildings.length}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewOwnerName('');
              setNewOwnerCompany('');
              setNewOwnerEmail('');
              setNewOwnerPhone('');
              setNewOwnerSendEmail(true);
              setIsCreateOwnerOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t.superadmin_create_owner_btn || (isEn ? "+ New Owner" : "+ Új tulajdonos (Owner)")}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area by View Mode */}
      {viewMode === 'owners' ? (
        /* ==================== 3. OWNERS MANAGEMENT VIEW ==================== */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 font-display flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-600" />
                <span>{t.superadmin_owners_title || (isEn ? "Organization Owners" : "Tulajdonosok (Ownerek) kezelése")}</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {t.superadmin_owners_subtitle || (isEn
                  ? "Create new Owners who can build and manage their own condominium portfolios, or update an Owner's email address."
                  : "Új tulajdonosok létrehozása, akik saját társasházakat tudnak felvenni, illetve meglévő tulajdonosok e-mail címének módosítása.")}
              </p>
            </div>
          </div>

          {ownersList.filter(o => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            return (
              (o.name || '').toLowerCase().includes(q) ||
              (o.companyName || '').toLowerCase().includes(q) ||
              (o.email || '').toLowerCase().includes(q)
            );
          }).length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-xs">
              <Crown className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="text-base font-bold text-gray-800 mb-1">
                {isEn ? "No owners found" : "Nem található tulajdonos"}
              </h4>
              <p className="text-xs text-gray-500">
                {isEn ? "Create a new Owner using the green button above." : "Hozz létre új tulajdonost a fenti zöld gombbal."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ownersList
                .filter(o => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase().trim();
                  return (
                    (o.name || '').toLowerCase().includes(q) ||
                    (o.companyName || '').toLowerCase().includes(q) ||
                    (o.email || '').toLowerCase().includes(q)
                  );
                })
                .map(owner => (
                  <div
                    key={owner.key}
                    className="bg-white rounded-2xl border border-gray-200 hover:border-indigo-300 p-5 shadow-xs transition-all flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Crown className="w-5 h-5 text-amber-300" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-gray-900 truncate">{owner.name}</h4>
                            {owner.companyName && owner.companyName !== owner.name && (
                              <p className="text-xs text-gray-500 truncate">{owner.companyName}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            {owner.buildingCount} {isEn ? "condos" : "ház"}
                          </span>
                          {owner.staffCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                              {owner.staffCount} {isEn ? "staff" : "munkatárs"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="inline-flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200 max-w-full">
                          <Mail className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="font-mono font-semibold text-gray-800 truncate">{owner.email}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(owner.email, `owner-em-${owner.key}`)}
                            className="p-0.5 text-gray-400 hover:text-indigo-600 cursor-pointer shrink-0"
                            title={isEn ? "Copy email" : "E-mail másolása"}
                          >
                            {copiedId === `owner-em-${owner.key}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {owner.phone && (
                          <div className="inline-flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
                            <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-semibold text-gray-700">{formatPhoneNumber(owner.phone)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditEmailOwner(owner);
                          setEditEmailValue(owner.email || '');
                          setEditEmailSendAuth(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{t.superadmin_change_email_btn || (isEn ? "Change Email" : "E-mail módosítása")}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => actAsUser(owner.userObj, null)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-200" />
                        <span>{t.superadmin_act_as_owner_btn || (isEn ? "Enter as Owner" : "Belépés Ownerként")}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : viewMode === 'archive' ? (
        /* ==================== 4. ARCHIVED CONDOMINIUMS VIEW ==================== */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 font-display flex items-center gap-2">
                <Archive className="w-5 h-5 text-rose-600" />
                <span>{t.superadmin_archive_title || (isEn ? "Archived (Deleted) Condominiums" : "Archivált (törölt) társasházak")}</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {t.superadmin_archive_subtitle || (isEn
                  ? "Condominiums deleted by Owners are safely preserved here with all flats, finances, and documents. You can restore and assign them to the original owner or transfer them to another owner."
                  : "A tulajdonosok által törölt társasházak minden lakással, könyveléssel és dokumentummal együtt biztonságban megmaradnak itt. Visszaadhatod őket az eredeti tulajdonosnak vagy átadhatod egy másiknak.")}
              </p>
            </div>
          </div>

          {archivedBuildings.filter(b => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            return (
              (b.name || '').toLowerCase().includes(q) ||
              (b.address || '').toLowerCase().includes(q) ||
              (b.archivedFromOwnerEmail || '').toLowerCase().includes(q)
            );
          }).length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-xs">
              <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="text-base font-bold text-gray-800 mb-1">
                {t.superadmin_archive_empty_title || (isEn ? "The archive is currently empty" : "Az archívum jelenleg üres")}
              </h4>
              <p className="text-xs text-gray-500">
                {t.superadmin_archive_empty_desc || (isEn ? "Deleted condominiums will appear here for recovery or transfer." : "A felhasználók által törölt társasházak automatikusan ide kerülnek.")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {archivedBuildings
                .filter(b => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase().trim();
                  return (
                    (b.name || '').toLowerCase().includes(q) ||
                    (b.address || '').toLowerCase().includes(q) ||
                    (b.archivedFromOwnerEmail || '').toLowerCase().includes(q)
                  );
                })
                .map(b => {
                  const archivedDateStr = b.archivedAt ? new Date(b.archivedAt).toLocaleString(isEn ? 'en-US' : 'hu-HU') : '—';
                  const flatCount = (b.flats || []).length;
                  const txCount = (b.transactions || []).length + (b.expenses || []).length;

                  return (
                    <div
                      key={b.id}
                      className="bg-white rounded-2xl border border-rose-200/80 hover:border-rose-300 p-5 shadow-xs transition-all flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-gray-900 truncate">{b.name}</h4>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                  {isEn ? "Archived" : "Archivált"}
                                </span>
                              </div>
                              {b.address && <p className="text-xs text-gray-500 truncate">{b.address}</p>}
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-gray-600">
                            <span>{isEn ? "Previous owner:" : "Korábbi tulajdonos:"}</span>
                            <strong className="text-gray-900 font-semibold truncate max-w-[60%]">
                              {b.archivedFromOwnerName || b.archivedFromOwnerEmail || '—'}
                              {b.archivedFromOwnerEmail && b.archivedFromOwnerName ? ` (${b.archivedFromOwnerEmail})` : ''}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between text-gray-600">
                            <span>{isEn ? "Deleted at:" : "Törlés időpontja:"}</span>
                            <span className="font-medium text-gray-800">{archivedDateStr}</span>
                          </div>
                          <div className="flex items-center justify-between text-gray-600">
                            <span>{isEn ? "Preserved data:" : "Megőrzött adatok:"}</span>
                            <span className="font-bold text-indigo-700">
                              {flatCount} {isEn ? "flats" : "lakás"} • {txCount} {isEn ? "records" : "tétel"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setRestoreTargetBuilding(b);
                            // Pre-select original owner if still in ownersList
                            const origMatch = ownersList.find(
                              o => (b.archivedFromOrgId && o.orgId === b.archivedFromOrgId) ||
                                   (b.archivedFromOwnerEmail && normalizeEmail(o.email) === normalizeEmail(b.archivedFromOwnerEmail))
                            );
                            setRestoreSelectedOwnerKey(origMatch ? origMatch.key : (ownersList[0]?.key || ''));
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{t.superadmin_restore_transfer_btn || (isEn ? "Restore / Transfer to Owner" : "Visszaállítás / Átadás tulajdonosnak")}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      ) : filteredTree.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-xs">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-gray-800 mb-1">
            {isEn ? "No matching records found" : "Nincs találat a megadott feltételekre"}
          </h4>
          <p className="text-xs text-gray-500">
            {isEn ? "Try adjusting your search keywords." : "Próbálja meg módosítani a keresési kifejezést."}
          </p>
        </div>
      ) : viewMode === 'diagram' ? (
        /* ==================== 1. DIAGRAM / TREE VIEW ==================== */
        <div className="space-y-8">
          {filteredTree.map((cluster) => {
            const isCollapsed = Boolean(collapsedBranches[cluster.buildingId]);

            return (
              <div 
                key={cluster.buildingId}
                className="bg-white rounded-3xl border border-indigo-100 shadow-sm p-4 sm:p-6 transition-all"
              >
                {/* ROOT NODE: Condominium Representative (KK) Header Card */}
                <div className="bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-indigo-50/80 rounded-2xl border border-indigo-200/90 p-4 sm:p-5 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    
                    {/* Left: KK & Condominium Info */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-md flex-shrink-0">
                        KK
                      </div>
                      
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-600 text-white shadow-2xs">
                            👑 {isEn ? "Condo Representative" : "Közös Képviselő"}
                          </span>
                          <span className="text-xs font-semibold text-indigo-900 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                            {cluster.totalFlats} {isEn ? "flats" : "albetét"}
                          </span>
                        </div>

                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 font-display leading-tight truncate">
                          {cluster.repUser.name}
                        </h3>

                        {/* Building details */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                          <Building className="w-3.5 h-3.5 text-indigo-700 flex-shrink-0" />
                          <strong className="text-indigo-950 font-bold">{cluster.buildingName}</strong>
                          {cluster.buildingAddress && (
                            <span className="text-gray-500 hidden sm:inline">&bull; {cluster.buildingAddress}</span>
                          )}
                        </div>

                        {/* Contact details: Email & Phone */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1.5 text-xs">
                          {/* KK Email with 1-click copy */}
                          {cluster.repUser.email ? (
                            <div className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-indigo-200/80 shadow-2xs">
                              <Mail className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <a 
                                href={`mailto:${cluster.repUser.email}`} 
                                className="font-semibold text-gray-800 hover:text-indigo-600 hover:underline truncate"
                                title={cluster.repUser.email}
                              >
                                {cluster.repUser.email}
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopy(cluster.repUser.email, `rep-email-${cluster.buildingId}`)}
                                className="p-0.5 rounded text-gray-400 hover:text-indigo-700 cursor-pointer ml-1"
                                title="E-mail cím másolása"
                              >
                                {copiedId === `rep-email-${cluster.buildingId}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">{t.no_emails_recorded}</span>
                          )}

                          {/* KK Phone with dialer link */}
                          {cluster.repUser.phone && (
                            <div className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-indigo-200/80 shadow-2xs">
                              <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <a 
                                href={`tel:${cluster.repUser.phone.replace(/\s+/g, '')}`} 
                                className="font-semibold text-gray-800 hover:text-emerald-700"
                              >
                                {formatPhoneNumber(cluster.repUser.phone)}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Act-as Impersonation Button & Branch Toggle */}
                    <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
                      {/* IMPERSONATION BUTTON */}
                      <button
                        type="button"
                        onClick={() => actAsUser(cluster.repUser, cluster.buildingId)}
                        className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer active:scale-95 group"
                        title={isEn ? "Open representative interface and edit profile" : "Belépés a képviselő felületére"}
                      >
                        <ShieldCheck className="w-4 h-4 text-blue-200 group-hover:scale-110 transition-transform" />
                        <span>{t.act_as_rep || "Belépés KK-ként (Profil módosítása)"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Collapse / Expand Branch Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleBranch(cluster.buildingId)}
                        className="p-2 rounded-xl bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-2xs transition-all cursor-pointer"
                        title={isCollapsed ? "Lakások lenyitása" : "Lakások becsukása"}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                      </button>
                    </div>

                  </div>
                </div>

                {/* BRANCHING CONTAINER: Connecting Tree Spine & Flats Grid */}
                {!isCollapsed && (
                  <div className="relative pl-4 sm:pl-8 pt-4">
                    {/* Vertical Tree Spine Line */}
                    <div className="absolute left-2 sm:left-4 top-0 bottom-6 w-0.5 bg-indigo-200" />

                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{isEn ? "Branching Apartments" : "Leágazó Lakások"} ({cluster.flats.length} {isEn ? "units" : "albetét"})</span>
                      </div>
                    </div>

                    {/* Flats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {cluster.flats.map((flat) => {
                        const isArrears = (flat.balance + flat.renovationBalance) < 0;
                        const isOverpaid = (flat.balance + flat.renovationBalance) > 0;

                        return (
                          <div
                            key={flat.flatNum}
                            className="bg-white rounded-2xl border border-gray-200 hover:border-indigo-300 p-4 shadow-2xs hover:shadow-sm transition-all space-y-3 relative group"
                          >
                            {/* Flat Header: Number & Financial Badge */}
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                  <Home className="w-3.5 h-3.5" />
                                </div>
                                <h4 className="text-sm font-bold text-gray-900 truncate">
                                  {flat.flatNum}. {isEn ? "Flat" : "lakás"}
                                </h4>
                              </div>

                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isArrears ? 'bg-red-50 text-red-700 border-red-200' :
                                isOverpaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {isArrears ? (isEn ? "Arrears" : "Hátralék") :
                                 isOverpaid ? (isEn ? "Overpaid" : "Túlfizetés") :
                                 (isEn ? "Settled" : "Rendezett")}
                              </span>
                            </div>

                            {/* Owner Names */}
                            <div className="text-xs">
                              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">
                                {t.owners_label || "Tulajdonos(ok)"}
                              </span>
                              <p className="font-semibold text-gray-800 line-clamp-2">
                                {flat.ownerNames}
                              </p>
                            </div>

                            {/* ALL ASSOCIATED EMAILS ("ha több van akkor mindegyiket") */}
                            <div className="text-xs space-y-1 bg-gray-50/90 rounded-xl p-2.5 border border-gray-100">
                              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                                {t.all_associated_emails || "Csatolt e-mail címek"} ({flat.allEmails.length}):
                              </span>

                              {flat.allEmails.length > 0 ? (
                                <div className="space-y-1">
                                  {flat.allEmails.map((em, eIdx) => (
                                    <div 
                                      key={eIdx} 
                                      className="flex items-center justify-between gap-1.5 text-[11px] bg-white px-2 py-1 rounded-md border border-gray-200/80 shadow-2xs"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <Mail className="w-3 h-3 text-indigo-500 shrink-0" />
                                        <a 
                                          href={`mailto:${em}`}
                                          className="text-gray-800 hover:text-indigo-600 hover:underline truncate font-medium"
                                          title={em}
                                        >
                                          {em}
                                        </a>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(em, `em-${cluster.buildingId}-${flat.flatNum}-${eIdx}`)}
                                        className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 cursor-pointer shrink-0"
                                        title="Másolás"
                                      >
                                        {copiedId === `em-${cluster.buildingId}-${flat.flatNum}-${eIdx}` ? (
                                          <Check className="w-3 h-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-[11px] block">{t.no_emails_recorded}</span>
                              )}
                            </div>

                            {/* Phone numbers if available */}
                            {flat.allPhones.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-600">
                                <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>{flat.allPhones.map(ph => formatPhoneNumber(ph)).join(', ')}</span>
                              </div>
                            )}

                            {/* Action Buttons: Törzsadatok & Belépés lakóként */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs font-semibold">
                              <button
                                type="button"
                                onClick={() => onOpenEditFlatMaster(cluster.buildingId, flat.flatNum)}
                                className="text-gray-600 hover:text-indigo-700 hover:underline cursor-pointer"
                              >
                                {isEn ? "Master Data" : "Törzsadatok"}
                              </button>

                              <button
                                type="button"
                                onClick={() => actAsUser(flat.residentUser, cluster.buildingId)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg transition-colors cursor-pointer"
                                title={isEn ? "Act as this resident" : "Belépés lakóként"}
                              >
                                <span>{t.act_as_owner || "Belépés lakóként"}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      ) : (
        /* ==================== 2. TABULAR MATRIX VIEW ==================== */
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">{t.rep_building_name || "Társasház"}</th>
                  <th className="py-3 px-4">{isEn ? "Representative" : "Közös Képviselő"}</th>
                  <th className="py-3 px-4">{t.flat_label || "Lakás"}</th>
                  <th className="py-3 px-4">{t.owners_label || "Tulajdonos"}</th>
                  <th className="py-3 px-4">{t.all_associated_emails || "Csatolt e-mail címek"}</th>
                  <th className="py-3 px-4 text-right">{isEn ? "Actions" : "Műveletek"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTree.flatMap(cluster => 
                  cluster.flats.map(flat => (
                    <tr key={`${cluster.buildingId}-${flat.flatNum}`} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-gray-900">
                        {cluster.buildingName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-gray-800 block">{cluster.repUser.name}</span>
                        <span className="text-[11px] text-gray-500">{cluster.repUser.email}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-indigo-700">
                        {flat.flatNum}.
                      </td>
                      <td className="py-3 px-4 text-gray-800">
                        {flat.ownerNames}
                      </td>
                      <td className="py-3 px-4">
                        {flat.allEmails.length > 0 ? (
                          <div className="space-y-0.5">
                            {flat.allEmails.map((em, idx) => (
                              <div key={idx} className="flex items-center gap-1">
                                <span className="font-mono text-[11px] text-gray-700">{em}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(em, `tbl-em-${flat.flatNum}-${idx}`)}
                                  className="text-gray-400 hover:text-indigo-600 cursor-pointer"
                                >
                                  {copiedId === `tbl-em-${flat.flatNum}-${idx}` ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => actAsUser(cluster.repUser, cluster.buildingId)}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded text-[11px] cursor-pointer"
                        >
                          KK profil
                        </button>
                        <button
                          type="button"
                          onClick={() => actAsUser(flat.residentUser, cluster.buildingId)}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded text-[11px] cursor-pointer"
                        >
                          Lakóként
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MODAL 1: CREATE NEW OWNER (Portal) ==================== */}
      {isCreateOwnerOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs cursor-default"
          onClick={() => !isCreatingOwner && setIsCreateOwnerOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-display">
                    {t.superadmin_create_owner_modal_title || (isEn ? "Create New Owner" : "Új tulajdonos (Owner) létrehozása")}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {isEn ? "The new Owner will have their own isolated portfolio to create condominiums." : "Az új tulajdonos saját portfóliót kap, ahol létrehozhatja a házait."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isCreatingOwner}
                onClick={() => setIsCreateOwnerOpen(false)}
                className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (isCreatingOwner) return;
                setIsCreatingOwner(true);
                try {
                  const res = await createOrganizationOwner({
                    email: newOwnerEmail,
                    name: newOwnerName,
                    companyName: newOwnerCompany,
                    phone: newOwnerPhone,
                    sendInviteEmail: newOwnerSendEmail,
                  });
                  if (res?.success) {
                    setIsCreateOwnerOpen(false);
                    setViewMode('owners');
                  }
                } finally {
                  setIsCreatingOwner(false);
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {isEn ? "Owner Email Address *" : "Tulajdonos e-mail címe *"}
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                  placeholder="tulajdonos@ceg.hu"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {isEn ? "Full Name *" : "Teljes név *"}
                </label>
                <input
                  type="text"
                  required
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  placeholder={isEn ? "e.g. John Smith" : "pl. Kovács János"}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {isEn ? "Company / Management Name" : "Cégnév / Közös képviselet neve"}
                </label>
                <input
                  type="text"
                  value={newOwnerCompany}
                  onChange={(e) => setNewOwnerCompany(e.target.value)}
                  placeholder={isEn ? "e.g. Alpha Property Management Ltd." : "pl. Alfa Társasházkezelő Kft."}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {isEn ? "Phone Number" : "Telefonszám"}
                </label>
                <input
                  type="text"
                  value={newOwnerPhone}
                  onChange={(e) => setNewOwnerPhone(e.target.value)}
                  onBlur={() => setNewOwnerPhone(formatPhoneNumber(newOwnerPhone))}
                  placeholder="+36 30 123 4567"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newOwnerSendEmail}
                  onChange={(e) => setNewOwnerSendEmail(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#1E3A8A] cursor-pointer"
                />
                <span className="text-[11px] text-blue-950 leading-snug font-medium">
                  {isEn
                    ? "Automatically provision Firebase login account and send password-setup email to this address."
                    : "Firebase fiók automatikus létrehozása és jelszóbeállító e-mail küldése erre a címre."}
                </span>
              </label>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isCreatingOwner}
                  onClick={() => setIsCreateOwnerOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  {t.cancel || (isEn ? "Cancel" : "Mégse")}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOwner}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isCreatingOwner ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>{isEn ? "Create Owner" : "Tulajdonos létrehozása"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ==================== MODAL 2: CHANGE OWNER EMAIL (Portal) ==================== */}
      {editEmailOwner && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs cursor-default"
          onClick={() => !isUpdatingEmail && setEditEmailOwner(null)}
        >
          <div
            className="bg-white rounded-2xl border border-amber-200 shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-display">
                    {t.superadmin_change_email_modal_title || (isEn ? "Change Owner Email Address" : "Tulajdonos e-mail címének módosítása")}
                  </h3>
                  <p className="text-[11px] text-gray-500 truncate">{editEmailOwner.name}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isUpdatingEmail}
                onClick={() => setEditEmailOwner(null)}
                className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (isUpdatingEmail) return;
                setIsUpdatingEmail(true);
                try {
                  const res = await updateOrganizationOwnerEmail({
                    orgId: editEmailOwner.orgId,
                    oldEmail: editEmailOwner.email,
                    newEmail: editEmailValue,
                    provisionNewAuth: editEmailSendAuth,
                  });
                  if (res?.success) {
                    setEditEmailOwner(null);
                  }
                } finally {
                  setIsUpdatingEmail(false);
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">
                  {isEn ? "Current email:" : "Jelenlegi e-mail cím:"}
                </span>
                <span className="font-mono font-bold text-gray-800">{editEmailOwner.email}</span>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {isEn ? "New Email Address *" : "Új e-mail cím *"}
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={editEmailValue}
                  onChange={(e) => setEditEmailValue(e.target.value)}
                  placeholder="uj.email@ceg.hu"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editEmailSendAuth}
                  onChange={(e) => setEditEmailSendAuth(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#1E3A8A] cursor-pointer"
                />
                <span className="text-[11px] text-amber-950 leading-snug font-medium">
                  {isEn
                    ? "Provision login access & send password-setup email to the new email address."
                    : "Bejelentkezési fiók létrehozása és jelszóbeállító e-mail küldése az új címre."}
                </span>
              </label>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isUpdatingEmail}
                  onClick={() => setEditEmailOwner(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  {t.cancel || (isEn ? "Cancel" : "Mégse")}
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingEmail || !editEmailValue.trim() || normalizeEmail(editEmailValue) === normalizeEmail(editEmailOwner.email)}
                  className="flex-1 py-2.5 bg-[#1E3A8A] hover:bg-[#1e40af] disabled:opacity-40 text-white rounded-xl font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isUpdatingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{isEn ? "Save New Email" : "E-mail mentése"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ==================== MODAL 3: RESTORE / TRANSFER ARCHIVED BUILDING (Portal) ==================== */}
      {restoreTargetBuilding && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs cursor-default"
          onClick={() => setRestoreTargetBuilding(null)}
        >
          <div
            className="bg-white rounded-2xl border border-indigo-200 shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-display">
                    {t.superadmin_restore_modal_title || (isEn ? "Restore / Transfer Condominium" : "Társasház visszaállítása / átadása")}
                  </h3>
                  <p className="text-[11px] text-gray-500 truncate">{restoreTargetBuilding.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreTargetBuilding(null)}
                className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 text-xs text-indigo-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-700" />
                <span>{restoreTargetBuilding.name}</span>
              </div>
              <p className="text-[11px] text-indigo-800">
                {isEn
                  ? "Select which Owner should receive this condominium. You can return it to the original owner or transfer it to any other Owner."
                  : "Válaszd ki, melyik tulajdonos kapja meg ezt a társasházat. Visszaadhatod az eredeti tulajdonosnak, vagy átadhatod egy másik tulajdonosnak is."}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-gray-700">
                {isEn ? "Target Owner *" : "Cél tulajdonos (Owner) *"}
              </label>
              <select
                value={restoreSelectedOwnerKey}
                onChange={(e) => setRestoreSelectedOwnerKey(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#1E3A8A]"
              >
                <option value="">{isEn ? "-- Select Owner --" : "-- Válassz tulajdonost --"}</option>
                {ownersList.map(o => {
                  const isOriginal =
                    (restoreTargetBuilding.archivedFromOrgId && o.orgId === restoreTargetBuilding.archivedFromOrgId) ||
                    (restoreTargetBuilding.archivedFromOwnerEmail && normalizeEmail(o.email) === normalizeEmail(restoreTargetBuilding.archivedFromOwnerEmail));
                  return (
                    <option key={o.key} value={o.key}>
                      {o.name} ({o.email}){isOriginal ? (isEn ? ' — [Original Owner]' : ' — [Eredeti tulajdonos]') : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRestoreTargetBuilding(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                {t.cancel || (isEn ? "Cancel" : "Mégse")}
              </button>
              <button
                type="button"
                disabled={!restoreSelectedOwnerKey}
                onClick={() => {
                  const selectedOwner = ownersList.find(o => o.key === restoreSelectedOwnerKey);
                  if (!selectedOwner) return;
                  const ok = restoreArchivedBuilding(restoreTargetBuilding.id, {
                    orgId: selectedOwner.orgId,
                    ownerEmail: selectedOwner.email,
                    ownerName: selectedOwner.name,
                  });
                  if (ok) {
                    setRestoreTargetBuilding(null);
                    setRestoreSelectedOwnerKey('');
                  }
                }}
                className="flex-1 py-2.5 bg-[#1E3A8A] hover:bg-[#1e40af] disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isEn ? "Restore & Assign" : "Visszaállítás és átadás"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
