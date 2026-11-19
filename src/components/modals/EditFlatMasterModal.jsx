import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Pencil, 
  Save, 
  Home, 
  Key, 
  Plus, 
  Trash2, 
  User, 
  Mail, 
  Phone, 
  Users, 
  Car, 
  Package, 
  Briefcase, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Activity, 
  CreditCard, 
  ShieldCheck, 
  MapPin, 
  Calendar, 
  UserCheck, 
  Hash,
  FileText,
  Building,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Star
} from 'lucide-react';
import { formatPhoneNumber, cleanPhoneNumber } from '../../utils/phone';
import { formatAnnexItem, getNormalizedAnnexList } from '../../utils/annex';
import { useBackdropClose } from '../../utils/useBackdropClose';

/**
 * Parse an ownership share string (e.g. "1/2", "50%", "33.33", "0.5") to a percentage number (0-100).
 */
function parseShareToPercent(shareStr) {
  if (!shareStr) return 0;
  const str = String(shareStr).trim().replace(',', '.');
  if (str.includes('/')) {
    const [num, den] = str.split('/').map(s => parseFloat(s.trim()));
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      return (num / den) * 100;
    }
  }
  const clean = str.replace('%', '').trim();
  const val = parseFloat(clean);
  if (isNaN(val)) return 0;
  if (val > 0 && val <= 1 && !str.includes('%')) {
    return val * 100;
  }
  return val;
}

/**
 * Helper to determine meter expiry status and days remaining
 */
function getExpiryInfo(expiryDateStr) {
  if (!expiryDateStr) return { status: 'none', daysLeft: null };
  const expiry = new Date(expiryDateStr);
  if (isNaN(expiry.getTime())) return { status: 'none', daysLeft: null };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { status: 'expired', daysLeft };
  } else if (daysLeft <= 180) {
    return { status: 'expiring', daysLeft };
  }
  return { status: 'valid', daysLeft };
}

export function EditFlatMasterModal({ buildingId, flatNum, isOpen, onClose }) {
  const { state, t, saveFlatMaster } = useApp();
  const { flats, currentLang } = state;
  const isEn = currentLang === 'en';

  const flat = (flats || []).find(f => f.flatNum === flatNum);

  const isEditMode = true; // Always in interactive edit mode when managing master data
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'owners' | 'meters' | 'annexes'
  const [occupantFilter, setOccupantFilter] = useState('all'); // 'all' | 'owners' | 'tenants'

  // Accordion expanded person IDs
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Tab A: Basic Data
  const [unitType, setUnitType] = useState('flat');
  const [flatCode, setFlatCode] = useState('');
  const [staircase, setStaircase] = useState('');
  const [floor, setFloor] = useState('');
  const [door, setDoor] = useState('');
  const [hrsz, setHrsz] = useState('');
  const [area, setArea] = useState('');
  const [volume, setVolume] = useState('');
  const [ownershipShare, setOwnershipShare] = useState('');
  const [tenantCount, setTenantCount] = useState('1');
  const [paymentCode, setPaymentCode] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [isCompany, setIsCompany] = useState(false);
  const [excludeUtility, setExcludeUtility] = useState(false);
  const [notes, setNotes] = useState('');

  // Tab B: Owners & Tenants
  const [owners, setOwners] = useState([]);
  const [tenants, setTenants] = useState([]);

  // Tab C: Meters
  const [meters, setMeters] = useState([]);

  // Tab D: Annexes
  const [annexes, setAnnexes] = useState([]);

  // Reset / Populate draft fields from flat data
  const resetDraftFields = () => {
    if (!flat) return;

    // Unit Type & Basic
    setUnitType(flat.unitType || 'flat');
    setFlatCode(flat.flatNum || '');
    setStaircase(flat.staircase || '');
    setFloor(flat.floor !== undefined ? String(flat.floor) : '');
    setDoor(flat.door !== undefined ? String(flat.door) : '');
    setHrsz(flat.hrsz || '');
    setArea(flat.area !== undefined ? String(flat.area) : '');
    setVolume(flat.volume !== undefined ? String(flat.volume) : '');
    setOwnershipShare(flat.ownershipShare !== undefined ? String(flat.ownershipShare) : '');
    setTenantCount(String(flat.tenantCount || flat.residents || 1));
    setPaymentCode(flat.paymentCode || flat.utalaskod || flat.flatNum || '');
    setPurchaseDate(flat.purchaseDate || '');
    setSaleDate(flat.saleDate || '');
    setIsCompany(Boolean(flat.isCompany));
    setExcludeUtility(Boolean(flat.excludeUtility));
    setNotes(flat.notes || '');

    // Owners
    if (flat.owners && Array.isArray(flat.owners) && flat.owners.length > 0) {
      setOwners(flat.owners.map((o, idx) => ({
        id: o.id || `owner-${idx}-${Date.now()}`,
        role: o.role || 'owner',
        name: o.name || '',
        share: o.share || '',
        email: o.email || (Array.isArray(o.emails) ? o.emails[0] : '') || '',
        phone: formatPhoneNumber(o.phone || (Array.isArray(o.phones) ? o.phones[0] : '') || ''),
        postalCode: o.postalCode || '',
        city: o.city || '',
        street: o.street || '',
        isPrimaryContact: Boolean(o.isPrimaryContact || idx === 0),
        sendEmailNotification: o.sendEmailNotification !== undefined ? Boolean(o.sendEmailNotification) : true,
        isBoardMember: Boolean(o.isBoardMember),
        bankAccounts: Array.isArray(o.bankAccounts) ? [...o.bankAccounts] : (o.bankAccount ? [o.bankAccount] : [])
      })));
    } else {
      setOwners([{
        id: `owner-0-${Date.now()}`,
        role: 'owner',
        name: flat.ownerName || '',
        share: flat.ownershipShare ? `${flat.ownershipShare}%` : '',
        email: flat.email || '',
        phone: formatPhoneNumber(flat.phone || ''),
        postalCode: flat.postalCode || '',
        city: flat.city || '',
        street: flat.street || '',
        isPrimaryContact: true,
        sendEmailNotification: true,
        isBoardMember: false,
        bankAccounts: flat.bankAccount ? [flat.bankAccount] : []
      }]);
    }

    // Tenants
    if (flat.tenants && Array.isArray(flat.tenants)) {
      setTenants(flat.tenants.map((t, idx) => ({
        id: t.id || `tenant-${idx}-${Date.now()}`,
        name: t.name || '',
        phone: formatPhoneNumber(t.phone || ''),
        email: t.email || '',
        leaseStart: t.leaseStart || '',
        leaseEnd: t.leaseEnd || '',
        isActive: t.isActive !== undefined ? Boolean(t.isActive) : true,
        payerName: t.payerName || '',
        bankAccounts: Array.isArray(t.bankAccounts) ? [...t.bankAccounts] : (t.bankAccount ? [t.bankAccount] : [])
      })));
    } else if (flat.tenantName) {
      setTenants([{
        id: `tenant-0-${Date.now()}`,
        name: flat.tenantName,
        phone: formatPhoneNumber(flat.tenantPhone || ''),
        email: flat.tenantEmail || '',
        leaseStart: flat.leaseStart || '',
        leaseEnd: flat.leaseEnd || '',
        isActive: true,
        payerName: flat.tenantPayerName || '',
        bankAccounts: flat.tenantBankAccount ? [flat.tenantBankAccount] : []
      }]);
    } else {
      setTenants([]);
    }

    // Meters
    if (flat.meters && Array.isArray(flat.meters)) {
      setMeters(flat.meters.map((m, idx) => ({
        id: m.id || `meter-${idx}-${Date.now()}`,
        serialNumber: m.serialNumber || '',
        type: m.type || 'cold_water',
        installDate: m.installDate || '',
        initialReading: m.initialReading !== undefined ? String(m.initialReading) : '',
        currentReading: m.currentReading !== undefined ? String(m.currentReading) : '',
        lastReadingDate: m.lastReadingDate || '',
        expiryDate: m.expiryDate || '',
        removalDate: m.removalDate || '',
        finalReading: m.finalReading !== undefined ? String(m.finalReading) : ''
      })));
    } else {
      setMeters([]);
    }

    // Annexes
    if (flat.annexes && Array.isArray(flat.annexes) && flat.annexes.length > 0) {
      setAnnexes(flat.annexes.map((a, idx) => ({
        id: a.id || `annex-${idx}-${Date.now()}`,
        code: a.code || '',
        name: a.name || '',
        quantity: a.quantity !== undefined ? String(a.quantity) : '1',
        unit: a.unit || 'db'
      })));
    } else {
      const synAnnexes = [];
      const normGarages = getNormalizedAnnexList(flat.garages, false, flat.garageNum);
      const normStorages = getNormalizedAnnexList(flat.storages, true, flat.storageNum);

      normGarages.forEach((g, idx) => {
        if (g.number || g.area) {
          synAnnexes.push({
            id: `annex-g-${idx}-${Date.now()}`,
            code: g.number ? `G-${g.number}` : `G-${idx + 1}`,
            name: isEn ? "Garage / Parking space" : "Garázs / Gépkocsibeálló",
            quantity: g.area ? String(g.area) : '1',
            unit: g.area ? 'm²' : 'db'
          });
        }
      });

      normStorages.forEach((s, idx) => {
        if (s.number || s.area) {
          synAnnexes.push({
            id: `annex-s-${idx}-${Date.now()}`,
            code: s.number ? `T-${s.number}` : `T-${idx + 1}`,
            name: isEn ? "Storage / Cellar" : "Tárolóhelyiség / Pince",
            quantity: s.area ? String(s.area) : '1',
            unit: s.area ? 'm²' : 'db'
          });
        }
      });

      if (flat.terraceArea) {
        synAnnexes.push({
          id: `annex-terrace-${Date.now()}`,
          code: 'TER-1',
          name: isEn ? "Terrace / Balcony" : "Terasz / Erkély",
          quantity: String(flat.terraceArea),
          unit: 'm²'
        });
      }

      setAnnexes(synAnnexes);
    }

    // Reset expanded persons: keep collapsed for clean list overview
    setExpandedIds(new Set());
  };

  const prevFlatKeyRef = useRef('');

  useEffect(() => {
    if (!isOpen || !flat) {
      if (prevFlatKeyRef.current) {
        prevFlatKeyRef.current = '';
      }
      return;
    }

    const currentKey = `${buildingId || ''}-${flatNum || ''}`;
    if (prevFlatKeyRef.current === currentKey) {
      return;
    }
    prevFlatKeyRef.current = currentKey;

    resetDraftFields();
    setActiveTab('basic');
  }, [isOpen, flatNum, buildingId, flat]);

  // Global ESC Key Listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    resetDraftFields();
    onClose();
  };

  const backdropProps = useBackdropClose(handleClose);

  // Active Tenant check for header indicator
  const activeTenant = useMemo(() => {
    return tenants.find(t => t.isActive);
  }, [tenants]);

  // Ownership Shares sum calculation
  const totalOwnerSharePercent = useMemo(() => {
    if (!owners || owners.length === 0) return 0;
    const sum = owners.reduce((acc, o) => acc + parseShareToPercent(o.share), 0);
    return Math.round(sum * 100) / 100;
  }, [owners]);

  // Expired / expiring meters count
  const meterAlertsCount = useMemo(() => {
    return meters.filter(m => {
      const info = getExpiryInfo(m.expiryDate);
      return info.status === 'expired' || info.status === 'expiring';
    }).length;
  }, [meters]);

  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';
  if (!isOpen || !flat || !isAdmin) return null;

  // Unit Type helper config
  const unitTypeConfig = {
    flat: { label: t.unit_type_flat || "Lakás", icon: Home, color: "bg-blue-50 text-blue-700 border-blue-200" },
    garage: { label: t.unit_type_garage || "Garázs / Beálló", icon: Car, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    storage: { label: t.unit_type_storage || "Tároló / Pince", icon: Package, color: "bg-purple-50 text-purple-700 border-purple-200" },
    commercial: { label: t.unit_type_commercial || "Üzlethelyiség / Iroda", icon: Briefcase, color: "bg-amber-50 text-amber-700 border-amber-200" },
    other: { label: t.unit_type_other || "Egyéb", icon: Layers, color: "bg-slate-50 text-slate-700 border-slate-200" }
  };

  const currentTypeCfg = unitTypeConfig[unitType] || unitTypeConfig.flat;
  const CurrentTypeIcon = currentTypeCfg.icon;

  // Accordion toggle helpers
  const togglePersonExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const allIds = [
      ...owners.map(o => o.id),
      ...tenants.map(t => t.id)
    ];
    setExpandedIds(new Set(allIds));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  // Owner modification handlers
  const handleAddOwner = () => {
    const newId = `owner-${Date.now()}`;
    setOwners(prev => [
      ...prev,
      {
        id: newId,
        role: prev.length === 0 ? 'owner' : 'coowner',
        name: '',
        share: '',
        email: '',
        phone: '',
        postalCode: '',
        city: '',
        street: '',
        isPrimaryContact: prev.length === 0,
        sendEmailNotification: true,
        isBoardMember: false,
        bankAccounts: []
      }
    ]);
    // Auto expand newly added owner
    setExpandedIds(prev => new Set(prev).add(newId));
  };

  const handleRemoveOwner = (id) => {
    if (owners.length <= 1) return;
    setOwners(prev => prev.filter(o => o.id !== id));
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleOwnerChange = (id, field, value) => {
    setOwners(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const handleToggleOwnerFlag = (ownerId, field) => {
    setOwners(prev => prev.map(o => {
      if (o.id === ownerId) {
        return { ...o, [field]: !o[field] };
      }
      return o;
    }));
  };

  const handleOwnerAddBankAccount = (ownerId) => {
    setOwners(prev => prev.map(o => {
      if (o.id === ownerId) {
        return {
          ...o,
          bankAccounts: [...(o.bankAccounts || []), '']
        };
      }
      return o;
    }));
  };

  const handleOwnerBankAccountChange = (ownerId, accIdx, value) => {
    setOwners(prev => prev.map(o => {
      if (o.id === ownerId) {
        const nextAccs = [...(o.bankAccounts || [])];
        nextAccs[accIdx] = value;
        return { ...o, bankAccounts: nextAccs };
      }
      return o;
    }));
  };

  const handleOwnerRemoveBankAccount = (ownerId, accIdx) => {
    setOwners(prev => prev.map(o => {
      if (o.id === ownerId) {
        return {
          ...o,
          bankAccounts: (o.bankAccounts || []).filter((_, idx) => idx !== accIdx)
        };
      }
      return o;
    }));
  };

  // Tenant modification handlers
  const handleAddTenant = () => {
    const newId = `tenant-${Date.now()}`;
    setTenants(prev => [
      ...prev,
      {
        id: newId,
        name: '',
        phone: '',
        email: '',
        leaseStart: new Date().toISOString().slice(0, 10),
        leaseEnd: '',
        isActive: true,
        payerName: '',
        bankAccounts: []
      }
    ]);
    // Auto expand newly added tenant
    setExpandedIds(prev => new Set(prev).add(newId));
  };

  const handleRemoveTenant = (id) => {
    setTenants(prev => prev.filter(t => t.id !== id));
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleTenantChange = (id, field, value) => {
    setTenants(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleToggleTenantActive = (tenantId) => {
    setTenants(prev => prev.map(t => {
      if (t.id === tenantId) {
        const nextActive = !t.isActive;
        return {
          ...t,
          isActive: nextActive,
          leaseEnd: !nextActive && !t.leaseEnd ? new Date().toISOString().slice(0, 10) : t.leaseEnd
        };
      }
      return t;
    }));
  };

  const handleTenantAddBankAccount = (tenantId) => {
    setTenants(prev => prev.map(t => {
      if (t.id === tenantId) {
        return {
          ...t,
          bankAccounts: [...(t.bankAccounts || []), '']
        };
      }
      return t;
    }));
  };

  const handleTenantBankAccountChange = (tenantId, accIdx, value) => {
    setTenants(prev => prev.map(t => {
      if (t.id === tenantId) {
        const nextAccs = [...(t.bankAccounts || [])];
        nextAccs[accIdx] = value;
        return { ...t, bankAccounts: nextAccs };
      }
      return t;
    }));
  };

  const handleTenantRemoveBankAccount = (tenantId, accIdx) => {
    setTenants(prev => prev.map(t => {
      if (t.id === tenantId) {
        return {
          ...t,
          bankAccounts: (t.bankAccounts || []).filter((_, idx) => idx !== accIdx)
        };
      }
      return t;
    }));
  };

  const handleCloseTenantLease = (id) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setTenants(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          isActive: false,
          leaseEnd: t.leaseEnd || todayStr
        };
      }
      return t;
    }));
  };

  // Meter modification handlers
  const handleAddMeter = () => {
    setMeters(prev => [
      ...prev,
      {
        id: `meter-${Date.now()}`,
        serialNumber: '',
        type: 'cold_water',
        installDate: new Date().toISOString().slice(0, 10),
        initialReading: '0',
        currentReading: '0',
        lastReadingDate: new Date().toISOString().slice(0, 10),
        expiryDate: '',
        removalDate: '',
        finalReading: ''
      }
    ]);
  };

  const handleRemoveMeter = (id) => {
    setMeters(prev => prev.filter(m => m.id !== id));
  };

  const handleMeterChange = (id, field, value) => {
    setMeters(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  // Annex modification handlers
  const handleAddAnnex = () => {
    setAnnexes(prev => [
      ...prev,
      {
        id: `annex-${Date.now()}`,
        code: '',
        name: '',
        quantity: '1',
        unit: 'db'
      }
    ]);
  };

  const handleRemoveAnnex = (id) => {
    setAnnexes(prev => prev.filter(a => a.id !== id));
  };

  const handleAnnexChange = (id, field, value) => {
    setAnnexes(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  // Save changes
  const handleSave = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // 1. Clean & normalize owners
    const cleanOwners = owners
      .map(o => {
        const cleanEmail = (o.email || '').trim();
        const cleanPhone = formatPhoneNumber((o.phone || '').trim());
        const cleanBankAccs = (o.bankAccounts || [])
          .map(acc => (acc || '').trim())
          .filter(Boolean);

        return {
          id: o.id || `owner-${Date.now()}`,
          role: o.role || 'owner',
          name: (o.name || '').trim(),
          share: (o.share || '').trim(),
          email: cleanEmail,
          emails: cleanEmail ? [cleanEmail] : [],
          phone: cleanPhone,
          phones: cleanPhone ? [cleanPhone] : [],
          postalCode: (o.postalCode || '').trim(),
          city: (o.city || '').trim(),
          street: (o.street || '').trim(),
          isPrimaryContact: Boolean(o.isPrimaryContact),
          sendEmailNotification: Boolean(o.sendEmailNotification),
          isBoardMember: Boolean(o.isBoardMember),
          bankAccounts: cleanBankAccs
        };
      })
      .filter(o => Boolean(o.name));

    if (cleanOwners.length === 0) {
      cleanOwners.push({
        id: `owner-fallback-${Date.now()}`,
        role: 'owner',
        name: flat.ownerName || 'Tulajdonos',
        share: '',
        email: (flat.email || '').trim(),
        emails: flat.email ? [flat.email.trim()] : [],
        phone: formatPhoneNumber(flat.phone || ''),
        phones: flat.phone ? [formatPhoneNumber(flat.phone)] : [],
        postalCode: '',
        city: '',
        street: '',
        isPrimaryContact: true,
        sendEmailNotification: true,
        isBoardMember: false,
        bankAccounts: []
      });
    }

    const primaryOwner = cleanOwners.find(o => o.isPrimaryContact) || cleanOwners[0];
    const compositeOwnerName = cleanOwners
      .map(o => (cleanOwners.length > 1 && o.share) ? `${o.name} (${o.share})` : o.name)
      .join(', ');

    // 2. Clean & normalize tenants
    const cleanTenants = tenants
      .map(t => {
        const cleanEmail = (t.email || '').trim();
        const cleanPhone = formatPhoneNumber((t.phone || '').trim());
        const cleanBankAccs = (t.bankAccounts || [])
          .map(acc => (acc || '').trim())
          .filter(Boolean);

        return {
          id: t.id || `tenant-${Date.now()}`,
          name: (t.name || '').trim(),
          phone: cleanPhone,
          email: cleanEmail,
          leaseStart: t.leaseStart || '',
          leaseEnd: t.leaseEnd || '',
          isActive: Boolean(t.isActive),
          payerName: (t.payerName || '').trim(),
          bankAccounts: cleanBankAccs
        };
      })
      .filter(t => Boolean(t.name));

    // 3. Clean & normalize meters
    const cleanMeters = meters
      .map(m => ({
        id: m.id || `meter-${Date.now()}`,
        serialNumber: (m.serialNumber || '').trim(),
        type: m.type || 'cold_water',
        installDate: m.installDate || '',
        initialReading: parseFloat(String(m.initialReading || '').replace(',', '.')) || 0,
        currentReading: parseFloat(String(m.currentReading || '').replace(',', '.')) || 0,
        lastReadingDate: m.lastReadingDate || '',
        expiryDate: m.expiryDate || '',
        removalDate: m.removalDate || '',
        finalReading: m.finalReading ? (parseFloat(String(m.finalReading).replace(',', '.')) || 0) : ''
      }))
      .filter(m => Boolean(m.serialNumber || m.currentReading));

    // 4. Clean & normalize annexes
    const cleanAnnexes = annexes
      .map(a => ({
        id: a.id || `annex-${Date.now()}`,
        code: (a.code || '').trim(),
        name: (a.name || '').trim(),
        quantity: (a.quantity || '').toString().trim().replace(',', '.'),
        unit: (a.unit || 'db').trim()
      }))
      .filter(a => Boolean(a.code || a.name));

    const legacyGarages = cleanAnnexes
      .filter(a => a.name.toLowerCase().includes('garázs') || a.name.toLowerCase().includes('garage') || a.code.startsWith('G-'))
      .map(a => ({ number: a.code, area: a.unit === 'm²' ? a.quantity : '' }));

    const legacyStorages = cleanAnnexes
      .filter(a => a.name.toLowerCase().includes('tároló') || a.name.toLowerCase().includes('storage') || a.code.startsWith('T-'))
      .map(a => ({ number: a.code, area: a.unit === 'm²' ? a.quantity : '' }));

    const updatedMasterData = {
      unitType,
      flatNum: (flatCode || flatNum).trim(),
      staircase: staircase.trim(),
      floor: floor.trim(),
      door: door.trim(),
      hrsz: hrsz.trim(),
      area: parseFloat(String(area).replace(',', '.')) || 0,
      volume: parseFloat(String(volume).replace(',', '.')) || 0,
      ownershipShare: parseFloat(String(ownershipShare).replace(',', '.')) || 0,
      tenantCount: parseInt(tenantCount, 10) || 1,
      paymentCode: (paymentCode || flatNum).trim(),
      purchaseDate: purchaseDate || '',
      saleDate: saleDate || '',
      isCompany: Boolean(isCompany),
      excludeUtility: Boolean(excludeUtility),
      notes: notes.trim(),

      // Unified owners & legacy fallback
      owners: cleanOwners,
      ownerName: compositeOwnerName,
      email: primaryOwner?.email || '',
      phone: primaryOwner?.phone || '',

      // Tenants
      tenants: cleanTenants,
      tenantName: cleanTenants.find(t => t.isActive)?.name || '',

      // Meters
      meters: cleanMeters,

      // Annexes & legacy structures
      annexes: cleanAnnexes,
      garages: legacyGarages.length > 0 ? legacyGarages : flat.garages || [],
      storages: legacyStorages.length > 0 ? legacyStorages : flat.storages || [],
      garageNum: legacyGarages.map(g => formatAnnexItem(g)).filter(Boolean).join(', '),
      storageNum: legacyStorages.map(s => formatAnnexItem(s)).filter(Boolean).join(', ')
    };

    saveFlatMaster(flatNum, updatedMasterData);
    onClose();
  };

  const totalOccupantsCount = owners.length + tenants.length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-hidden animate-fadeIn overscroll-contain cursor-default"
      {...backdropProps}
    >
      <div 
        className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-5xl h-[88vh] max-h-[92vh] flex flex-col overflow-hidden my-auto overscroll-contain transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* ================= STICKY HEADER ================= */}
        <div className="shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5 z-10 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            
            {/* Left: Icon, Unit title, Unit type pill, and active tenant indicator */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0 shadow-2xs">
                <CurrentTypeIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight truncate">
                    {flat.flatNum}. {currentTypeCfg.label}
                  </h3>
                  
                  {/* Unit Type Badge */}
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentTypeCfg.color}`}>
                    <CurrentTypeIcon className="w-3 h-3" />
                    <span>{currentTypeCfg.label}</span>
                  </span>

                  {/* Active Tenant Indicator */}
                  {activeTenant && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                      <UserCheck className="w-3 h-3 text-emerald-600" />
                      <span>{t.active_tenant_badge || (isEn ? "Tenant" : "Bérlő")}: {activeTenant.name}</span>
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-500 truncate mt-0.5">
                  <span className="font-medium text-gray-700">{flat.ownerName || (isEn ? "No owner" : "Nincs tulajdonos")}</span>
                  {flat.hrsz && <span className="ml-2 font-mono text-[11px] text-gray-400">hrsz: {flat.hrsz}</span>}
                </div>
              </div>
            </div>

            {/* Right: Actions (Save / Cancel & Close) */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t.save}</span>
              </button>

              <button 
                type="button"
                onClick={handleClose} 
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer ml-1" 
                title={`${t.close} (ESC)`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ================= STICKY TABS BAR (4 TABS) ================= */}
          <div className="flex items-center gap-1 border-t border-gray-100 pt-2 overflow-x-auto no-scrollbar">
            {/* Tab 1: Alapadatok */}
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'basic'
                  ? 'bg-blue-50 text-[#1E3A8A] font-bold shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>{t.tab_flat_basic || (isEn ? "Basic Data" : "Alapadatok")}</span>
            </button>

            {/* Tab 2: Tulajok / Bérlők (UNIFIED TAB) */}
            <button
              type="button"
              onClick={() => setActiveTab('owners')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'owners'
                  ? 'bg-blue-50 text-[#1E3A8A] font-bold shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t.tab_flat_owners_tenants_short || (isEn ? "Owners / Tenants" : "Tulajok / Bérlők")}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'owners' ? 'bg-[#1E3A8A] text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {totalOccupantsCount}
              </span>
              {totalOwnerSharePercent > 0 && totalOwnerSharePercent !== 100 && (
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" title="A tulajdoni hányadok összege nem 100%!" />
              )}
            </button>

            {/* Tab 3: Mérőórák */}
            <button
              type="button"
              onClick={() => setActiveTab('meters')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'meters'
                  ? 'bg-blue-50 text-[#1E3A8A] font-bold shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{t.tab_flat_meters || (isEn ? "Meters" : "Mérőórák")}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'meters' ? 'bg-[#1E3A8A] text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {meters.length}
              </span>
              {meterAlertsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Lejárt vagy lejáró hitelesítésű óra!" />
              )}
            </button>

            {/* Tab 4: Tartozékok */}
            <button
              type="button"
              onClick={() => setActiveTab('annexes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'annexes'
                  ? 'bg-blue-50 text-[#1E3A8A] font-bold shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>{t.tab_flat_annexes || (isEn ? "Accessories" : "Tartozékok")}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'annexes' ? 'bg-[#1E3A8A] text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {annexes.length}
              </span>
            </button>
          </div>
        </div>

        {/* ================= SCROLLABLE TAB CONTENT ================= */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 overscroll-contain">
          
          {/* TAB A: ALAPADATOK */}
          {activeTab === 'basic' && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Szekció 1: Albetét Alapadatok */}
              <div className="bg-gray-50/80 p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200/60 pb-2">
                  <Home className="w-4 h-4 text-[#1E3A8A]" />
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    {t.tab_flat_basic || (isEn ? "Unit Identification" : "Albetét Azonosító Adatok")}
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                  {/* Albetét Típusa */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                      {t.unit_type_label || (isEn ? "Unit Type" : "Albetét típusa")} *
                    </label>
                    {isEditMode ? (
                      <select
                        value={unitType}
                        onChange={(e) => setUnitType(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                      >
                        <option value="flat">{t.unit_type_flat || (isEn ? "Apartment" : "Lakás")}</option>
                        <option value="garage">{t.unit_type_garage || (isEn ? "Garage / Parking" : "Garázs / Beálló")}</option>
                        <option value="storage">{t.unit_type_storage || (isEn ? "Storage / Cellar" : "Tároló / Pince")}</option>
                        <option value="commercial">{t.unit_type_commercial || (isEn ? "Commercial / Office" : "Üzlethelyiség / Iroda")}</option>
                        <option value="other">{t.unit_type_other || (isEn ? "Other" : "Egyéb")}</option>
                      </select>
                    ) : (
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 font-semibold text-gray-900 flex items-center gap-1.5">
                        <CurrentTypeIcon className="w-3.5 h-3.5 text-gray-500" />
                        <span>{currentTypeCfg.label}</span>
                      </div>
                    )}
                  </div>

                  {/* Albetétkód */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                      {t.flat_code_label || (isEn ? "Unit Code" : "Albetétkód / Szám")} *
                    </label>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={flatCode}
                        onChange={(e) => setFlatCode(e.target.value)}
                        placeholder="pl. 1, III/12, G-04"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                        required
                      />
                    ) : (
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 font-bold text-gray-900">
                        {flatCode || "-"}
                      </div>
                    )}
                  </div>

                  {/* Helyrajzi szám */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                      {t.hrsz || (isEn ? "Land Registry No. (HRSZ)" : "Alhelyrajzi szám (hrsz.)")}
                    </label>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={hrsz}
                        onChange={(e) => setHrsz(e.target.value)}
                        placeholder="pl. 12345/1/A/1"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-mono focus:outline-none focus:border-[#1E3A8A]"
                      />
                    ) : (
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 font-mono text-gray-800">
                        {hrsz || "-"}
                      </div>
                    )}
                  </div>

                  {/* Lépcsőház */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                      {t.staircase || (isEn ? "Staircase" : "Lépcsőház")}
                    </label>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={staircase}
                        onChange={(e) => setStaircase(e.target.value)}
                        placeholder="pl. A, B, 1"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                      />
                    ) : (
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800">
                        {staircase || "-"}
                      </div>
                    )}
                  </div>

                  {/* Emelet */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                      {t.floor || (isEn ? "Floor" : "Emelet")}
                    </label>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={floor}
                        onChange={(e) => setFloor(e.target.value)}
                        placeholder="pl. Fsz., 1., 2."
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                      />
                    ) : (
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800">
                        {floor || "-"}
                      </div>
                    )}
                  </div>

                  {/* Ajtó */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                      {t.door || (isEn ? "Door" : "Ajtó")}
                    </label>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={door}
                        onChange={(e) => setDoor(e.target.value)}
                        placeholder="pl. 1, 12/A"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                      />
                    ) : (
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800">
                        {door || "-"}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Szekció 2: Méretek és Hányadok */}
              <div className="bg-gray-50/80 p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200/60 pb-2">
                  <Activity className="w-4 h-4 text-[#1E3A8A]" />
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    {isEn ? "Technical & Dimensions" : "Műszaki és Méretadatok"}
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
                  {/* Alapterület */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                      {t.area_sqm || (isEn ? "Area (sqm)" : "Alapterület (m²)")}
                    </label>
                    {isEditMode ? (
                      <input
                        type="number"
                        step="0.01"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        placeholder="pl. 64"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                      />
                    ) : (
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 font-bold text-gray-900">
                        {area ? `${area} m²` : "-"}
                      </div>
                    )}
                  </div>

                  {/* Légköbméter */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                      {t.volume_cbm || (isEn ? "Volume (cbm)" : "Légköbméter (m³)")}
                    </label>
                    {isEditMode ? (
                      <input
                        type="number"
                        step="0.01"
                        value={volume}
                        onChange={(e) => setVolume(e.target.value)}
                        placeholder="pl. 180"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                      />
                    ) : (
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 font-bold text-gray-900">
                        {volume ? `${volume} m³` : "-"}
                      </div>
                    )}
                  </div>

                  {/* Tulajdoni hányad */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                      {t.ownership_share_label || (isEn ? "Ownership Share (%)" : "Tulajdoni hányad (%)")}
                    </label>
                    {isEditMode ? (
                      <input
                        type="number"
                        step="0.01"
                        value={ownershipShare}
                        onChange={(e) => setOwnershipShare(e.target.value)}
                        placeholder="pl. 12.5"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                      />
                    ) : (
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 font-bold text-indigo-700">
                        {ownershipShare ? `${ownershipShare} %` : "0 %"}
                      </div>
                    )}
                  </div>

                  {/* Lakók száma */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                      {t.residents_count || (isEn ? "Residents" : "Lakók száma (fő)")}
                    </label>
                    {isEditMode ? (
                      <input
                        type="number"
                        min="0"
                        value={tenantCount}
                        onChange={(e) => setTenantCount(e.target.value)}
                        placeholder="pl. 2"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                      />
                    ) : (
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 font-bold text-gray-900">
                        {tenantCount || 1} {isEn ? "pers." : "fő"}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Szekció 3: Banki Azonosítás és Dátumok */}
              <div className="bg-gray-50/80 p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200/60 pb-2">
                  <CreditCard className="w-4 h-4 text-[#1E3A8A]" />
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    {isEn ? "Banking & Ledger Identification" : "Banki Felismerés és Időpontok"}
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                  {/* Egyedi Utaláskód */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                      {t.payment_code || (isEn ? "Payment Identifier Code" : "Egyedi Utaláskód")}
                    </label>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={paymentCode}
                        onChange={(e) => setPaymentCode(e.target.value)}
                        placeholder="pl. TH01-01"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-mono font-bold text-[#1E3A8A] focus:outline-none focus:border-[#1E3A8A]"
                      />
                    ) : (
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 font-mono font-bold text-[#1E3A8A]">
                        {paymentCode || flatCode || "-"}
                      </div>
                    )}
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {t.payment_code_hint || (isEn ? "For bank notice recognition" : "Banki közlemény felismeréshez")}
                    </span>
                  </div>

                  {/* Vételi időpont */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                      {t.purchase_date || (isEn ? "Purchase Date" : "Vételi időpont")}
                    </label>
                    {isEditMode ? (
                      <input
                        type="date"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                      />
                    ) : (
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800">
                        {purchaseDate || "-"}
                      </div>
                    )}
                  </div>

                  {/* Eladási időpont */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                      {t.sale_date || (isEn ? "Sale Date" : "Eladási időpont")}
                    </label>
                    {isEditMode ? (
                      <input
                        type="date"
                        value={saleDate}
                        onChange={(e) => setSaleDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                      />
                    ) : (
                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800">
                        {saleDate || "-"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Jelölőnégyzetek */}
                <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-2xs">
                    <input
                      type="checkbox"
                      checked={isCompany}
                      onChange={(e) => setIsCompany(e.target.checked)}
                      className="w-4 h-4 rounded text-[#1E3A8A] focus:ring-0 cursor-pointer"
                    />
                    <span className="font-semibold text-gray-700">
                      {t.is_company || (isEn ? "Company / Legal Entity" : "Cég / Jogi személy")}
                    </span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer select-none px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-2xs">
                    <input
                      type="checkbox"
                      checked={excludeUtility}
                      onChange={(e) => setExcludeUtility(e.target.checked)}
                      className="w-4 h-4 rounded text-[#1E3A8A] focus:ring-0 cursor-pointer"
                    />
                    <span className="font-semibold text-gray-700">
                      {t.exclude_utility || (isEn ? "Exclude from Utilities" : "Rezsiből kihagyva")}
                    </span>
                  </label>
                </div>
              </div>

              {/* Szekció 4: Megjegyzés */}
              <div className="bg-gray-50/80 p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2 text-xs">
                <label className="block text-gray-700 font-bold uppercase tracking-wider text-[11px]">
                  {t.notes_label || (isEn ? "Notes & Comments" : "Megjegyzések")}
                </label>
                {isEditMode ? (
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Bármilyen egyéb információ az albetétről..."
                    className="w-full p-3 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                  />
                ) : (
                  <div className="p-3 bg-white rounded-xl border border-gray-200 text-gray-700 whitespace-pre-wrap min-h-[60px]">
                    {notes || (isEn ? "No notes recorded." : "Nincs rögzített megjegyzés.")}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB B: TULAJDONOSOK / BÉRLŐK (UNIFIED & ACCORDION) */}
          {activeTab === 'owners' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Header bar: Count, Share validation indicator, Filter pills & Expand/Add buttons */}
              <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Users className="w-5 h-5 text-[#1E3A8A]" />
                    <h4 className="font-bold text-gray-900 text-sm">
                      {t.tab_flat_owners_tenants || (isEn ? "Owners & Tenants" : "Tulajdonosok és Bérlők")}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-[#1E3A8A]">
                      {totalOccupantsCount} {isEn ? "people" : "fő"}
                    </span>

                    {/* Share indicator */}
                    {totalOwnerSharePercent === 100 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>100% {isEn ? "(OK)" : "(rendben)"}</span>
                      </span>
                    ) : totalOwnerSharePercent > 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>{isEn ? "Sum:" : "Összeg:"} {totalOwnerSharePercent}%</span>
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Expand / Collapse All */}
                    <button
                      type="button"
                      onClick={expandedIds.size > 0 ? handleCollapseAll : handleExpandAll}
                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                    >
                      {expandedIds.size > 0 ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>{t.collapse_all || (isEn ? "Collapse All" : "Összecsukás")}</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>{t.expand_all || (isEn ? "Expand All" : "Kibontás")}</span>
                        </>
                      )}
                    </button>

                    {/* Add Buttons */}
                    {isEditMode && (
                      <>
                        <button
                          type="button"
                          onClick={handleAddOwner}
                          className="px-3 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.add_owner_btn || (isEn ? "+ Add Owner" : "+ Új tulajdonos")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleAddTenant}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.add_tenant_btn || (isEn ? "+ Add Tenant" : "+ Új bérlő")}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 border-t border-gray-100 pt-2 text-xs">
                  <span className="text-gray-400 font-medium text-[11px]">{isEn ? "Filter:" : "Szűrés:"}</span>
                  <button
                    type="button"
                    onClick={() => setOccupantFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      occupantFilter === 'all'
                        ? 'bg-[#1E3A8A] text-white shadow-2xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t.filter_all_occupants || (isEn ? "All" : "Mind")} ({totalOccupantsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOccupantFilter('owners')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      occupantFilter === 'owners'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t.filter_owners_only || (isEn ? "Owners" : "Tulajdonosok")} ({owners.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOccupantFilter('tenants')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      occupantFilter === 'tenants'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t.filter_tenants_only || (isEn ? "Tenants" : "Bérlők")} ({tenants.length})
                  </button>
                </div>
              </div>

              {/* People List (Owners & Tenants) */}
              <div className="space-y-3">
                
                {/* 1. TULAJDONOSOK SZEKCIÓ */}
                {(occupantFilter === 'all' || occupantFilter === 'owners') && (
                  <div className="space-y-2.5">
                    {occupantFilter === 'all' && (
                      <div className="flex items-center gap-2 px-1 pt-1">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          {isEn ? "Owners & Co-owners" : "Tulajdonosok és Haszonélvezők"} ({owners.length})
                        </span>
                      </div>
                    )}

                    {owners.map((owner, idx) => {
                      const isExpanded = expandedIds.has(owner.id);

                      return (
                        <div 
                          key={owner.id || idx}
                          className={`rounded-2xl border transition-all ${
                            isExpanded 
                              ? 'bg-blue-50/30 border-blue-200 shadow-sm' 
                              : 'bg-white hover:bg-gray-50/80 border-gray-200 shadow-2xs'
                          }`}
                        >
                          {/* COMPACT ROW (CLICKABLE ACCORDION HEADER) */}
                          <div 
                            onClick={() => togglePersonExpand(owner.id)}
                            className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                          >
                            {/* Left: Avatar, Role Badge, Name, Share, Primary Star */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center font-bold text-xs shrink-0">
                                {idx + 1}
                              </div>

                              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-900 text-sm truncate">
                                  {owner.name || (isEn ? "Unnamed Owner" : "Névtelen tulajdonos")}
                                </span>

                                {/* Role Badge */}
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  owner.role === 'beneficiary'
                                    ? 'bg-purple-100 text-purple-800'
                                    : (owner.role === 'coowner' ? 'bg-sky-100 text-sky-800' : 'bg-blue-100 text-[#1E3A8A]')
                                }`}>
                                  {owner.role === 'beneficiary' 
                                    ? (t.role_beneficiary || "Haszonélvező")
                                    : (owner.role === 'coowner' ? (t.role_coowner || "Társtulajdonos") : (t.role_owner || "Tulajdonos"))}
                                </span>

                                {/* Share badge */}
                                {owner.share && (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 font-mono">
                                    {owner.share}
                                  </span>
                                )}

                                {/* Primary Contact Star */}
                                {owner.isPrimaryContact && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                    <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                    <span>{t.is_primary_contact || (isEn ? "Primary" : "Elsődleges")}</span>
                                  </span>
                                )}

                                {owner.isBoardMember && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    SZVB
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Middle & Right: Contacts preview & Expand arrow */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 text-xs text-gray-600">
                              <div className="flex items-center gap-3">
                                {owner.email && (
                                  <div className="flex items-center gap-1 text-[11px] text-gray-600 max-w-[140px] truncate">
                                    <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                                    <span className="truncate">{owner.email}</span>
                                  </div>
                                )}
                                {owner.phone && (
                                  <div className="flex items-center gap-1 text-[11px] text-gray-600 font-mono">
                                    <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                                    <span>{formatPhoneNumber(owner.phone)}</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 ml-2">
                                {isEditMode && owners.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveOwner(owner.id);
                                    }}
                                    className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    title={isEn ? "Remove person" : "Személy törlése"}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}

                                <div className="p-1 text-gray-400 hover:text-gray-700">
                                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[#1E3A8A]" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* EXPANDED DETAILS ACCORDION BODY */}
                          {isExpanded && (
                            <div 
                              className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-4 text-xs animate-fadeIn"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                                {/* Role */}
                                <div>
                                  <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                                    {t.role || "Szerepkör"}
                                  </label>
                                  {isEditMode ? (
                                    <select
                                      value={owner.role || 'owner'}
                                      onChange={(e) => handleOwnerChange(owner.id, 'role', e.target.value)}
                                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800"
                                    >
                                      <option value="owner">{t.role_owner || (isEn ? "Owner" : "Tulajdonos")}</option>
                                      <option value="coowner">{t.role_coowner || (isEn ? "Co-owner" : "Társtulajdonos")}</option>
                                      <option value="beneficiary">{t.role_beneficiary || (isEn ? "Beneficiary" : "Haszonélvező")}</option>
                                    </select>
                                  ) : (
                                    <div className="p-2.5 bg-white rounded-xl border border-gray-200 font-bold text-gray-800">
                                      {owner.role === 'beneficiary' 
                                        ? (t.role_beneficiary || "Haszonélvező")
                                        : (owner.role === 'coowner' ? (t.role_coowner || "Társtulajdonos") : (t.role_owner || "Tulajdonos"))}
                                    </div>
                                  )}
                                </div>

                                {/* Név */}
                                <div>
                                  <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                                    {t.owner_name} *
                                  </label>
                                  {isEditMode ? (
                                    <input
                                      type="text"
                                      value={owner.name}
                                      onChange={(e) => handleOwnerChange(owner.id, 'name', e.target.value)}
                                      placeholder="pl. Kovács János"
                                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                                      required
                                    />
                                  ) : (
                                    <div className="p-2.5 bg-white rounded-xl border border-gray-200 font-bold text-gray-900">
                                      {owner.name || "-"}
                                    </div>
                                  )}
                                </div>

                                {/* Tulajdoni hányad */}
                                <div>
                                  <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                                    {isEn ? "Ownership share (e.g. 1/2 or 50%)" : "Tulajdoni hányad (pl. 1/2 vagy 50%)"}
                                  </label>
                                  {isEditMode ? (
                                    <input
                                      type="text"
                                      value={owner.share || ''}
                                      onChange={(e) => handleOwnerChange(owner.id, 'share', e.target.value)}
                                      placeholder="pl. 1/2 vagy 50%"
                                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#1E3A8A]"
                                    />
                                  ) : (
                                    <div className="p-2.5 bg-white rounded-xl border border-gray-200 font-bold text-[#1E3A8A]">
                                      {owner.share || "-"}
                                    </div>
                                  )}
                                </div>

                                {/* E-mail */}
                                <div>
                                  <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                                    {t.email}
                                  </label>
                                  {isEditMode ? (
                                    <input
                                      type="email"
                                      value={owner.email}
                                      onChange={(e) => handleOwnerChange(owner.id, 'email', e.target.value)}
                                      placeholder="pelda@email.hu"
                                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                                    />
                                  ) : (
                                    <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800 flex items-center gap-1.5">
                                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                      {owner.email ? (
                                        <a href={`mailto:${owner.email}`} className="truncate hover:underline text-[#1E3A8A] font-medium">{owner.email}</a>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Telefon */}
                                <div>
                                  <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                                    {t.phone}
                                  </label>
                                  {isEditMode ? (
                                    <input
                                      type="tel"
                                      value={owner.phone}
                                      onChange={(e) => handleOwnerChange(owner.id, 'phone', e.target.value)}
                                      onBlur={() => handleOwnerChange(owner.id, 'phone', formatPhoneNumber(owner.phone))}
                                      placeholder="+36 30 123 4567"
                                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                                    />
                                  ) : (
                                    <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800 flex items-center gap-1.5">
                                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                      {owner.phone ? (
                                        <a href={`tel:${cleanPhoneNumber(owner.phone)}`} className="hover:underline font-mono font-medium">{formatPhoneNumber(owner.phone)}</a>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Irányítószám & Város */}
                                <div>
                                  <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                                    {t.postal_code || (isEn ? "Postal Code & City" : "Irányítószám és Város")}
                                  </label>
                                  {isEditMode ? (
                                    <div className="grid grid-cols-3 gap-2">
                                      <input
                                        type="text"
                                        value={owner.postalCode || ''}
                                        onChange={(e) => handleOwnerChange(owner.id, 'postalCode', e.target.value)}
                                        placeholder="1111"
                                        className="px-2.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-mono focus:outline-none focus:border-[#1E3A8A]"
                                      />
                                      <input
                                        type="text"
                                        value={owner.city || ''}
                                        onChange={(e) => handleOwnerChange(owner.id, 'city', e.target.value)}
                                        placeholder="Budapest"
                                        className="col-span-2 px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                                      />
                                    </div>
                                  ) : (
                                    <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800">
                                      {owner.postalCode || owner.city ? `${owner.postalCode || ''} ${owner.city || ''}` : "-"}
                                    </div>
                                  )}
                                </div>

                                {/* Utca, házszám */}
                                <div className="sm:col-span-2 md:col-span-3">
                                  <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                                    {t.street_address || (isEn ? "Street Address" : "Utca, házszám, emelet/ajtó")}
                                  </label>
                                  {isEditMode ? (
                                    <input
                                      type="text"
                                      value={owner.street || ''}
                                      onChange={(e) => handleOwnerChange(owner.id, 'street', e.target.value)}
                                      placeholder="pl. Fő utca 12. 3. em. 4."
                                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                                    />
                                  ) : (
                                    <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800">
                                      {owner.street || "-"}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* INTERACTIVE TOGGLE CHECKBOXES */}
                              <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-3">
                                {/* Elsődleges kapcsolattartó */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleOwnerFlag(owner.id, 'isPrimaryContact')}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                                    owner.isPrimaryContact
                                      ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                                    owner.isPrimaryContact ? 'bg-amber-600 text-white' : 'bg-white border border-gray-300'
                                  }`}>
                                    {owner.isPrimaryContact && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span>{t.is_primary_contact || (isEn ? "Primary Contact" : "Elsődleges kapcsolattartó")}</span>
                                </button>

                                {/* E-mail értesítés */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleOwnerFlag(owner.id, 'sendEmailNotification')}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                                    owner.sendEmailNotification
                                      ? 'bg-blue-50 text-blue-900 border-blue-300 shadow-2xs'
                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                                    owner.sendEmailNotification ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300'
                                  }`}>
                                    {owner.sendEmailNotification && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span>{t.send_email_notif || (isEn ? "Receive Email Notices" : "E-mailes értesítés kérése")}</span>
                                </button>

                                {/* SZVB tag */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleOwnerFlag(owner.id, 'isBoardMember')}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                                    owner.isBoardMember
                                      ? 'bg-indigo-50 text-indigo-900 border-indigo-300 shadow-2xs'
                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                                    owner.isBoardMember ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300'
                                  }`}>
                                    {owner.isBoardMember && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span>{t.is_board_member || (isEn ? "Audit Board Member" : "SZVB tag")}</span>
                                </button>
                              </div>

                              {/* Ismert bankszámlaszámok */}
                              <div className="pt-2 border-t border-gray-100 space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-gray-700 font-semibold text-[11px] flex items-center gap-1.5">
                                    <CreditCard className="w-3.5 h-3.5 text-gray-500" />
                                    <span>{t.bank_accounts_known || (isEn ? "Known Bank Account(s) for auto-matching" : "Ismert bankszámlaszám(ok) automatikus utaláspárosításhoz")}</span>
                                  </label>
                                  {isEditMode && (
                                    <button
                                      type="button"
                                      onClick={() => handleOwnerAddBankAccount(owner.id)}
                                      className="text-[11px] font-bold text-[#1E3A8A] hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>{t.add_bank_account || (isEn ? "+ Add Account" : "+ Számlaszám")}</span>
                                    </button>
                                  )}
                                </div>

                                {owner.bankAccounts && owner.bankAccounts.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {owner.bankAccounts.map((acc, accIdx) => (
                                      <div key={accIdx} className="flex items-center gap-2">
                                        {isEditMode ? (
                                          <>
                                            <input
                                              type="text"
                                              value={acc}
                                              onChange={(e) => handleOwnerBankAccountChange(owner.id, accIdx, e.target.value)}
                                              placeholder="11773010-00000000-00000000"
                                              className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1E3A8A]"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => handleOwnerRemoveBankAccount(owner.id, accIdx)}
                                              className="p-1 rounded text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                              title="Törlés"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        ) : (
                                          <div className="px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-xs font-mono font-medium text-gray-800">
                                            {acc}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic text-[11px] block">
                                    {isEn ? "No bank accounts recorded." : "Nincs rögzített számlaszám az automatikus banki felismeréshez."}
                                  </span>
                                )}
                              </div>

                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. BÉRLŐK SZEKCIÓ (MEGKÜLÖNBÖZTETVE) */}
                {(occupantFilter === 'all' || occupantFilter === 'tenants') && (
                  <div className="space-y-2.5 pt-2">
                    {occupantFilter === 'all' && (
                      <div className="flex items-center justify-between px-1 pt-2 border-t border-gray-200/60">
                        <div className="flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            {isEn ? "Tenants (Active & Past)" : "Bérlők (Aktív és Korábbi)"} ({tenants.length})
                          </span>
                        </div>
                        {isEditMode && (
                          <button
                            type="button"
                            onClick={handleAddTenant}
                            className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{t.add_tenant_btn || (isEn ? "+ Add Tenant" : "+ Új bérlő")}</span>
                          </button>
                        )}
                      </div>
                    )}

                    {tenants.length === 0 ? (
                      <div className="p-4 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-xs">
                        <Key className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                        <p>{t.no_tenants || (isEn ? "No tenants registered." : "Nincs rögzített bérlő ennél az albetétnél.")}</p>
                        {isEditMode && (
                          <button
                            type="button"
                            onClick={handleAddTenant}
                            className="mt-2 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-200 cursor-pointer"
                          >
                            {t.add_tenant_btn || (isEn ? "+ Add Tenant" : "+ Új bérlő rögzítése")}
                          </button>
                        )}
                      </div>
                    ) : (
                      tenants.map((tenant, idx) => {
                        const isExpanded = expandedIds.has(tenant.id);

                        return (
                          <div 
                            key={tenant.id || idx}
                            className={`rounded-2xl border transition-all ${
                              tenant.isActive
                                ? (isExpanded ? 'bg-emerald-50/40 border-emerald-300 shadow-sm' : 'bg-white hover:bg-emerald-50/20 border-emerald-200 shadow-2xs')
                                : (isExpanded ? 'bg-gray-100/70 border-gray-300' : 'bg-gray-50/80 border-gray-200 opacity-80')
                            }`}
                          >
                            {/* COMPACT ROW (CLICKABLE ACCORDION HEADER) */}
                            <div 
                              onClick={() => togglePersonExpand(tenant.id)}
                              className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                            >
                              {/* Left: Avatar, Status Badge, Name, Lease dates */}
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                  tenant.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                                }`}>
                                  <Key className="w-4 h-4" />
                                </div>

                                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-gray-900 text-sm truncate">
                                    {tenant.name || (isEn ? "Unnamed Tenant" : "Névtelen bérlő")}
                                  </span>

                                  {/* Status badge */}
                                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                    tenant.isActive 
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                      : 'bg-gray-100 text-gray-600 border-gray-200'
                                  }`}>
                                    {tenant.isActive 
                                      ? (t.active_tenant || (isEn ? "Active Tenant" : "Aktív bérlő")) 
                                      : (t.archived_tenant || (isEn ? "Past Tenant" : "Korábbi bérlő"))}
                                  </span>

                                  {/* Lease preview */}
                                  {(tenant.leaseStart || tenant.leaseEnd) && (
                                    <span className="text-[11px] text-gray-500 font-mono">
                                      {tenant.leaseStart || '...'} - {tenant.leaseEnd || (isEn ? 'Present' : 'jelenleg')}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Middle & Right: Contacts preview & Controls */}
                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 text-xs text-gray-600">
                                <div className="flex items-center gap-3">
                                  {tenant.email && (
                                    <div className="flex items-center gap-1 text-[11px] text-gray-600 max-w-[140px] truncate">
                                      <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                                      <span className="truncate">{tenant.email}</span>
                                    </div>
                                  )}
                                  {tenant.phone && (
                                    <div className="flex items-center gap-1 text-[11px] text-gray-600 font-mono">
                                      <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                                      <span>{formatPhoneNumber(tenant.phone)}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 ml-2">
                                  {isEditMode && tenant.isActive && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCloseTenantLease(tenant.id);
                                      }}
                                      className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                      title={t.tenant_close_lease || (isEn ? "Move out" : "Kiköltözés")}
                                    >
                                      {t.tenant_close_lease || (isEn ? "Move Out" : "Kiköltözés")}
                                    </button>
                                  )}

                                  {isEditMode && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveTenant(tenant.id);
                                      }}
                                      className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                      title={isEn ? "Remove tenant" : "Bérlő törlése"}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}

                                  <div className="p-1 text-gray-400 hover:text-gray-700">
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-emerald-700" /> : <ChevronDown className="w-4 h-4" />}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* EXPANDED TENANT DETAILS ACCORDION BODY */}
                            {isExpanded && (
                              <div 
                                className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-4 text-xs animate-fadeIn"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                                  {/* Bérlő Neve */}
                                  <div>
                                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                                      {t.tenant_name || (isEn ? "Tenant Name" : "Bérlő neve")} *
                                    </label>
                                    {isEditMode ? (
                                      <input
                                        type="text"
                                        value={tenant.name}
                                        onChange={(e) => handleTenantChange(tenant.id, 'name', e.target.value)}
                                        placeholder="pl. Nagy Péter"
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                                        required
                                      />
                                    ) : (
                                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 font-bold text-gray-900">
                                        {tenant.name || "-"}
                                      </div>
                                    )}
                                  </div>

                                  {/* Telefon */}
                                  <div>
                                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                                      {t.phone}
                                    </label>
                                    {isEditMode ? (
                                      <input
                                        type="tel"
                                        value={tenant.phone}
                                        onChange={(e) => handleTenantChange(tenant.id, 'phone', e.target.value)}
                                        onBlur={() => handleTenantChange(tenant.id, 'phone', formatPhoneNumber(tenant.phone))}
                                        placeholder="+36 20 987 6543"
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                                      />
                                    ) : (
                                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800 flex items-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                        {tenant.phone ? (
                                          <a href={`tel:${cleanPhoneNumber(tenant.phone)}`} className="hover:underline font-mono font-medium">{formatPhoneNumber(tenant.phone)}</a>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* E-mail */}
                                  <div>
                                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                                      {t.email}
                                    </label>
                                    {isEditMode ? (
                                      <input
                                        type="email"
                                        value={tenant.email}
                                        onChange={(e) => handleTenantChange(tenant.id, 'email', e.target.value)}
                                        placeholder="berlo@email.hu"
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                                      />
                                    ) : (
                                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800 flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                        {tenant.email ? (
                                          <a href={`mailto:${tenant.email}`} className="truncate hover:underline text-[#1E3A8A] font-medium">{tenant.email}</a>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Bérleti Időszak Kezdete */}
                                  <div>
                                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                                      {t.lease_from || (isEn ? "Lease Start Date" : "Bérleti időszak (-tól)")}
                                    </label>
                                    {isEditMode ? (
                                      <input
                                        type="date"
                                        value={tenant.leaseStart}
                                        onChange={(e) => handleTenantChange(tenant.id, 'leaseStart', e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                                      />
                                    ) : (
                                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800 font-mono">
                                        {tenant.leaseStart || "-"}
                                      </div>
                                    )}
                                  </div>

                                  {/* Bérleti Időszak Vége */}
                                  <div>
                                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                                      {t.lease_to || (isEn ? "Lease End Date" : "Bérleti időszak (-ig)")}
                                    </label>
                                    {isEditMode ? (
                                      <input
                                        type="date"
                                        value={tenant.leaseEnd}
                                        onChange={(e) => handleTenantChange(tenant.id, 'leaseEnd', e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                                      />
                                    ) : (
                                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800 font-mono">
                                        {tenant.leaseEnd || (isEn ? "Indefinite" : "Határozatlan")}
                                      </div>
                                    )}
                                  </div>

                                  {/* Ismert Utaló Név */}
                                  <div>
                                    <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                                      {t.known_payer_name || (isEn ? "Known Payer Name" : "Ismert utaló neve")}
                                    </label>
                                    {isEditMode ? (
                                      <input
                                        type="text"
                                        value={tenant.payerName || ''}
                                        onChange={(e) => handleTenantChange(tenant.id, 'payerName', e.target.value)}
                                        placeholder="pl. Nagy Péter E.V. vagy Szülő neve"
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                                      />
                                    ) : (
                                      <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800 font-medium">
                                        {tenant.payerName || "-"}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Aktív státusz kapcsoló gomb */}
                                <div className="pt-2 border-t border-gray-100 flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTenantActive(tenant.id)}
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                                      tenant.isActive
                                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-2xs'
                                        : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                                      tenant.isActive ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-300'
                                    }`}>
                                      {tenant.isActive && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                    <span>{t.is_active_tenant || (isEn ? "Currently Active Tenant" : "Jelenleg aktív bérlő")}</span>
                                  </button>
                                </div>

                                {/* Bérlő bankszámlaszámai */}
                                <div className="pt-2 border-t border-gray-100 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-gray-700 font-semibold text-[11px] flex items-center gap-1.5">
                                      <CreditCard className="w-3.5 h-3.5 text-gray-500" />
                                      <span>{t.tenant_bank_account || (isEn ? "Tenant Bank Account(s) for smart matching" : "Bérlő bankszámlaszáma(i) automatikus felismeréshez")}</span>
                                    </label>
                                    {isEditMode && (
                                      <button
                                        type="button"
                                        onClick={() => handleTenantAddBankAccount(tenant.id)}
                                        className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span>{t.add_bank_account || (isEn ? "+ Add Account" : "+ Számlaszám")}</span>
                                      </button>
                                    )}
                                  </div>

                                  {tenant.bankAccounts && tenant.bankAccounts.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {tenant.bankAccounts.map((acc, accIdx) => (
                                        <div key={accIdx} className="flex items-center gap-2">
                                          {isEditMode ? (
                                            <>
                                              <input
                                                type="text"
                                                value={acc}
                                                onChange={(e) => handleTenantBankAccountChange(tenant.id, accIdx, e.target.value)}
                                                placeholder="11773010-00000000-00000000"
                                                className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1E3A8A]"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => handleTenantRemoveBankAccount(tenant.id, accIdx)}
                                                className="p-1 rounded text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                                title="Törlés"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </>
                                          ) : (
                                            <div className="px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-xs font-mono font-medium text-gray-800">
                                              {acc}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 italic text-[11px] block">
                                      {isEn ? "No bank accounts recorded for tenant." : "Nincs rögzített bérlői bankszámlaszám."}
                                    </span>
                                  )}
                                </div>

                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

              </div>

            </div>
          )}

          {/* TAB C: MÉRŐÓRÁK */}
          {activeTab === 'meters' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Header bar: Count & Add button */}
              <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#1E3A8A]" />
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">
                      {t.meters_title || (isEn ? "Meters Registry" : "Mérőórák Nyilvántartása")} ({meters.length} {isEn ? "meters" : "óra"})
                    </h4>
                    <span className="text-[11px] text-gray-500">
                      {isEn ? "Cold/hot water, heating, electricity & gas meters with expiration tracking" : "Víz, fűtés, villany és gázórák hitelesítési lejárati figyelmeztetéssel"}
                    </span>
                  </div>
                </div>

                {isEditMode && (
                  <button
                    type="button"
                    onClick={handleAddMeter}
                    className="px-3 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.add_meter_btn || (isEn ? "+ Add Meter" : "+ Új mérőóra")}</span>
                  </button>
                )}
              </div>

              {/* Meters List */}
              {meters.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-gray-500 text-xs">
                  <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="font-semibold text-gray-700">{t.no_meters || (isEn ? "No meters registered for this unit." : "Nincs rögzített mérőóra ennél az albetétnél.")}</p>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={handleAddMeter}
                      className="mt-3 px-3 py-1.5 bg-blue-100 text-[#1E3A8A] rounded-lg text-xs font-bold hover:bg-blue-200 cursor-pointer"
                    >
                      {t.add_meter_btn || (isEn ? "+ Add Meter" : "+ Új mérőóra rögzítése")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {meters.map((meter, idx) => {
                    const expiry = getExpiryInfo(meter.expiryDate);

                    return (
                      <div 
                        key={meter.id || idx}
                        className="bg-gray-50/80 p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4"
                      >
                        {/* Top Bar: Type, Serial & Status badge */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/60 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#1E3A8A] flex items-center justify-center text-xs font-bold shrink-0">
                              {idx + 1}
                            </span>

                            {/* Type selector / badge */}
                            {isEditMode ? (
                              <select
                                value={meter.type || 'cold_water'}
                                onChange={(e) => handleMeterChange(meter.id, 'type', e.target.value)}
                                className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-800"
                              >
                                <option value="cold_water">{t.meter_type_cold_water || (isEn ? "Cold Water" : "Hideg víz")}</option>
                                <option value="hot_water">{t.meter_type_hot_water || (isEn ? "Hot Water" : "Meleg víz")}</option>
                                <option value="heating">{t.meter_type_heating || (isEn ? "Heating" : "Fűtés")}</option>
                                <option value="electricity">{t.meter_type_electricity || (isEn ? "Electricity" : "Villany")}</option>
                                <option value="gas">{t.meter_type_gas || (isEn ? "Gas" : "Gáz")}</option>
                                <option value="other">{t.meter_type_other || (isEn ? "Other Meter" : "Egyéb")}</option>
                              </select>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {meter.type === 'cold_water' && (t.meter_type_cold_water || "Hideg víz")}
                                {meter.type === 'hot_water' && (t.meter_type_hot_water || "Meleg víz")}
                                {meter.type === 'heating' && (t.meter_type_heating || "Fűtés")}
                                {meter.type === 'electricity' && (t.meter_type_electricity || "Villany")}
                                {meter.type === 'gas' && (t.meter_type_gas || "Gáz")}
                                {meter.type === 'other' && (t.meter_type_other || "Egyéb")}
                              </span>
                            )}

                            <span className="font-mono font-bold text-gray-900 text-sm">
                              {meter.serialNumber || (isEn ? "No Serial" : "Nincs gyári szám")}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Expiry Warning Badge */}
                            {expiry.status === 'expired' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                                <span>{t.meter_expired || (isEn ? "Expired!" : "Hitelesítés lejárt!")} ({meter.expiryDate})</span>
                              </span>
                            )}
                            {expiry.status === 'expiring' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>{t.meter_expiring_soon || (isEn ? "Expiring soon" : "Hamarosan lejár")} ({expiry.daysLeft} {isEn ? "days" : "nap"})</span>
                              </span>
                            )}

                            {isEditMode && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMeter(meter.id)}
                                className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title={isEn ? "Remove meter" : "Mérőóra törlése"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Fields Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
                          {/* Gyári Szám */}
                          <div>
                            <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                              {t.meter_serial || (isEn ? "Serial Number" : "Gyári szám / Sorozatszám")} *
                            </label>
                            {isEditMode ? (
                              <input
                                type="text"
                                value={meter.serialNumber}
                                onChange={(e) => handleMeterChange(meter.id, 'serialNumber', e.target.value)}
                                placeholder="pl. WM-123456"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-mono focus:outline-none focus:border-[#1E3A8A]"
                                required
                              />
                            ) : (
                              <div className="p-2.5 bg-white rounded-xl border border-gray-200 font-mono font-bold text-gray-900">
                                {meter.serialNumber || "-"}
                              </div>
                            )}
                          </div>

                          {/* Beszerelés Dátuma */}
                          <div>
                            <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                              {t.install_date || (isEn ? "Installation Date" : "Beszerelés dátuma")}
                            </label>
                            {isEditMode ? (
                              <input
                                type="date"
                                value={meter.installDate}
                                onChange={(e) => handleMeterChange(meter.id, 'installDate', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                              />
                            ) : (
                              <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800 font-mono">
                                {meter.installDate || "-"}
                              </div>
                            )}
                          </div>

                          {/* Beszerelési Kezdő Állás */}
                          <div>
                            <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                              {t.initial_reading || (isEn ? "Initial Reading" : "Beszerelési kezdő állás")}
                            </label>
                            {isEditMode ? (
                              <input
                                type="number"
                                step="0.001"
                                value={meter.initialReading}
                                onChange={(e) => handleMeterChange(meter.id, 'initialReading', e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                              />
                            ) : (
                              <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800 font-mono font-semibold">
                                {meter.initialReading !== undefined ? meter.initialReading : "0"}
                              </div>
                            )}
                          </div>

                          {/* Aktuális Állás */}
                          <div>
                            <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                              {t.current_reading || (isEn ? "Current Reading" : "Aktuális állás")}
                            </label>
                            {isEditMode ? (
                              <input
                                type="number"
                                step="0.001"
                                value={meter.currentReading}
                                onChange={(e) => handleMeterChange(meter.id, 'currentReading', e.target.value)}
                                placeholder="pl. 142.5"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#1E3A8A] focus:outline-none focus:border-[#1E3A8A]"
                              />
                            ) : (
                              <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-[#1E3A8A] font-mono font-bold">
                                {meter.currentReading !== undefined ? meter.currentReading : "0"}
                              </div>
                            )}
                          </div>

                          {/* Utolsó Leolvasás Dátuma */}
                          <div>
                            <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                              {t.last_reading_date || (isEn ? "Last Reading Date" : "Utolsó leolvasás dátuma")}
                            </label>
                            {isEditMode ? (
                              <input
                                type="date"
                                value={meter.lastReadingDate}
                                onChange={(e) => handleMeterChange(meter.id, 'lastReadingDate', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                              />
                            ) : (
                              <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800 font-mono">
                                {meter.lastReadingDate || "-"}
                              </div>
                            )}
                          </div>

                          {/* Hitelesítés Lejárata */}
                          <div>
                            <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                              {t.expiry_date || (isEn ? "Verification Expiry Date" : "Hitelesítés lejárata")}
                            </label>
                            {isEditMode ? (
                              <input
                                type="date"
                                value={meter.expiryDate}
                                onChange={(e) => handleMeterChange(meter.id, 'expiryDate', e.target.value)}
                                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs focus:outline-none ${
                                  expiry.status === 'expired' 
                                    ? 'border-red-400 bg-red-50/50' 
                                    : (expiry.status === 'expiring' ? 'border-amber-400 bg-amber-50/50' : 'border-gray-300 focus:border-[#1E3A8A]')
                                }`}
                              />
                            ) : (
                              <div className={`p-2.5 rounded-xl border font-mono font-medium ${
                                expiry.status === 'expired' 
                                  ? 'bg-red-50 text-red-800 border-red-200' 
                                  : (expiry.status === 'expiring' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-white text-gray-800 border-gray-200')
                              }`}>
                                {meter.expiryDate || "-"}
                              </div>
                            )}
                          </div>

                          {/* Leszerelés Dátuma */}
                          <div>
                            <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                              {t.removal_date || (isEn ? "Removal Date" : "Leszerelés dátuma")}
                            </label>
                            {isEditMode ? (
                              <input
                                type="date"
                                value={meter.removalDate}
                                onChange={(e) => handleMeterChange(meter.id, 'removalDate', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                              />
                            ) : (
                              <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800 font-mono">
                                {meter.removalDate || "-"}
                              </div>
                            )}
                          </div>

                          {/* Leszerelési Állás */}
                          <div>
                            <label className="block text-gray-700 font-semibold mb-1 text-[11px]">
                              {t.final_reading || (isEn ? "Final Reading" : "Leszerelési végállás")}
                            </label>
                            {isEditMode ? (
                              <input
                                type="number"
                                step="0.001"
                                value={meter.finalReading}
                                onChange={(e) => handleMeterChange(meter.id, 'finalReading', e.target.value)}
                                placeholder="pl. 210.4"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A]"
                              />
                            ) : (
                              <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-800 font-mono">
                                {meter.finalReading !== undefined && meter.finalReading !== '' ? meter.finalReading : "-"}
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* TAB D: TARTOZÉKOK */}
          {activeTab === 'annexes' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Header bar: Count & Add button */}
              <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#1E3A8A]" />
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">
                      {t.annexes_title || (isEn ? "Accessories & Facilities" : "Tartozékok és Kapcsolódó Helyiségek")} ({annexes.length} {isEn ? "items" : "db"})
                    </h4>
                    <span className="text-[11px] text-gray-500">
                      {isEn ? "Non-unit garages, storages, terraces or quotas assigned to this apartment" : "Nem önálló albetétként kezelt garázsbeállók, tárolók, teraszok nyilvántartása"}
                    </span>
                  </div>
                </div>

                {isEditMode && (
                  <button
                    type="button"
                    onClick={handleAddAnnex}
                    className="px-3 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.add_annex_btn || (isEn ? "+ Add Accessory" : "+ Új tartozék")}</span>
                  </button>
                )}
              </div>

              {/* Annexes List */}
              {annexes.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-gray-500 text-xs">
                  <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="font-semibold text-gray-700">{t.no_annexes || (isEn ? "No accessories registered for this unit." : "Nincs rögzített tartozék ennél az albetétnél.")}</p>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={handleAddAnnex}
                      className="mt-3 px-3 py-1.5 bg-blue-100 text-[#1E3A8A] rounded-lg text-xs font-bold hover:bg-blue-200 cursor-pointer"
                    >
                      {t.add_annex_btn || (isEn ? "+ Add Accessory" : "+ Új tartozék hozzáadása")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                          <th className="py-3 px-4">{t.annex_code || (isEn ? "Code / ID" : "Kód / Azonosító")}</th>
                          <th className="py-3 px-4">{t.annex_name || (isEn ? "Description" : "Megnevezés")}</th>
                          <th className="py-3 px-4 text-center">{t.annex_quantity || (isEn ? "Quantity" : "Mennyiség")}</th>
                          <th className="py-3 px-4">{t.annex_unit || (isEn ? "Unit" : "Mértékegység")}</th>
                          {isEditMode && <th className="py-3 px-4 text-right">{isEn ? "Actions" : "Művelet"}</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {annexes.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-gray-50/50 transition-colors">
                            {/* Kód */}
                            <td className="py-3 px-4 font-mono font-bold text-gray-900">
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={item.code}
                                  onChange={(e) => handleAnnexChange(item.id, 'code', e.target.value)}
                                  placeholder="pl. G-02, T-14"
                                  className="w-28 px-2.5 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1E3A8A]"
                                />
                              ) : (
                                <span>{item.code || "-"}</span>
                              )}
                            </td>

                            {/* Megnevezés */}
                            <td className="py-3 px-4 font-medium text-gray-800">
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleAnnexChange(item.id, 'name', e.target.value)}
                                  placeholder="pl. Mélygarázs beálló, Pince tároló"
                                  className="w-full px-2.5 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A]"
                                />
                              ) : (
                                <span>{item.name || "-"}</span>
                              )}
                            </td>

                            {/* Mennyiség */}
                            <td className="py-3 px-4 text-center font-bold text-gray-900">
                              {isEditMode ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.quantity}
                                  onChange={(e) => handleAnnexChange(item.id, 'quantity', e.target.value)}
                                  placeholder="1"
                                  className="w-20 px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs text-center font-bold focus:outline-none focus:border-[#1E3A8A]"
                                />
                              ) : (
                                <span>{item.quantity || "1"}</span>
                              )}
                            </td>

                            {/* Mértékegység */}
                            <td className="py-3 px-4 text-gray-600">
                              {isEditMode ? (
                                <select
                                  value={item.unit || 'db'}
                                  onChange={(e) => handleAnnexChange(item.id, 'unit', e.target.value)}
                                  className="px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-800"
                                >
                                  <option value="db">db</option>
                                  <option value="m²">m²</option>
                                  <option value="m³">m³</option>
                                  <option value="Ft">Ft</option>
                                </select>
                              ) : (
                                <span>{item.unit || "db"}</span>
                              )}
                            </td>

                            {/* Törlés */}
                            {isEditMode && (
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAnnex(item.id)}
                                  className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                  title={isEn ? "Remove accessory" : "Tartozék törlése"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* ================= FOOTER / STATUS BAR ================= */}
        <div className="shrink-0 bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">
              {flat.flatNum}. {currentTypeCfg.label}
            </span>
            <span>&bull;</span>
            <span>{isEn ? "Press ESC to close" : "Kilépés: ESC billentyű"}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t.save}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
