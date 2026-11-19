import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Plus, 
  Trash2, 
  Pencil, 
  Search, 
  FileText, 
  Image as ImageIcon,
  Upload, 
  Download, 
  X, 
  MessageSquare, 
  Send, 
  Calendar, 
  Paperclip, 
  Umbrella, 
  Droplets, 
  Wrench, 
  Shield, 
  Landmark,
  Flame,
  Zap,
  Phone,
  Mail,
  Building,
  Link2,
  ExternalLink,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowDownUp,
  Key,
  Car,
  Package,
  Briefcase,
  Copy,
  Check,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  PhoneCall,
  Gauge, 
  Info,
  Home,
  Hammer,
  Paintbrush,
  Trees,
  Flower2,
  Leaf,
  ShieldCheck,
  Lock,
  Bell,
  AlertTriangle,
  ClipboardList,
  Folder,
  Calculator,
  CreditCard,
  Wallet,
  Coins,
  CircleDollarSign,
  Users,
  UserCheck,
  Truck,
  Lightbulb,
  Thermometer,
  Wind,
  Wifi,
  Tv,
  Camera,
  Eye,
  HeartHandshake,
  Megaphone,
  MapPin,
  Clock,
  Tag,
  Bookmark,
  HardHat,
  Plug,
  Sun,
  Moon,
  Layers,
  Boxes,
  Settings,
  Archive
} from 'lucide-react';
import { formatPhoneNumber, cleanPhoneNumber } from '../../utils/phone';
import { useBackdropPropsFactory } from '../../utils/useBackdropClose';

export const AVAILABLE_MODULES = [
  {
    id: 'contacts',
    title: 'Elérhetőségek & Névjegy',
    titleEn: 'Contacts & Business Card',
    desc: 'Telefonszám, e-mail cím, kapcsolattartó, számlaszám és nyitvatartás.',
    icon: Phone,
    color: 'emerald',
    badge: 'Elérhetőség',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  {
    id: 'custom_fields',
    title: 'Egyedi adatok & Azonosítók',
    titleEn: 'Custom Fields & Identifiers',
    desc: 'Szabadon választható megnevezések és értékek (pl. felhasználási helyszám, lokáció szám, szerződésszám).',
    icon: Tag,
    color: 'teal',
    badge: 'Egyedi adatok',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200'
  },
  {
    id: 'cases',
    title: 'Ügyek rész',
    titleEn: 'Cases & Issues',
    desc: 'Folyamatban lévő ügyek, bejelentések, károk, státuszok, fotók és kapcsolt könyvelési tételek.',
    icon: Shield,
    color: 'blue',
    badge: 'Ügyek rész',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  {
    id: 'meters',
    title: 'Mérőórák & Fogyasztási leolvasások',
    titleEn: 'Meters & Consumption Readings',
    desc: 'Mérőhely azonosító (POD), gyári szám és havi leolvasások órafotókkal.',
    icon: Gauge,
    color: 'sky',
    badge: 'Mérőóra & Napló',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200'
  },
  {
    id: 'documents',
    title: 'Dokumentumok & Csatolt iratok',
    titleEn: 'Documents & Attachments',
    desc: 'Szerződések, garancialevelek, jegyzőkönyvek és számlák feltöltése.',
    icon: FileText,
    color: 'purple',
    badge: 'Iratok',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200'
  },
  {
    id: 'notes',
    title: 'Jegyzetek & Szövegdobozok',
    titleEn: 'Notes & Textboxes',
    desc: 'Címmel ellátott egyedi szövegdobozok, kapukódok, eljárási rend és emlékeztetők.',
    icon: Info,
    color: 'amber',
    badge: 'Jegyzetek',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200'
  }
];

// Backward-compatible TILE_TYPES export
export const TILE_TYPES = AVAILABLE_MODULES;

export function getTileModules(tile) {
  if (!tile) return ['contacts'];
  if (Array.isArray(tile.modules) && tile.modules.length > 0) {
    return tile.modules;
  }
  // Backward compatibility inference
  const mods = ['contacts'];
  const tType = tile.tileType;
  if (tile.customFields && tile.customFields.length > 0) {
    mods.push('custom_fields');
  }
  if (tType === 'contact_and_cases' || (tile.items && tile.items.length > 0 && tType !== 'info_and_readings')) {
    mods.push('cases');
  }
  if (tType === 'info_and_readings' || (tile.quickInfo && (tile.quickInfo.userPlaceNumber || tile.quickInfo.meterNumber))) {
    mods.push('meters');
  }
  if (tile.documents && tile.documents.length > 0) {
    mods.push('documents');
  }
  if ((tile.notesList && tile.notesList.length > 0) || (tile.description && tile.description.trim())) {
    mods.push('notes');
  }
  return mods;
}

const ICON_MAP = {
  building: Building,
  home: Home,
  landmark: Landmark,
  shield: Shield,
  shieldCheck: ShieldCheck,
  umbrella: Umbrella,
  droplets: Droplets,
  flame: Flame,
  zap: Zap,
  wrench: Wrench,
  hammer: Hammer,
  paintbrush: Paintbrush,
  phone: Phone,
  mail: Mail,
  file: FileText,
  key: Key,
  lock: Lock,
  car: Car,
  package: Package,
  briefcase: Briefcase,
  gauge: Gauge,
  sparkles: Sparkles,
  trash: Trash2,
  trees: Trees,
  flower: Flower2,
  leaf: Leaf,
  bell: Bell,
  alert: AlertTriangle,
  clipboard: ClipboardList,
  folder: Folder,
  calculator: Calculator,
  creditCard: CreditCard,
  wallet: Wallet,
  coins: Coins,
  dollar: CircleDollarSign,
  users: Users,
  userCheck: UserCheck,
  truck: Truck,
  lightbulb: Lightbulb,
  thermometer: Thermometer,
  wind: Wind,
  wifi: Wifi,
  tv: Tv,
  camera: Camera,
  eye: Eye,
  heart: HeartHandshake,
  megaphone: Megaphone,
  mapPin: MapPin,
  clock: Clock,
  tag: Tag,
  bookmark: Bookmark,
  hardHat: HardHat,
  plug: Plug,
  sun: Sun,
  moon: Moon,
  layers: Layers,
  boxes: Boxes,
  settings: Settings,
  archive: Archive,
  info: Info
};

const ICON_OPTIONS = [
  { id: 'building', icon: Building },
  { id: 'home', icon: Home },
  { id: 'landmark', icon: Landmark },
  { id: 'shield', icon: Shield },
  { id: 'shieldCheck', icon: ShieldCheck },
  { id: 'umbrella', icon: Umbrella },
  { id: 'droplets', icon: Droplets },
  { id: 'flame', icon: Flame },
  { id: 'zap', icon: Zap },
  { id: 'wrench', icon: Wrench },
  { id: 'hammer', icon: Hammer },
  { id: 'paintbrush', icon: Paintbrush },
  { id: 'phone', icon: Phone },
  { id: 'mail', icon: Mail },
  { id: 'file', icon: FileText },
  { id: 'key', icon: Key },
  { id: 'lock', icon: Lock },
  { id: 'car', icon: Car },
  { id: 'package', icon: Package },
  { id: 'briefcase', icon: Briefcase },
  { id: 'gauge', icon: Gauge },
  { id: 'sparkles', icon: Sparkles },
  { id: 'trash', icon: Trash2 },
  { id: 'trees', icon: Trees },
  { id: 'flower', icon: Flower2 },
  { id: 'leaf', icon: Leaf },
  { id: 'bell', icon: Bell },
  { id: 'alert', icon: AlertTriangle },
  { id: 'clipboard', icon: ClipboardList },
  { id: 'folder', icon: Folder },
  { id: 'calculator', icon: Calculator },
  { id: 'creditCard', icon: CreditCard },
  { id: 'wallet', icon: Wallet },
  { id: 'coins', icon: Coins },
  { id: 'dollar', icon: CircleDollarSign },
  { id: 'users', icon: Users },
  { id: 'userCheck', icon: UserCheck },
  { id: 'truck', icon: Truck },
  { id: 'lightbulb', icon: Lightbulb },
  { id: 'thermometer', icon: Thermometer },
  { id: 'wind', icon: Wind },
  { id: 'wifi', icon: Wifi },
  { id: 'tv', icon: Tv },
  { id: 'camera', icon: Camera },
  { id: 'eye', icon: Eye },
  { id: 'heart', icon: HeartHandshake },
  { id: 'megaphone', icon: Megaphone },
  { id: 'mapPin', icon: MapPin },
  { id: 'clock', icon: Clock },
  { id: 'tag', icon: Tag },
  { id: 'bookmark', icon: Bookmark },
  { id: 'hardHat', icon: HardHat },
  { id: 'plug', icon: Plug },
  { id: 'sun', icon: Sun },
  { id: 'moon', icon: Moon },
  { id: 'layers', icon: Layers },
  { id: 'boxes', icon: Boxes },
  { id: 'settings', icon: Settings },
  { id: 'archive', icon: Archive },
  { id: 'info', icon: Info }
];

const COLOR_THEMES = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    hoverBorder: 'hover:border-blue-400',
    text: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    hoverBorder: 'hover:border-emerald-400',
    text: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  sky: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    hoverBorder: 'hover:border-sky-400',
    text: 'text-sky-600',
    badge: 'bg-sky-100 text-sky-800 border-sky-200'
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    hoverBorder: 'hover:border-amber-400',
    text: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  purple: {
    bg: 'purple-50',
    border: 'border-purple-200',
    hoverBorder: 'hover:border-purple-400',
    text: 'text-purple-600',
    badge: 'bg-purple-100 text-purple-800 border-purple-200'
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    hoverBorder: 'hover:border-rose-400',
    text: 'text-rose-600',
    badge: 'bg-rose-100 text-rose-800 border-rose-200'
  },
  slate: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    hoverBorder: 'hover:border-slate-400',
    text: 'text-slate-600',
    badge: 'bg-slate-100 text-slate-800 border-slate-200'
  }
};

export function RepresentativeSections({ profileNavigation, onOpenEditTx }) {
  const { state, saveInfoSections, showToast } = useApp();
  const { infoSections, currentUser, currentLang } = state;
  const isEn = currentLang === 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [focusedCaseId, setFocusedCaseId] = useState(null);
  const [expandedCaseIds, setExpandedCaseIds] = useState({}); // { [caseId]: boolean }
  const [previewImage, setPreviewImage] = useState(null); // { url, name }
  const getBackdropProps = useBackdropPropsFactory();

  const toggleCaseExpanded = (caseId) => {
    setExpandedCaseIds(prev => ({
      ...prev,
      [caseId]: !prev[caseId]
    }));
  };

  const isImageFile = (att) => {
    if (!att) return false;
    if (att.fileType && att.fileType.startsWith('image/')) return true;
    const name = att.fileName || att.name || '';
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name);
  };
  const [linkingCaseItem, setLinkingCaseItem] = useState(null); // { tileId, item } | null
  const [linkTxSearch, setLinkTxSearch] = useState('');
  const [linkTxFilter, setLinkTxFilter] = useState('all'); // 'all' | 'expenses' | 'payments'
  const [isTileEditMode, setIsTileEditMode] = useState(false);
  const [addMenuTileId, setAddMenuTileId] = useState(null);
  const [isModalAddMenuOpen, setIsModalAddMenuOpen] = useState(false);
  const [isDraggingTileDocs, setIsDraggingTileDocs] = useState(false);
  const tileDocFileInputRef = useRef(null);

  // Modals state for Tile (Section)
  const [isTileModalOpen, setIsTileModalOpen] = useState(false);
  const [editingTile, setEditingTile] = useState(null);
  const [tileModules, setTileModules] = useState(['contacts']);
  const [tileType, setTileType] = useState('contact_only');
  const [tileTitle, setTileTitle] = useState('');
  const [tileSubtitle, setTileSubtitle] = useState('');
  const [tileIcon, setTileIcon] = useState('landmark');
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [tileColor, setTileColor] = useState('emerald');
  const [tileDescription, setTileDescription] = useState('');

  // Custom fields state within detail view
  const [editingFieldId, setEditingFieldId] = useState(null); // null | 'new' | fieldId
  const [fieldLabelInput, setFieldLabelInput] = useState('');
  const [fieldValueInput, setFieldValueInput] = useState('');

  // Notes editing within detail view (supports multiple custom-titled note textboxes)
  const [editingNoteId, setEditingNoteId] = useState(null); // null | 'new' | noteId
  const [noteTitleInput, setNoteTitleInput] = useState('');
  const [noteContentInput, setNoteContentInput] = useState('');

  // Helper to retrieve notes list (with backward-compatible migration of legacy description)
  const getTileNotes = (tile) => {
    if (!tile) return [];
    if (Array.isArray(tile.notesList) && tile.notesList.length > 0) {
      return tile.notesList;
    }
    if (tile.description && tile.description.trim()) {
      return [
        {
          id: 'note-legacy',
          title: 'Általános feljegyzés',
          content: tile.description.trim(),
          date: ''
        }
      ];
    }
    return [];
  };

  // Quick info editing within detail view
  const [isEditingQuickInfo, setIsEditingQuickInfo] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickAccount, setQuickAccount] = useState('');
  const [quickUserPlaceNumber, setQuickUserPlaceNumber] = useState('');
  const [quickMeterNumber, setQuickMeterNumber] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [copiedField, setCopiedField] = useState(null);

  // Item modal state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemCategory, setItemCategory] = useState('case'); // 'case' | 'meter'
  const [itemTitle, setItemTitle] = useState('');
  const [itemSubtitle, setItemSubtitle] = useState('');
  const [itemDate, setItemDate] = useState('');
  const [itemStatus, setItemStatus] = useState('Folyamatban');
  const [itemDetails, setItemDetails] = useState([]);

  // Cases filter & chronological sort state
  const [caseStatusFilter, setCaseStatusFilter] = useState('all'); // 'all' | 'Folyamatban' | 'Lezárt'
  const [caseSortOrder, setCaseSortOrder] = useState('desc'); // 'desc' (newest first) | 'asc' (oldest first)

  // Comment input per item: { [itemId]: string }
  const [commentInputs, setCommentInputs] = useState({});

  // Custom confirmation modal states (replaces browser window.confirm)
  const [tileToDelete, setTileToDelete] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);

  const tilesList = infoSections || [];
  const selectedTile = tilesList.find(t => t.id === selectedTileId) || null;

  const handleCloseTileDetail = () => {
    setSelectedTileId(null);
    setIsTileEditMode(false);
    setIsEditingQuickInfo(false);
    setEditingFieldId(null);
    setFieldLabelInput('');
    setFieldValueInput('');
    setEditingNoteId(null);
    setNoteTitleInput('');
    setNoteContentInput('');
    setIsTileModalOpen(false);
    setEditingTile(null);
    setIsItemModalOpen(false);
    setEditingItem(null);
    setLinkingCaseItem(null);
    setLinkTxSearch('');
    setFocusedCaseId(null);
    setPreviewImage(null);
    setExpandedCaseIds({});
    setIsModalAddMenuOpen(false);
    setAddMenuTileId(null);
    setCaseStatusFilter('all');
    setCaseSortOrder('desc');
  };

  const handleCloseTileModal = () => {
    setIsTileModalOpen(false);
    setEditingTile(null);
    setTileTitle('');
    setTileSubtitle('');
    setTileDescription('');
    setIsIconPickerOpen(false);
  };

  const handleCloseItemModal = () => {
    setIsItemModalOpen(false);
    setEditingItem(null);
    setItemTitle('');
    setItemSubtitle('');
    setItemDate('');
    setItemStatus('Folyamatban');
    setItemDetails([]);
  };

  const handleCancelQuickInfo = () => {
    setIsEditingQuickInfo(false);
    if (selectedTile) {
      const q = selectedTile.quickInfo || {};
      setQuickName(q.name || '');
      setQuickPhone(q.phone ? formatPhoneNumber(q.phone) : '');
      setQuickEmail(q.email || '');
      setQuickAccount(q.accountOrPolicy || '');
      setQuickUserPlaceNumber(q.userPlaceNumber || '');
      setQuickMeterNumber(q.meterNumber || '');
      setQuickNotes(q.notes || '');
    }
  };

  // Helper to normalize case statuses strictly to "Folyamatban" or "Lezárt"
  const normalizeCaseStatus = (status) => {
    if (!status) return 'Folyamatban';
    const s = String(status).trim().toLowerCase();
    if (s === 'lezárt' || s === 'lezart' || s === 'elintézve' || s === 'elintezve') {
      return 'Lezárt';
    }
    return 'Folyamatban';
  };

  // Helper to determine active tile type
  const getTileType = (tile) => {
    if (!tile) return 'contact_only';
    if (tile.tileType) return tile.tileType;
    // Backward compatibility inference
    if (tile.id === 'sec-bank') return 'contact_only';
    if (tile.id === 'sec-meters') return 'info_and_readings';
    if (tile.items && tile.items.length > 0) return 'contact_and_cases';
    return 'contact_only';
  };

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
    showToast(isEn ? "Copied to clipboard!" : "Másolva a vágólapra!");
  };

  // Always collapse all cases by default when switching tiles
  useEffect(() => {
    setExpandedCaseIds({});
  }, [selectedTileId]);

  // Handle direct navigation to a case from external views
  useEffect(() => {
    if (profileNavigation && profileNavigation.tileId) {
      setSelectedTileId(profileNavigation.tileId);
      if (profileNavigation.caseId) {
        setFocusedCaseId(profileNavigation.caseId);
        setExpandedCaseIds(prev => ({ ...prev, [profileNavigation.caseId]: true }));
        setTimeout(() => {
          const el = document.getElementById(`case-item-${profileNavigation.caseId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 350);
        const timer = setTimeout(() => {
          setFocusedCaseId(null);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [profileNavigation]);

  // Close discreet add menu if clicked outside
  useEffect(() => {
    if (!addMenuTileId) return;
    const handleOutsideClick = () => {
      setAddMenuTileId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [addMenuTileId]);

  // Handle ESC key to close modal layers gracefully
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (previewImage) {
          setPreviewImage(null);
        } else if (linkingCaseItem) {
          setLinkingCaseItem(null);
        } else if (itemToDelete) {
          setItemToDelete(null);
        } else if (tileToDelete) {
          setTileToDelete(null);
        } else if (isItemModalOpen) {
          handleCloseItemModal();
        } else if (isTileModalOpen) {
          handleCloseTileModal();
        } else if (selectedTileId) {
          handleCloseTileDetail();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage, linkingCaseItem, itemToDelete, tileToDelete, isItemModalOpen, isTileModalOpen, selectedTileId]);

  // Combined list of all expenses and transactions for linking
  const allAccountingItems = useMemo(() => {
    const tx = (state.transactions || []).map(t => ({
      ...t,
      isExpense: false,
      itemType: 'Transaction',
      titleDisplay: (t.flatNum === 'Global' || !t.flatNum || t.flatNum === 'Egyéb') 
        ? (t.title?.trim() || t.comment?.trim() || (isEn ? 'Condominium' : 'Társasház')) 
        : `${t.flatNum}. lakás befizetés`,
      subDisplay: t.comment || t.method || '',
      amountDisplay: t.amount,
      dateStr: t.date || ''
    }));
    const exp = (state.expenses || []).map(e => ({
      ...e,
      isExpense: true,
      itemType: 'Expense',
      titleDisplay: e.title?.trim() || e.comment?.trim() || e.provider || (isEn ? 'Expense' : 'Kiadás'),
      subDisplay: e.provider || e.category || '',
      amountDisplay: e.amount,
      dateStr: e.date || ''
    }));
    const combined = [...tx, ...exp];
    combined.sort((a, b) => (b.dateStr || '').localeCompare(a.dateStr || ''));
    return combined;
  }, [state.transactions, state.expenses, isEn]);

  // Toggle link/unlink transaction or expense to/from a case
  const handleToggleLinkTxOnItem = (tileId, itemId, txId) => {
    const updatedTiles = tilesList.map(tile => {
      if (tile.id !== tileId) return tile;
      const updatedItems = (tile.items || []).map(it => {
        if (it.id !== itemId) return it;
        const currentLinks = Array.isArray(it.linkedTxIds) ? it.linkedTxIds : [];
        const exists = currentLinks.includes(txId);
        const nextLinks = exists 
          ? currentLinks.filter(id => id !== txId)
          : [...currentLinks, txId];
        return {
          ...it,
          linkedTxIds: nextLinks
        };
      });
      return {
        ...tile,
        items: updatedItems
      };
    });
    saveInfoSections(updatedTiles);
    showToast(isEn ? 'Accounting link updated' : 'Könyvelési tétel összekapcsolása módosult');
  };

  // --- Tile CRUD ---
  const handleOpenAddTile = () => {
    setEditingTile(null);
    setTileModules(['contacts']);
    setTileType('contact_only');
    setTileTitle('');
    setTileSubtitle('');
    setTileIcon('landmark');
    setIsIconPickerOpen(false);
    setTileColor('emerald');
    setTileDescription('');
    setIsTileModalOpen(true);
  };

  const handleOpenEditTile = (tile) => {
    const activeMods = getTileModules(tile);
    setEditingTile(tile);
    setTileModules(activeMods);
    setTileType(tile.tileType || (activeMods.includes('cases') ? 'contact_and_cases' : (activeMods.includes('meters') ? 'info_and_readings' : 'contact_only')));
    setTileTitle(tile.title || '');
    setTileSubtitle(tile.subtitle || '');
    setTileIcon(tile.icon || 'shield');
    setIsIconPickerOpen(false);
    setTileColor(tile.color || 'blue');
    setTileDescription(tile.description || '');
    setIsTileModalOpen(true);
  };

  const handleSaveTile = (e) => {
    e.preventDefault();
    if (!tileTitle.trim()) return;

    const chosenModules = tileModules && tileModules.length > 0 ? tileModules : ['contacts'];
    const inferredTileType = chosenModules.includes('cases')
      ? 'contact_and_cases'
      : (chosenModules.includes('meters') ? 'info_and_readings' : 'contact_only');

    let updated;
    if (editingTile) {
      updated = tilesList.map(t => {
        if (t.id === editingTile.id) {
          return {
            ...t,
            modules: chosenModules,
            tileType: inferredTileType,
            title: tileTitle.trim(),
            subtitle: tileSubtitle.trim(),
            icon: tileIcon,
            color: tileColor,
            description: tileDescription.trim()
          };
        }
        return t;
      });
      showToast(isEn ? "Tile updated!" : "Csempe frissítve!");
    } else {
      const newTile = {
        id: `tile-${Date.now()}`,
        modules: chosenModules,
        tileType: inferredTileType,
        title: tileTitle.trim(),
        subtitle: tileSubtitle.trim(),
        icon: tileIcon,
        color: tileColor,
        description: tileDescription.trim(),
        quickInfo: {},
        items: [],
        documents: []
      };
      updated = [...tilesList, newTile];
      showToast(isEn ? "New tile added!" : "Új csempe sikeresen hozzáadva!");
    }

    saveInfoSections(updated);
    setIsTileModalOpen(false);
  };

  // --- Dynamic Module Toggle Directly on Tile ---
  const handleToggleModuleOnTile = (tileId, moduleId) => {
    const targetTile = tilesList.find(t => t.id === tileId);
    if (!targetTile) return;

    const currentModules = getTileModules(targetTile);
    const hasMod = currentModules.includes(moduleId);
    let nextModules;
    if (hasMod) {
      if (currentModules.length <= 1) {
        showToast(isEn ? "At least one section must remain active!" : "Legalább egy résznek aktívnak kell maradnia!");
        return;
      }
      nextModules = currentModules.filter(m => m !== moduleId);
    } else {
      nextModules = [...currentModules, moduleId];
    }

    const modDef = AVAILABLE_MODULES.find(m => m.id === moduleId);
    const updated = tilesList.map(t => {
      if (t.id === tileId) {
        return {
          ...t,
          modules: nextModules,
          tileType: nextModules.includes('cases') 
            ? 'contact_and_cases' 
            : (nextModules.includes('meters') ? 'info_and_readings' : 'contact_only')
        };
      }
      return t;
    });

    saveInfoSections(updated);
    showToast(
      hasMod 
        ? `${modDef?.title || 'Modul'} eltávolítva!` 
        : `${modDef?.title || 'Modul'} hozzáadva a csempéhez!`
    );
  };

  // --- Tile Level Documents Upload & Delete (Multiple Files & Drag and Drop) ---
  const handleTileDocumentUpload = (tileId, eventOrFiles) => {
    let files = [];
    if (eventOrFiles?.target?.files) {
      files = Array.from(eventOrFiles.target.files);
    } else if (eventOrFiles?.dataTransfer?.files) {
      files = Array.from(eventOrFiles.dataTransfer.files);
    } else if (Array.isArray(eventOrFiles)) {
      files = eventOrFiles;
    } else if (eventOrFiles instanceof FileList) {
      files = Array.from(eventOrFiles);
    }

    if (files.length === 0) return;

    Promise.all(files.map(file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        fileName: file.name,
        fileSize: file.size < 1024 * 1024 
          ? `${(file.size / 1024).toFixed(1)} KB` 
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        fileType: file.type || 'application/octet-stream',
        fileData: e.target.result,
        date: new Date().toISOString().slice(0, 10)
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }))).then(newDocs => {
      const updated = tilesList.map(t => {
        if (t.id === tileId) {
          return {
            ...t,
            documents: [...(t.documents || []), ...newDocs]
          };
        }
        return t;
      });

      saveInfoSections(updated);
      const msg = newDocs.length === 1 
        ? (isEn ? "Document attached!" : "Dokumentum sikeresen csatolva!") 
        : (isEn ? `${newDocs.length} documents attached!` : `${newDocs.length} dokumentum sikeresen csatolva!`);
      showToast(msg);
    }).catch(err => {
      console.error("Tile document upload error:", err);
      showToast(isEn ? "Error uploading documents!" : "Hiba történt a fájlok beolvasásakor!");
    });

    if (eventOrFiles?.target) {
      eventOrFiles.target.value = '';
    }
  };

  const handleDeleteTileDocument = (tileId, docId) => {
    const updated = tilesList.map(t => {
      if (t.id === tileId) {
        return {
          ...t,
          documents: (t.documents || []).filter(d => d.id !== docId)
        };
      }
      return t;
    });

    saveInfoSections(updated);
    showToast(isEn ? "Document deleted!" : "Dokumentum eltávolítva!");
  };

  // --- Custom Fields CRUD ---
  const handleStartAddField = () => {
    setEditingFieldId('new');
    setFieldLabelInput('');
    setFieldValueInput('');
  };

  const handleStartEditField = (field) => {
    setEditingFieldId(field.id);
    setFieldLabelInput(field.label || '');
    setFieldValueInput(field.value || '');
  };

  const handleCancelEditField = () => {
    setEditingFieldId(null);
    setFieldLabelInput('');
    setFieldValueInput('');
  };

  const handleSaveCustomField = (tileId) => {
    if (!fieldLabelInput.trim() || !fieldValueInput.trim()) {
      showToast(isEn ? "Please fill in both label and value!" : "Kérlek add meg a megnevezést és az értéket is!");
      return;
    }

    const updated = tilesList.map(t => {
      if (t.id === tileId) {
        const currentFields = t.customFields || [];
        let nextFields;
        if (editingFieldId === 'new') {
          nextFields = [
            ...currentFields,
            {
              id: `cf-${Date.now()}`,
              label: fieldLabelInput.trim(),
              value: fieldValueInput.trim()
            }
          ];
        } else {
          nextFields = currentFields.map(f => f.id === editingFieldId ? {
            ...f,
            label: fieldLabelInput.trim(),
            value: fieldValueInput.trim()
          } : f);
        }
        return {
          ...t,
          customFields: nextFields
        };
      }
      return t;
    });

    saveInfoSections(updated);
    handleCancelEditField();
    showToast(isEn ? "Field saved!" : "Egyedi adat sikeresen mentve!");
  };

  const handleDeleteCustomField = (tileId, fieldId) => {
    const updated = tilesList.map(t => {
      if (t.id === tileId) {
        return {
          ...t,
          customFields: (t.customFields || []).filter(f => f.id !== fieldId)
        };
      }
      return t;
    });

    saveInfoSections(updated);
    showToast(isEn ? "Field deleted!" : "Egyedi adat törölve!");
  };

  // --- Notes (Multiple Textboxes) CRUD ---
  const handleStartAddNote = () => {
    setEditingNoteId('new');
    setNoteTitleInput('');
    setNoteContentInput('');
  };

  const handleStartEditNote = (note) => {
    setEditingNoteId(note.id);
    setNoteTitleInput(note.title || '');
    setNoteContentInput(note.content || '');
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setNoteTitleInput('');
    setNoteContentInput('');
  };

  const handleSaveNote = (tileId) => {
    if (!noteTitleInput.trim() && !noteContentInput.trim()) {
      showToast(isEn ? "Please enter a title or note text!" : "Kérlek adj meg egy címet vagy jegyzet szöveget!");
      return;
    }

    const tile = tilesList.find(t => t.id === tileId);
    if (!tile) return;

    const currentNotes = getTileNotes(tile);
    let nextNotes;
    const nowStr = new Date().toLocaleDateString('hu-HU') + ' ' + new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

    if (editingNoteId === 'new') {
      nextNotes = [
        ...currentNotes,
        {
          id: `note-${Date.now()}`,
          title: noteTitleInput.trim() || 'Jegyzet',
          content: noteContentInput.trim(),
          date: nowStr
        }
      ];
    } else {
      nextNotes = currentNotes.map(n => n.id === editingNoteId ? {
        ...n,
        title: noteTitleInput.trim() || 'Jegyzet',
        content: noteContentInput.trim(),
        date: nowStr
      } : n);
    }

    const updated = tilesList.map(t => {
      if (t.id === tileId) {
        return {
          ...t,
          notesList: nextNotes,
          description: nextNotes.map(n => `${n.title}:\n${n.content}`).join('\n\n')
        };
      }
      return t;
    });

    saveInfoSections(updated);
    handleCancelEditNote();
    showToast(isEn ? "Note box saved!" : "Szövegdoboz sikeresen mentve!");
  };

  const handleDeleteNote = (tileId, noteId) => {
    const tile = tilesList.find(t => t.id === tileId);
    if (!tile) return;

    const currentNotes = getTileNotes(tile);
    const nextNotes = currentNotes.filter(n => n.id !== noteId);

    const updated = tilesList.map(t => {
      if (t.id === tileId) {
        return {
          ...t,
          notesList: nextNotes,
          description: nextNotes.map(n => `${n.title}:\n${n.content}`).join('\n\n')
        };
      }
      return t;
    });

    saveInfoSections(updated);
    showToast(isEn ? "Note box deleted!" : "Szövegdoboz törölve!");
  };

  // --- Tile Deletion with Custom Modal ---
  const handleRequestDeleteTile = (tile) => {
    if (!tile) return;
    setTileToDelete(tile);
  };

  const handleExecuteDeleteTile = (tileId) => {
    const updated = tilesList.filter(t => t.id !== tileId);
    saveInfoSections(updated);
    if (selectedTileId === tileId) {
      handleCloseTileDetail();
    }
    showToast(isEn ? "Tile deleted!" : "Csempe törölve!");
  };

  // --- Quick Info Save ---
  const handleStartEditQuickInfo = () => {
    if (!selectedTile) return;
    const q = selectedTile.quickInfo || {};
    setQuickName(q.name || '');
    setQuickPhone(q.phone ? formatPhoneNumber(q.phone) : '');
    setQuickEmail(q.email || '');
    setQuickAccount(q.accountOrPolicy || '');
    setQuickUserPlaceNumber(q.userPlaceNumber || '');
    setQuickMeterNumber(q.meterNumber || '');
    setQuickNotes(q.notes || '');
    setIsEditingQuickInfo(true);
  };

  const handleSaveQuickInfo = (e) => {
    e.preventDefault();
    if (!selectedTile) return;

    const formattedPhone = quickPhone ? formatPhoneNumber(quickPhone.trim()) : '';
    setQuickPhone(formattedPhone);

    const newQuick = {
      ...(selectedTile.quickInfo || {}),
      name: quickName.trim(),
      phone: formattedPhone,
      email: quickEmail.trim(),
      accountOrPolicy: quickAccount.trim(),
      userPlaceNumber: quickUserPlaceNumber.trim(),
      meterNumber: quickMeterNumber.trim(),
      notes: quickNotes.trim()
    };

    const updated = tilesList.map(t => {
      if (t.id === selectedTile.id) {
        return {
          ...t,
          quickInfo: newQuick
        };
      }
      return t;
    });

    saveInfoSections(updated);
    setIsEditingQuickInfo(false);
    showToast(isEn ? "Info updated!" : "Adatok mentve!");
  };

  // --- Item CRUD within Tile ---
  const handleOpenAddItem = (customDefaultStatus = null, category = 'case') => {
    setEditingItem(null);
    setItemCategory(category);
    setItemTitle('');
    setItemSubtitle('');
    setItemDate(new Date().toISOString().slice(0, 10));
    if (customDefaultStatus) {
      setItemStatus(category === 'meter' ? customDefaultStatus : normalizeCaseStatus(customDefaultStatus));
    } else if (category === 'meter') {
      setItemStatus('Elintézve');
    } else {
      setItemStatus('Folyamatban');
    }
    setItemDetails([]);
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item) => {
    setEditingItem(item);
    const cat = item.category || (item.status === 'Elintézve' && item.details && (item.details['Mérőállás'] || item.details['Leolvasás']) ? 'meter' : 'case');
    setItemCategory(cat);
    setItemTitle(item.title || '');
    setItemSubtitle(item.subtitle || '');
    setItemDate(item.date || '');
    
    let statusVal = item.status || 'Folyamatban';
    if (cat !== 'meter') {
      statusVal = normalizeCaseStatus(statusVal);
    }
    setItemStatus(statusVal);

    const detailsArray = [];
    if (item.details && typeof item.details === 'object') {
      Object.entries(item.details).forEach(([key, val]) => {
        detailsArray.push({ key, val });
      });
    }
    setItemDetails(detailsArray);
    setIsItemModalOpen(true);
  };

  const handleAddDetailRow = () => {
    setItemDetails(prev => [...prev, { key: '', val: '' }]);
  };

  const handleDetailChange = (index, field, value) => {
    setItemDetails(prev => {
      const next = [...prev];
      next[index][field] = value;
      return next;
    });
  };

  const handleRemoveDetailRow = (index) => {
    setItemDetails(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveItem = (e) => {
    e.preventDefault();
    if (!itemTitle.trim() || !selectedTile) return;

    const detailsObj = {};
    itemDetails.forEach(row => {
      if (row.key.trim() && row.val.trim()) {
        detailsObj[row.key.trim()] = row.val.trim();
      }
    });

    const finalStatus = itemCategory === 'meter' ? itemStatus : normalizeCaseStatus(itemStatus);

    const updated = tilesList.map(t => {
      if (t.id === selectedTile.id) {
        const currentItems = t.items || [];
        let updatedItems;

        if (editingItem) {
          updatedItems = currentItems.map(it => {
            if (it.id === editingItem.id) {
              return {
                ...it,
                category: itemCategory,
                title: itemTitle.trim(),
                subtitle: itemSubtitle.trim(),
                date: itemDate,
                status: finalStatus,
                details: detailsObj
              };
            }
            return it;
          });
        } else {
          const newItem = {
            id: `item-${Date.now()}`,
            category: itemCategory,
            title: itemTitle.trim(),
            subtitle: itemSubtitle.trim(),
            date: itemDate,
            status: finalStatus,
            details: detailsObj,
            attachments: [],
            comments: []
          };
          updatedItems = [newItem, ...currentItems];
        }

        return {
          ...t,
          items: updatedItems
        };
      }
      return t;
    });

    saveInfoSections(updated);
    setIsItemModalOpen(false);
    showToast(isEn ? "Saved successfully!" : "Tétel sikeresen rögzítve!");
  };

  // --- Item Deletion with Custom Modal ---
  const handleRequestDeleteItem = (item) => {
    if (!item) return;
    setItemToDelete(item);
  };

  const handleExecuteDeleteItem = (itemId) => {
    if (!selectedTile) return;
    const updated = tilesList.map(t => {
      if (t.id === selectedTile.id) {
        return {
          ...t,
          items: (t.items || []).filter(it => it.id !== itemId)
        };
      }
      return t;
    });

    saveInfoSections(updated);
    showToast(isEn ? "Item deleted!" : "Tétel törölve!");
  };

  // --- Attachments / Files (Multiple Files & Drag and Drop) ---
  const handleFileUpload = (itemId, eventOrFiles) => {
    let files = [];
    if (eventOrFiles?.target?.files) {
      files = Array.from(eventOrFiles.target.files);
    } else if (eventOrFiles?.dataTransfer?.files) {
      files = Array.from(eventOrFiles.dataTransfer.files);
    } else if (Array.isArray(eventOrFiles)) {
      files = eventOrFiles;
    } else if (eventOrFiles instanceof FileList) {
      files = Array.from(eventOrFiles);
    }

    if (files.length === 0 || !selectedTile) return;

    Promise.all(files.map(file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        fileName: file.name,
        fileSize: file.size < 1024 * 1024 
          ? `${(file.size / 1024).toFixed(1)} KB` 
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        fileType: file.type || 'application/octet-stream',
        fileData: e.target.result
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }))).then(newAttachments => {
      const updated = tilesList.map(t => {
        if (t.id === selectedTile.id) {
          const updatedItems = (t.items || []).map(it => {
            if (it.id === itemId) {
              return {
                ...it,
                attachments: [...(it.attachments || []), ...newAttachments]
              };
            }
            return it;
          });
          return { ...t, items: updatedItems };
        }
        return t;
      });

      saveInfoSections(updated);
      const msg = newAttachments.length === 1 
        ? (isEn ? "File attached!" : "Fájl sikeresen csatolva!") 
        : (isEn ? `${newAttachments.length} files attached!` : `${newAttachments.length} fájl sikeresen csatolva!`);
      showToast(msg);
    }).catch(err => {
      console.error("Item file upload error:", err);
      showToast(isEn ? "Error uploading files!" : "Hiba történt a fájlok feltöltésekor!");
    });

    if (eventOrFiles?.target) {
      eventOrFiles.target.value = '';
    }
  };

  const handleDownloadAttachment = (att) => {
    if (!att || !att.fileData) return;
    const link = document.createElement('a');
    link.href = att.fileData;
    link.download = att.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteAttachment = (itemId, attId) => {
    const updated = tilesList.map(t => {
      if (t.id === selectedTile.id) {
        const updatedItems = (t.items || []).map(it => {
          if (it.id === itemId) {
            return {
              ...it,
              attachments: (it.attachments || []).filter(a => a.id !== attId)
            };
          }
          return it;
        });
        return { ...t, items: updatedItems };
      }
      return t;
    });

    saveInfoSections(updated);
    showToast(isEn ? "Attachment deleted!" : "Csatolmány eltávolítva!");
  };

  // --- Comments ---
  const handleAddComment = (itemId) => {
    const text = (commentInputs[itemId] || '').trim();
    if (!text || !selectedTile) return;

    const newComment = {
      id: `c-${Date.now()}`,
      author: currentUser?.name || "Közös Képviselő",
      date: new Date().toLocaleDateString('hu-HU') + ' ' + new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }),
      text
    };

    const updated = tilesList.map(t => {
      if (t.id === selectedTile.id) {
        const updatedItems = (t.items || []).map(it => {
          if (it.id === itemId) {
            return {
              ...it,
              comments: [...(it.comments || []), newComment]
            };
          }
          return it;
        });
        return { ...t, items: updatedItems };
      }
      return t;
    });

    saveInfoSections(updated);
    setCommentInputs(prev => ({ ...prev, [itemId]: '' }));
    showToast(isEn ? "Comment added!" : "Megjegyzés hozzáadva!");
  };

  const handleDeleteComment = (itemId, commentId) => {
    const updated = tilesList.map(t => {
      if (t.id === selectedTile.id) {
        const updatedItems = (t.items || []).map(it => {
          if (it.id === itemId) {
            return {
              ...it,
              comments: (it.comments || []).filter(c => c.id !== commentId)
            };
          }
          return it;
        });
        return { ...t, items: updatedItems };
      }
      return t;
    });

    saveInfoSections(updated);
  };

  const getStatusBadge = (status, category = 'case') => {
    if (category === 'meter') {
      return (status === 'Elintézve' || status === 'Lezárt')
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';
    }
    const norm = normalizeCaseStatus(status);
    if (norm === 'Lezárt') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  // Search filtering
  const q = searchQuery.toLowerCase().trim();
  const filteredTiles = tilesList.filter(tile => {
    if (!q) return true;
    if (tile.title && tile.title.toLowerCase().includes(q)) return true;
    if (tile.subtitle && tile.subtitle.toLowerCase().includes(q)) return true;
    if (tile.description && tile.description.toLowerCase().includes(q)) return true;
    if (tile.customFields && tile.customFields.some(cf => (cf.label && cf.label.toLowerCase().includes(q)) || (cf.value && cf.value.toLowerCase().includes(q)))) return true;
    if (tile.notesList && tile.notesList.some(n => (n.title && n.title.toLowerCase().includes(q)) || (n.content && n.content.toLowerCase().includes(q)))) return true;
    if (tile.quickInfo) {
      const qValues = Object.values(tile.quickInfo);
      if (qValues.some(v => v && v.toLowerCase().includes(q))) return true;
    }
    return (tile.items || []).some(it => {
      if (it.title && it.title.toLowerCase().includes(q)) return true;
      if (it.subtitle && it.subtitle.toLowerCase().includes(q)) return true;
      if (it.status && (it.status.toLowerCase().includes(q) || normalizeCaseStatus(it.status).toLowerCase().includes(q))) return true;
      if (it.details && Object.values(it.details).some(v => v && v.toLowerCase().includes(q))) return true;
      return false;
    });
  });

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="text-base sm:text-lg font-bold text-gray-900 font-display">
                {isEn ? "Condo Incident & Information Hub" : "Társasházi Nyilvántartások & Csempék"}
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isEn 
                ? "Click on any tile to view detailed records, damage claims, meters and contacts." 
                : "Kattints a csempékre a részletes adatok, kárbejelentések, mérőórák és elérhetőségek megtekintéséhez."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAddTile}
            className="px-4 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{isEn ? "New Tile" : "+ Új csempe hozzáadása"}</span>
          </button>
        </div>

        {/* Search Bar */}
        {tilesList.length > 0 && (
          <div className="relative mt-4">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEn ? "Search in tiles, claims, banks, meters, contractors..." : "Keresés a csempékben, kárbejelentésekben, bankokban, vízórákban..."}
              className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-colors"
            />
          </div>
        )}
      </div>

      {/* --- GRID OF TILES (Csempék nézet) --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTiles.map(tile => {
          const IconComponent = ICON_MAP[tile.icon] || Shield;
          const theme = COLOR_THEMES[tile.color] || COLOR_THEMES.blue;

          return (
            <div
              key={tile.id}
              onClick={() => {
                setSelectedTileId(tile.id);
                setIsTileEditMode(false);
                setIsModalAddMenuOpen(false);
                setAddMenuTileId(null);
              }}
              className={`bg-white rounded-2xl border ${theme.border} ${theme.hoverBorder} shadow-xs hover:shadow-md transition-all cursor-pointer p-5 flex flex-col justify-between group relative`}
            >
              {/* Top Row: Icon and Actions */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className={`w-12 h-12 rounded-2xl ${theme.bg} ${theme.text} flex items-center justify-center shadow-xs transition-transform group-hover:scale-105`}>
                  <IconComponent className="w-6 h-6" />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditTile(tile);
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    title={isEn ? "Edit Tile" : "Csempe szerkesztése"}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRequestDeleteTile(tile);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title={isEn ? "Delete Tile" : "Csempe törlése"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-1 mb-4">
                <h4 className="text-base font-bold text-gray-900 group-hover:text-[#1E3A8A] transition-colors leading-snug">
                  {tile.title}
                </h4>
                {tile.subtitle ? (
                  <p className="text-xs text-gray-500 font-medium truncate">
                    {tile.subtitle}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    Kattints a részletekért
                  </p>
                )}
              </div>

              {/* Bottom Footer: Discreet Add Module & Open Arrow */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs relative">
                {/* Left: Discreet plus sign to add a module if any is inactive */}
                {(() => {
                  const activeMods = getTileModules(tile);
                  const unaddedMods = AVAILABLE_MODULES.filter(m => !activeMods.includes(m.id));
                  if (unaddedMods.length === 0) return <div />;

                  const isOpen = addMenuTileId === tile.id;

                  return (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddMenuTileId(isOpen ? null : tile.id);
                        }}
                        className="px-2 py-1 rounded-lg border border-dashed border-gray-300 hover:border-[#1E3A8A] bg-gray-50/80 hover:bg-blue-50 text-gray-500 hover:text-[#1E3A8A] flex items-center gap-1.5 transition-all cursor-pointer text-[11px] font-medium group"
                        title="További rész hozzáadása ehhez a csempéhez"
                      >
                        <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        <span className="hidden sm:inline">Rész hozzáadása</span>
                      </button>

                      {isOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-30 animate-fadeIn space-y-1"
                        >
                          <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1 flex items-center justify-between">
                            <span>Rész hozzáadása:</span>
                            <button
                              type="button"
                              onClick={() => setAddMenuTileId(null)}
                              className="text-gray-400 hover:text-gray-600 cursor-pointer p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          {unaddedMods.map(mod => {
                            const ModIcon = mod.icon;
                            return (
                              <button
                                key={mod.id}
                                type="button"
                                onClick={() => {
                                  handleToggleModuleOnTile(tile.id, mod.id);
                                  setAddMenuTileId(null);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-[#1E3A8A] flex items-center gap-2 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <ModIcon className="w-4 h-4 text-[#1E3A8A] flex-shrink-0" />
                                <span className="truncate">{mod.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Right: Megnyitás */}
                <div className="flex items-center gap-1 text-[#1E3A8A] font-bold text-xs group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                  <span>Megnyitás</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Tile Dashed Card */}
        <button
          type="button"
          onClick={handleOpenAddTile}
          className="border-2 border-dashed border-gray-300 hover:border-[#1E3A8A] hover:bg-blue-50/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[160px] group"
        >
          <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-[#1E3A8A] flex items-center justify-center transition-colors mb-2">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold text-gray-800 group-hover:text-[#1E3A8A] transition-colors">
            {isEn ? "Add New Tile" : "+ Új csempe hozzáadása"}
          </span>
          <span className="text-xs text-gray-400 mt-0.5">
            Gyors és egyszerű új csempe készítése
          </span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* --- MODAL: TILE DETAIL VIEW (Részletes csempe nézet) --- */}
      {/* ============================================================ */}
      {selectedTile && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain animate-fadeIn cursor-default"
          {...getBackdropProps(handleCloseTileDetail)}
        >
          <div 
            className="bg-[#F8FAFC] rounded-2xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto overscroll-contain cursor-default"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            {(() => {
              const TileIcon = ICON_MAP[selectedTile.icon] || Shield;
              const theme = COLOR_THEMES[selectedTile.color] || COLOR_THEMES.blue;

              return (
                <div className="bg-white border-b border-gray-200 p-4 sm:p-5 flex items-center justify-between gap-3 sticky top-0 z-10">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={handleCloseTileDetail}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold flex-shrink-0"
                      title="Vissza a csempékhez"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Vissza</span>
                    </button>

                    <div className={`w-10 h-10 rounded-xl ${theme.bg} ${theme.text} flex items-center justify-center flex-shrink-0 shadow-2xs`}>
                      <TileIcon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate font-display">
                        {selectedTile.title}
                      </h3>
                      {selectedTile.subtitle && (
                        <p className="text-xs text-gray-500 truncate">
                          {selectedTile.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsTileEditMode(prev => !prev)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                        isTileEditMode 
                          ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-xs' 
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                      title={isTileEditMode ? "Szerkesztési mód befejezése" : "Csempe szerkesztése (új részek hozzáadása, törlése)"}
                    >
                      {isTileEditMode ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Kész</span>
                        </>
                      ) : (
                        <>
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Szerkesztés</span>
                        </>
                      )}
                    </button>

                    {isTileEditMode && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditTile(selectedTile)}
                        className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                        title="Csempe nevének, ikonjának és színének szerkesztése"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Alapadatok</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRequestDeleteTile(selectedTile)}
                      className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Csempe törlése"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleCloseTileDetail}
                      className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer ml-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
              {(() => {
                const activeMods = getTileModules(selectedTile);
                const isSingleModule = activeMods.length <= 1;

                return (
                  <>
                    {/* Edit mode informational banner */}
                    {isTileEditMode && (
                      <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 animate-fadeIn">
                        <span className="text-xs font-bold text-gray-800">
                          Szerkesztés mód aktív
                        </span>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTile(selectedTile)}
                            className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Settings className="w-3.5 h-3.5 text-gray-500" />
                            <span>Alapadatok</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsTileEditMode(false)}
                            className="px-3 py-1 rounded-lg bg-[#1E3A8A] text-white font-bold text-xs hover:bg-[#1e40af] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Kész</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {/* ======================================================== */}
                    {/* MODUL 1: ELÉRHETŐSÉGEK & NÉVJEGY (contacts)              */}
                    {/* ======================================================== */}
                    {activeMods.includes('contacts') && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 gap-2">
                          <div className="flex items-center gap-2">
                            <PhoneCall className="w-4 h-4 text-emerald-600" />
                            <div>
                              <h4 className="text-sm font-bold text-gray-900">
                                Hivatalos Elérhetőségek & Névjegy
                              </h4>
                              <span className="text-[11px] text-gray-400 hidden sm:inline">
                                Telefonszám, e-mail cím, kapcsolattartó és nyitvatartás
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {!isEditingQuickInfo && (
                              <button
                                type="button"
                                onClick={handleStartEditQuickInfo}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Szerkesztés</span>
                              </button>
                            )}
                            {isTileEditMode && !isSingleModule && (
                              <button
                                type="button"
                                onClick={() => handleToggleModuleOnTile(selectedTile.id, 'contacts')}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                title="Rész eltávolítása a csempéből"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {!isEditingQuickInfo ? (
                          (() => {
                            const q = selectedTile.quickInfo || {};
                            const hasAny = q.name || q.phone || q.email || q.accountOrPolicy || q.notes;

                            if (!hasAny) {
                              return (
                                <div className="text-center py-6 bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                                  <p className="text-xs text-gray-400 mb-2">
                                    Még nincsenek elérhetőségek rögzítve (pl. kapcsolattartó, telefonszám, e-mail, számlaszám).
                                  </p>
                                  <button
                                    type="button"
                                    onClick={handleStartEditQuickInfo}
                                    className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg inline-flex items-center gap-1 hover:bg-emerald-100 transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Elérhetőségek megadása</span>
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-3.5 text-xs">
                                {q.name && (
                                  <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-100/70">
                                    <span className="text-[10px] uppercase font-bold text-emerald-800 block mb-0.5">Szervezet / Kapcsolattartó</span>
                                    <span className="font-bold text-gray-900 text-sm sm:text-base">{q.name}</span>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {q.phone && (
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                                      <div className="flex items-center gap-2.5">
                                        <Phone className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                        <div>
                                          <span className="text-[10px] uppercase font-bold text-gray-400 block">Telefonszám</span>
                                          <a 
                                            href={`tel:${cleanPhoneNumber(q.phone)}`}
                                            className="font-bold text-gray-900 hover:text-emerald-700 hover:underline"
                                          >
                                            {formatPhoneNumber(q.phone)}
                                          </a>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(formatPhoneNumber(q.phone), 'phone')}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                                        title="Másolás"
                                      >
                                        {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>
                                  )}

                                  {q.email && (
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <Mail className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                        <div className="min-w-0">
                                          <span className="text-[10px] uppercase font-bold text-gray-400 block">E-mail cím</span>
                                          <a 
                                            href={`mailto:${q.email}`}
                                            className="font-bold text-gray-900 hover:text-emerald-700 hover:underline truncate block"
                                          >
                                            {q.email}
                                          </a>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(q.email, 'email')}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer flex-shrink-0"
                                        title="Másolás"
                                      >
                                        {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {q.accountOrPolicy && (
                                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                                    <div>
                                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Bankszámlaszám / Ügyfélazonosító</span>
                                      <span className="font-mono font-bold text-gray-900 text-xs sm:text-sm">{q.accountOrPolicy}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(q.accountOrPolicy, 'acc')}
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                                      title="Másolás"
                                    >
                                      {copiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                )}

                                {q.notes && (
                                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Megjegyzés / Nyitvatartás</span>
                                    <p className="text-gray-700 whitespace-pre-wrap">{q.notes}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <form onSubmit={handleSaveQuickInfo} className="space-y-3.5 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block font-semibold text-gray-700 mb-1">
                                  Név / Szervezet / Kapcsolattartó
                                </label>
                                <input
                                  type="text"
                                  value={quickName}
                                  onChange={(e) => setQuickName(e.target.value)}
                                  placeholder="pl. OTP Bank Budapesti Fiók"
                                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <label className="block font-semibold text-gray-700 mb-1">
                                  Számlaszám / Ügyfélszám / Cím
                                </label>
                                <input
                                  type="text"
                                  value={quickAccount}
                                  onChange={(e) => setQuickAccount(e.target.value)}
                                  placeholder="pl. 11702005 21461266"
                                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block font-semibold text-gray-700 mb-1">
                                  Telefonszám
                                </label>
                                <input
                                  type="text"
                                  value={quickPhone}
                                  onChange={(e) => setQuickPhone(e.target.value)}
                                  onBlur={() => setQuickPhone(prev => prev ? formatPhoneNumber(prev) : '')}
                                  placeholder="+36 1 366 6666"
                                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <label className="block font-semibold text-gray-700 mb-1">
                                  E-mail cím
                                </label>
                                <input
                                  type="email"
                                  value={quickEmail}
                                  onChange={(e) => setQuickEmail(e.target.value)}
                                  placeholder="informacio@szervezet.hu"
                                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-700 mb-1">
                                Megjegyzés / Nyitvatartás / Cím
                              </label>
                              <textarea
                                rows={2}
                                value={quickNotes}
                                onChange={(e) => setQuickNotes(e.target.value)}
                                placeholder="pl. Hétköznap 8:00 - 16:00, elektronikus banki hozzáférés beállítva."
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                              <button
                                type="button"
                                onClick={handleCancelQuickInfo}
                                className="px-3.5 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                              >
                                Mégse
                              </button>
                              <button
                                type="submit"
                                className="px-4 py-1.5 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] cursor-pointer"
                              >
                                Mentés
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* MODUL: EGYEDI ADATOK & AZONOSÍTÓK (custom_fields)        */}
                    {/* ======================================================== */}
                    {activeMods.includes('custom_fields') && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 gap-2">
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-teal-600" />
                            <div>
                              <h4 className="text-sm font-bold text-gray-900">
                                Egyedi adatok & Azonosítók
                              </h4>
                              <span className="text-[11px] text-gray-400 hidden sm:inline">
                                Szabadon párosítható megnevezések és értékek (pl. felhasználási helyszám, lokáció szám)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {editingFieldId === null && (
                              <button
                                type="button"
                                onClick={handleStartAddField}
                                className="px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer border border-teal-200"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Új adat</span>
                              </button>
                            )}
                            {isTileEditMode && !isSingleModule && (
                              <button
                                type="button"
                                onClick={() => handleToggleModuleOnTile(selectedTile.id, 'custom_fields')}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                title="Egyedi adatok modul eltávolítása a csempéből"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Form: Add or Edit Field */}
                        {editingFieldId !== null && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSaveCustomField(selectedTile.id);
                            }}
                            className="p-4 bg-teal-50/40 rounded-xl border border-teal-200 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-teal-900">
                                {editingFieldId === 'new' ? 'Új adat / azonosító rögzítése' : 'Adat módosítása'}
                              </span>
                              <button
                                type="button"
                                onClick={handleCancelEditField}
                                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                                  Megnevezés / Címke *
                                </label>
                                <input
                                  type="text"
                                  value={fieldLabelInput}
                                  onChange={(e) => setFieldLabelInput(e.target.value)}
                                  placeholder="pl. Felhasználási helyszám vagy Lokáció kód"
                                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-teal-600"
                                  required
                                  autoFocus
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                                  Érték / Adat *
                                </label>
                                <input
                                  type="text"
                                  value={fieldValueInput}
                                  onChange={(e) => setFieldValueInput(e.target.value)}
                                  placeholder="pl. 12345678 vagy B épület 2. em."
                                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-teal-600"
                                  required
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleCancelEditField}
                                className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                              >
                                Mégse
                              </button>
                              <button
                                type="submit"
                                className="px-4 py-1.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 cursor-pointer shadow-xs"
                              >
                                Mentés
                              </button>
                            </div>
                          </form>
                        )}

                        {/* List of custom fields */}
                        {((selectedTile.customFields || []).length === 0 && editingFieldId === null) ? (
                          <div className="text-center py-6 bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                            <p className="text-xs text-gray-400 mb-2">
                              Még nincs rögzített egyedi adat vagy azonosító (pl. felhasználási helyszám, lokáció kód).
                            </p>
                            <button
                              type="button"
                              onClick={handleStartAddField}
                              className="px-3.5 py-1.5 bg-teal-50 text-teal-800 font-bold text-xs rounded-lg inline-flex items-center gap-1 hover:bg-teal-100 transition-colors cursor-pointer border border-teal-200"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Új adat rögzítése</span>
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(selectedTile.customFields || []).map(field => {
                              const isCopied = copiedField === `cf-${field.id}`;
                              return (
                                <div
                                  key={field.id}
                                  className="p-3.5 bg-gray-50/70 hover:bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3 group transition-colors"
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block truncate">
                                      {field.label}
                                    </span>
                                    <span className="text-xs font-bold text-gray-900 font-mono select-all block truncate mt-0.5">
                                      {field.value}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(field.value, `cf-${field.id}`)}
                                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 text-[11px] ${
                                        isCopied 
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold' 
                                          : 'bg-white hover:bg-gray-100 text-gray-500 border-gray-200'
                                      }`}
                                      title="Érték másolása"
                                    >
                                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditField(field)}
                                      className="p-1.5 rounded-lg bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-700 border border-gray-200 transition-colors cursor-pointer"
                                      title="Szerkesztés"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCustomField(selectedTile.id, field.id)}
                                      className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 border border-gray-200 transition-colors cursor-pointer"
                                      title="Törlés"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* MODUL 2: ÜGYEK, KÁROK & FELADATOK LISTÁJA (cases)        */}
                    {/* ======================================================== */}
                    {activeMods.includes('cases') && (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1 gap-2">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-600" />
                            <div>
                              <h4 className="text-sm font-bold text-gray-900">
                                Ügyek rész
                              </h4>
                              <span className="text-xs text-gray-400">
                                Folyamatban lévő ügyek, bejelentések, károk és kapcsolt könyvelési tételek
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenAddItem('Folyamatban', 'case')}
                              className="px-3.5 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isEn ? "+ New Case" : "+ Új ügy rögzítése"}</span>
                            </button>
                            {isTileEditMode && !isSingleModule && (
                              <button
                                type="button"
                                onClick={() => handleToggleModuleOnTile(selectedTile.id, 'cases')}
                                className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                title="Ügyek modul eltávolítása a csempéből"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {(() => {
                          const parseItemDate = (d) => {
                            if (!d) return 0;
                            const clean = String(d).replace(/\./g, '-').replace(/\s+/g, '').trim();
                            const time = new Date(clean).getTime();
                            return isNaN(time) ? 0 : time;
                          };

                          const rawCaseItems = (selectedTile.items || []).filter(it => it.category !== 'meter');

                          // Strictly sort chronologically
                          const sortedCaseItems = [...rawCaseItems].sort((a, b) => {
                            const timeA = parseItemDate(a.date);
                            const timeB = parseItemDate(b.date);
                            if (timeB !== timeA) {
                              return caseSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
                            }
                            return caseSortOrder === 'asc'
                              ? String(a.id || '').localeCompare(String(b.id || ''))
                              : String(b.id || '').localeCompare(String(a.id || ''));
                          });

                          const inProgressCount = sortedCaseItems.filter(it => normalizeCaseStatus(it.status) === 'Folyamatban').length;
                          const closedCount = sortedCaseItems.filter(it => normalizeCaseStatus(it.status) === 'Lezárt').length;

                          const displayedCaseItems = caseStatusFilter === 'all'
                            ? sortedCaseItems
                            : sortedCaseItems.filter(it => normalizeCaseStatus(it.status) === caseStatusFilter);

                          if (rawCaseItems.length === 0) {
                            return (
                              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-xs">
                                <Umbrella className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                <h5 className="text-sm font-bold text-gray-700">
                                  {isEn ? "No recorded cases or incidents yet" : "Még nincs rögzített ügy vagy kárbejelentés"}
                                </h5>
                                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto mb-3">
                                  {isEn 
                                    ? "If an incident occurred (e.g. storm damage, pipe break, resident report), click the button above to record a new case!" 
                                    : "Ha esemény történt (pl. viharkár, csőtörés, bejelentés), kattints a fenti gombra új ügy rögzítéséhez!"}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddItem('Folyamatban', 'case')}
                                  className="px-3.5 py-1.5 bg-blue-50 text-[#1E3A8A] hover:bg-blue-100 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>{isEn ? "+ New Case" : "+ Új ügy rögzítése"}</span>
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              {/* Chronological order indicator & Status filter bar */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 bg-gray-50/90 rounded-2xl border border-gray-200">
                                {/* Filter pills */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => setCaseStatusFilter('all')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                      caseStatusFilter === 'all'
                                        ? 'bg-white text-gray-900 shadow-2xs border border-gray-200'
                                        : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                                    }`}
                                  >
                                    {isEn ? "All" : "Összes"} ({rawCaseItems.length})
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setCaseStatusFilter('Folyamatban')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                      caseStatusFilter === 'Folyamatban'
                                        ? 'bg-amber-500 text-white shadow-2xs'
                                        : 'text-amber-800 hover:bg-amber-100/70'
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                    <span>{isEn ? "In Progress" : "Folyamatban"}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                      caseStatusFilter === 'Folyamatban' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {inProgressCount}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setCaseStatusFilter('Lezárt')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                      caseStatusFilter === 'Lezárt'
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'text-emerald-800 hover:bg-emerald-100/70'
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                    <span>{isEn ? "Closed" : "Lezárt"}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                      caseStatusFilter === 'Lezárt' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {closedCount}
                                    </span>
                                  </button>
                                </div>

                                {/* Chronological sorting toggle */}
                                <button
                                  type="button"
                                  onClick={() => setCaseSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 hover:text-[#1E3A8A] bg-white hover:bg-blue-50/60 border border-gray-200 rounded-xl transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
                                  title={isEn ? "Click to toggle chronological sort order" : "Kattints az időrendi sorrend megfordításához"}
                                >
                                  <ArrowDownUp className="w-3.5 h-3.5 text-blue-600" />
                                  <span>
                                    {isEn 
                                      ? (caseSortOrder === 'desc' ? "Chronological: Newest first" : "Chronological: Oldest first")
                                      : (caseSortOrder === 'desc' ? "Időrend: Legújabb elöl" : "Időrend: Legrégebbi elöl")}
                                  </span>
                                </button>
                              </div>

                              {displayedCaseItems.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-xs text-gray-400">
                                  <p>{isEn ? "No cases matching the selected status." : "Nincs a kiválasztott státusznak megfelelő ügy."}</p>
                                  <button
                                    type="button"
                                    onClick={() => setCaseStatusFilter('all')}
                                    className="mt-2 text-blue-600 hover:underline font-bold"
                                  >
                                    {isEn ? "Show all cases" : "Összes ügy megjelenítése"}
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {displayedCaseItems.map(item => {
                                const isExpanded = Boolean(expandedCaseIds[item.id] || focusedCaseId === item.id);
                                const attCount = (item.attachments || []).length;
                                const commCount = (item.comments || []).length;
                                const itemLinkedIds = Array.isArray(item.linkedTxIds) ? item.linkedTxIds : [];
                                const linkedCount = allAccountingItems.filter(acct => itemLinkedIds.includes(acct.id)).length;

                                return (
                                  <div 
                                    key={item.id} 
                                    id={`case-item-${item.id}`}
                                    className={`bg-white rounded-2xl border shadow-xs transition-all duration-200 ${
                                      isExpanded ? 'p-5 space-y-4' : 'p-3.5 sm:p-4 hover:border-gray-300'
                                    } ${
                                      focusedCaseId === item.id 
                                        ? 'border-blue-500 ring-4 ring-blue-100 shadow-md bg-blue-50/10' 
                                        : 'border-gray-200'
                                    }`}
                                  >
                                    <div 
                                      onClick={() => {
                                        const selection = window.getSelection();
                                        if (selection && selection.toString().trim().length > 0) {
                                          return;
                                        }
                                        toggleCaseExpanded(item.id);
                                      }}
                                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-text transition-colors ${
                                        isExpanded ? 'border-b border-gray-100 pb-3' : ''
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleCaseExpanded(item.id);
                                          }}
                                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 flex-shrink-0 cursor-pointer ${
                                            isExpanded 
                                              ? 'bg-blue-100 text-[#1E3A8A] rotate-180 shadow-2xs' 
                                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'
                                          }`}
                                          title={isExpanded ? (isEn ? "Collapse details" : "Részletek becsukása") : (isEn ? "Expand details" : "Részletek lenyitása")}
                                        >
                                          <ChevronDown className="w-4 h-4" />
                                        </button>

                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <div className="inline-flex items-center gap-1 min-w-0 max-w-full">
                                              <h5 className="text-sm sm:text-base font-bold text-gray-900 truncate select-text">
                                                {item.title}
                                              </h5>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  copyToClipboard(item.title, `case-title-${item.id}`);
                                                }}
                                                className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer flex-shrink-0"
                                                title={isEn ? "Copy title" : "Megnevezés másolása"}
                                              >
                                                {copiedField === `case-title-${item.id}` ? (
                                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                ) : (
                                                  <Copy className="w-3.5 h-3.5" />
                                                )}
                                              </button>
                                            </div>

                                            {item.status && (
                                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border select-text ${getStatusBadge(item.status)}`}>
                                                {isEn 
                                                  ? (normalizeCaseStatus(item.status) === 'Lezárt' ? "Closed" : "In Progress")
                                                  : normalizeCaseStatus(item.status)}
                                              </span>
                                            )}

                                            {!isExpanded && (
                                              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                                                {attCount > 0 && (
                                                  <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded text-gray-600 text-[10px]">
                                                    <Paperclip className="w-3 h-3 text-gray-400" />
                                                    <span>{attCount}</span>
                                                  </span>
                                                )}
                                                {commCount > 0 && (
                                                  <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded text-gray-600 text-[10px]">
                                                    <MessageSquare className="w-3 h-3 text-gray-400" />
                                                    <span>{commCount}</span>
                                                  </span>
                                                )}
                                                {linkedCount > 0 && (
                                                  <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded text-blue-700 text-[10px]">
                                                    <Link2 className="w-3 h-3 text-blue-500" />
                                                    <span>{linkedCount} tétel</span>
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </div>

                                          {item.subtitle && (
                                            <div className="inline-flex items-center gap-1 mt-0.5 min-w-0 max-w-full">
                                              <p className="text-xs font-semibold text-gray-600 truncate select-text">{item.subtitle}</p>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  copyToClipboard(item.subtitle, `case-sub-${item.id}`);
                                                }}
                                                className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer flex-shrink-0"
                                                title={isEn ? "Copy identifier / subtitle" : "Azonosító / leírás másolása"}
                                              >
                                                {copiedField === `case-sub-${item.id}` ? (
                                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                ) : (
                                                  <Copy className="w-3.5 h-3.5" />
                                                )}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div 
                                        className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 self-end sm:self-center"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {item.date && (
                                          <div className="flex items-center gap-1 text-xs text-gray-600 font-medium bg-gray-50 border border-gray-200/80 px-2 py-1 rounded-lg select-text">
                                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                            <span>{item.date}</span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                copyToClipboard(item.date, `case-date-${item.id}`);
                                              }}
                                              className="p-0.5 ml-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer flex-shrink-0"
                                              title={isEn ? "Copy date" : "Dátum másolása"}
                                            >
                                              {copiedField === `case-date-${item.id}` ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                              ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                              )}
                                            </button>
                                          </div>
                                        )}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const normStatus = normalizeCaseStatus(item.status);
                                            const statusText = isEn ? (normStatus === 'Lezárt' ? 'Closed' : 'In Progress') : normStatus;
                                            const allInfo = [item.title, item.subtitle, statusText, item.date].filter(Boolean).join(' | ');
                                            copyToClipboard(allInfo, `case-all-${item.id}`);
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                                          title={isEn ? "Copy all case header info" : "Ügy fejléc adatainak másolása"}
                                        >
                                          {copiedField === `case-all-${item.id}` ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditItem(item);
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                                          title="Tétel szerkesztése"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRequestDeleteItem(item);
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                                          title="Tétel törlése"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Collapsible Details */}
                                    {isExpanded && (
                                      <div className="space-y-4 pt-1">
                                        {/* Details */}
                                        {item.details && Object.keys(item.details).length > 0 && (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 text-xs">
                                            {Object.entries(item.details).map(([k, v]) => (
                                              <div key={k} className="min-w-0 flex items-start justify-between gap-1 group/det">
                                                <div className="min-w-0 select-text">
                                                  <span className="text-[10px] uppercase font-bold text-gray-400 block truncate">{k}</span>
                                                  <span className="font-semibold text-gray-800 break-words">{v}</span>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => copyToClipboard(String(v), `detail-${item.id}-${k}`)}
                                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-white rounded transition-colors cursor-pointer flex-shrink-0 opacity-60 sm:opacity-0 group-hover/det:opacity-100"
                                                  title={isEn ? "Copy" : "Másolás"}
                                                >
                                                  {copiedField === `detail-${item.id}-${k}` ? (
                                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                  ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                  )}
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* Attachments */}
                                        <div className="space-y-2 pt-1">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                              <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                                              <span>Kárjegyzőkönyvek & Helyszíni Fotók ({(item.attachments || []).length})</span>
                                            </span>
                                            <label className="text-xs font-bold text-[#1E3A8A] hover:underline cursor-pointer flex items-center gap-1">
                                              <Upload className="w-3.5 h-3.5" />
                                              <span>+ Fájl csatolása</span>
                                              <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(item.id, e)} />
                                            </label>
                                          </div>

                                          {(item.attachments || []).length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                              {item.attachments.map(att => {
                                                const isImg = isImageFile(att);
                                                return (
                                                  <div key={att.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1.5 pr-2.5 text-xs text-gray-700 shadow-2xs group hover:border-blue-300 transition-colors">
                                                    {isImg && att.fileData ? (
                                                      <button
                                                        type="button"
                                                        onClick={() => setPreviewImage({ url: att.fileData, name: att.fileName })}
                                                        className="w-7 h-7 rounded-lg overflow-hidden border border-blue-200 flex-shrink-0 cursor-pointer hover:scale-105 transition-transform bg-white shadow-2xs"
                                                        title="Kattints a nagy felbontású megtekintéshez"
                                                      >
                                                        <img src={att.fileData} alt={att.fileName} className="w-full h-full object-cover" />
                                                      </button>
                                                    ) : (
                                                      <FileText className="w-4 h-4 text-blue-600 flex-shrink-0 ml-1" />
                                                    )}
                                                    <span className="font-medium truncate max-w-[160px]" title={att.fileName}>{att.fileName}</span>
                                                    {att.fileSize && <span className="text-[10px] text-gray-400">({att.fileSize})</span>}
                                                    <button type="button" onClick={() => handleDownloadAttachment(att)} className="p-1 text-gray-400 hover:text-blue-600 rounded cursor-pointer" title="Letöltés">
                                                      <Download className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteAttachment(item.id, att.id)} className="p-1 text-gray-400 hover:text-red-600 rounded cursor-pointer" title="Törlés">
                                                      <X className="w-3.5 h-3.5" />
                                                    </button>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          ) : (
                                            <p className="text-[11px] text-gray-400 italic">Még nincs csatolt fotó vagy jegyzőkönyv.</p>
                                          )}
                                        </div>

                                        {/* Kapcsolódó könyvelési tételek (Kiadások & Bevételek) */}
                                        {(() => {
                                          const itemLinkedIds = Array.isArray(item.linkedTxIds) ? item.linkedTxIds : [];
                                          const linkedItems = allAccountingItems.filter(acct => itemLinkedIds.includes(acct.id));

                                          return (
                                            <div className="space-y-2 pt-2 border-t border-gray-100">
                                              <div className="flex items-center justify-between flex-wrap gap-1">
                                                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                                  <Link2 className="w-3.5 h-3.5 text-blue-600" />
                                                  <span>Kapcsolódó könyvelési tételek ({linkedItems.length})</span>
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setLinkingCaseItem({ tileId: selectedTile.id, item });
                                                    setLinkTxSearch('');
                                                    setLinkTxFilter('all');
                                                  }}
                                                  className="text-xs font-bold text-[#1E3A8A] hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1"
                                                >
                                                  <Plus className="w-3.5 h-3.5" />
                                                  <span>+ Tétel összekötése a listából</span>
                                                </button>
                                              </div>

                                              {linkedItems.length > 0 ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                  {linkedItems.map(acct => (
                                                    <div 
                                                      key={acct.id} 
                                                      className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs hover:bg-blue-50/30 transition-colors shadow-2xs"
                                                    >
                                                      <div className="flex items-center gap-2 min-w-0">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                          acct.isExpense ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                                                        }`}>
                                                          {acct.isExpense ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                          <div className="flex items-center gap-1.5">
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                                              acct.isExpense ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            }`}>
                                                              {acct.isExpense ? 'Kiadás' : 'Befizetés'}
                                                            </span>
                                                            <span className="font-bold text-gray-900 truncate max-w-[140px]" title={acct.titleDisplay}>
                                                              {acct.titleDisplay}
                                                            </span>
                                                          </div>
                                                          <div className="text-[11px] text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                                                            <span>{acct.dateStr}</span>
                                                            <span>&bull;</span>
                                                            <span className={`font-bold ${acct.isExpense ? 'text-red-600' : 'text-emerald-600'}`}>
                                                              {acct.isExpense ? '-' : '+'}{Math.abs(Math.round(acct.amountDisplay || 0)).toLocaleString('hu-HU')} Ft
                                                            </span>
                                                          </div>
                                                        </div>
                                                      </div>

                                                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                        {onOpenEditTx && (
                                                          <button
                                                            type="button"
                                                            onClick={() => onOpenEditTx(acct.id, acct.itemType)}
                                                            className="p-1.5 text-gray-400 hover:text-[#1E3A8A] hover:bg-white rounded-lg transition-colors cursor-pointer"
                                                            title="Tétel megtekintése / szerkesztése"
                                                          >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                          </button>
                                                        )}
                                                        <button
                                                          type="button"
                                                          onClick={() => handleToggleLinkTxOnItem(selectedTile.id, item.id, acct.id)}
                                                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                          title="Összekapcsolás felbontása"
                                                        >
                                                          <X className="w-3.5 h-3.5" />
                                                        </button>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : (
                                                <p className="text-[11px] text-gray-400 italic">Még nincs összekötött könyvelési kiadás vagy bevétel ezzel az üggyel.</p>
                                              )}
                                            </div>
                                          );
                                        })()}

                                        {/* Comments */}
                                        <div className="space-y-2 pt-2 border-t border-gray-100">
                                          <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                                            <span>Ügymeneti Napló & Egyeztetések ({(item.comments || []).length})</span>
                                          </span>

                                          {(item.comments || []).length > 0 && (
                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                              {item.comments.map(c => (
                                                <div key={c.id} className="bg-gray-50/90 rounded-xl p-3 text-xs border border-gray-100 flex items-start justify-between gap-2">
                                                  <div>
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                      <span className="font-bold text-gray-800">{c.author}</span>
                                                      <span className="text-[10px] text-gray-400">{c.date}</span>
                                                    </div>
                                                    <p className="text-gray-700 whitespace-pre-wrap">{c.text}</p>
                                                  </div>
                                                  <button type="button" onClick={() => handleDeleteComment(item.id, c.id)} className="p-1 text-gray-300 hover:text-red-500 rounded cursor-pointer">
                                                    <X className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          <div className="flex items-center gap-2 pt-1">
                                            <input
                                              type="text"
                                              value={commentInputs[item.id] || ''}
                                              onChange={(e) => setCommentInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  handleAddComment(item.id);
                                                }
                                              }}
                                              placeholder="Biztosítói egyeztetés vagy feljegyzés beírása..."
                                              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => handleAddComment(item.id)}
                                              className="px-3.5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                            >
                                              <Send className="w-3 h-3" />
                                              <span>Küldés</span>
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                      </div>
                    )}
                    {/* ======================================================== */}
                    {/* MODUL 3: MÉRŐÓRÁK & FOGYASZTÁSI LEOLVASÁSOK (meters)      */}
                    {/* ======================================================== */}
                    {activeMods.includes('meters') && (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1 gap-2">
                          <div className="flex items-center gap-2">
                            <Gauge className="w-4 h-4 text-sky-600" />
                            <div>
                              <h4 className="text-sm font-bold text-gray-900">
                                Mérőórák & Fogyasztási leolvasások
                              </h4>
                              <span className="text-xs text-gray-400">
                                Mérőhely POD azonosító, gyári szám és havi leolvasási napló
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenAddItem('Elintézve', 'meter')}
                              className="px-3.5 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Új leolvasás rögzítése</span>
                            </button>
                            {isTileEditMode && !isSingleModule && (
                              <button
                                type="button"
                                onClick={() => handleToggleModuleOnTile(selectedTile.id, 'meters')}
                                className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                title="Mérőóra modul eltávolítása a csempéből"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Top Card: Identifiers */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
                          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <span className="font-bold text-xs text-gray-700 uppercase tracking-wider">
                              Mérőhely & Törzsadatok
                            </span>
                            {!isEditingQuickInfo && (
                              <button
                                type="button"
                                onClick={handleStartEditQuickInfo}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Azonosítók szerkesztése</span>
                              </button>
                            )}
                          </div>

                          {!isEditingQuickInfo ? (
                            (() => {
                              const q = selectedTile.quickInfo || {};
                              const userPlace = q.userPlaceNumber || (q.accountOrPolicy ? q.accountOrPolicy.split('•')[0] : '');
                              const meterNum = q.meterNumber || (q.accountOrPolicy && q.accountOrPolicy.includes('Gyári szám') ? q.accountOrPolicy.split('Gyári szám:')[1]?.trim() : '');

                              return (
                                <div className="space-y-3.5 text-xs">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-sky-50/50 p-3.5 rounded-xl border border-sky-200/80 flex items-center justify-between">
                                      <div>
                                        <span className="text-[10px] uppercase font-bold text-sky-800 block mb-0.5">Felhasználási hely száma (POD)</span>
                                        <span className="font-mono font-bold text-gray-900 text-sm sm:text-base">
                                          {userPlace || "Nincs megadva"}
                                        </span>
                                      </div>
                                      {userPlace && (
                                        <button
                                          type="button"
                                          onClick={() => copyToClipboard(userPlace.replace(/[^0-9]/g, '') || userPlace, 'pod')}
                                          className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-100 transition-colors cursor-pointer"
                                          title="Másolás"
                                        >
                                          {copiedField === 'pod' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                      )}
                                    </div>

                                    <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200/80 flex items-center justify-between">
                                      <div>
                                        <span className="text-[10px] uppercase font-bold text-gray-500 block mb-0.5">Mérőóra Gyári száma</span>
                                        <span className="font-mono font-bold text-gray-900 text-sm sm:text-base">
                                          {meterNum || "Nincs megadva"}
                                        </span>
                                      </div>
                                      {meterNum && (
                                        <button
                                          type="button"
                                          onClick={() => copyToClipboard(meterNum, 'meter')}
                                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
                                          title="Másolás"
                                        >
                                          {copiedField === 'meter' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <form onSubmit={handleSaveQuickInfo} className="space-y-3.5 text-xs">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block font-semibold text-gray-700 mb-1">
                                    Felhasználási hely száma (POD)
                                  </label>
                                  <input
                                    type="text"
                                    value={quickUserPlaceNumber}
                                    onChange={(e) => setQuickUserPlaceNumber(e.target.value)}
                                    placeholder="pl. 0019284912"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block font-semibold text-gray-700 mb-1">
                                    Mérőóra gyári száma
                                  </label>
                                  <input
                                    type="text"
                                    value={quickMeterNumber}
                                    onChange={(e) => setQuickMeterNumber(e.target.value)}
                                    placeholder="pl. 4920192"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                                <button
                                  type="button"
                                  onClick={handleCancelQuickInfo}
                                  className="px-3.5 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                                >
                                  Mégse
                                </button>
                                <button
                                  type="submit"
                                  className="px-4 py-1.5 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] cursor-pointer"
                                >
                                  Azonosítók mentése
                                </button>
                              </div>
                            </form>
                          )}
                        </div>

                        {/* Meter readings log */}
                        {(() => {
                          const meterItems = (selectedTile.items || []).filter(it => it.category === 'meter' || selectedTile.tileType === 'info_and_readings');

                          if (meterItems.length === 0) {
                            return (
                              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-xs">
                                <Droplets className="w-10 h-10 text-sky-300 mx-auto mb-2" />
                                <h5 className="text-sm font-bold text-gray-700">
                                  Még nincsenek rögzített leolvasási adatok
                                </h5>
                                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                                  A havi diktáláskor készíts egy fotót a mérőóráról, és kattints az <strong>Új leolvasás rögzítése</strong> gombra az állás elmentéséhez!
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-4">
                              {meterItems.map(item => (
                                <div key={item.id} className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-gray-100 pb-3 select-text">
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <div className="inline-flex items-center gap-1 min-w-0">
                                          <h5 className="text-base font-bold text-gray-900 select-text">{item.title}</h5>
                                          <button
                                            type="button"
                                            onClick={() => copyToClipboard(item.title, `meter-title-${item.id}`)}
                                            className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer flex-shrink-0"
                                            title={isEn ? "Copy title" : "Megnevezés másolása"}
                                          >
                                            {copiedField === `meter-title-${item.id}` ? (
                                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                              <Copy className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>
                                        {item.status && (
                                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border select-text ${getStatusBadge(item.status)}`}>
                                            {item.status}
                                          </span>
                                        )}
                                      </div>
                                      {item.subtitle && (
                                        <div className="mt-1 inline-flex items-center gap-1">
                                          <span className="inline-block bg-sky-50 text-sky-800 font-bold px-2 py-0.5 rounded-md text-xs border border-sky-200 select-text">
                                            {item.subtitle}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => copyToClipboard(item.subtitle, `meter-sub-${item.id}`)}
                                            className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer flex-shrink-0"
                                            title={isEn ? "Copy reading value" : "Leolvasott állás másolása"}
                                          >
                                            {copiedField === `meter-sub-${item.id}` ? (
                                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                              <Copy className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {item.date && (
                                        <div className="flex items-center gap-1 text-xs text-gray-500 font-medium bg-gray-50 border border-gray-200/80 px-2 py-1 rounded-lg select-text mr-1">
                                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                          <span>{item.date}</span>
                                          <button
                                            type="button"
                                            onClick={() => copyToClipboard(item.date, `meter-date-${item.id}`)}
                                            className="p-0.5 ml-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer flex-shrink-0"
                                            title={isEn ? "Copy date" : "Dátum másolása"}
                                          >
                                            {copiedField === `meter-date-${item.id}` ? (
                                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                              <Copy className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditItem(item)}
                                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRequestDeleteItem(item)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Details */}
                                  {item.details && Object.keys(item.details).length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 text-xs">
                                      {Object.entries(item.details).map(([k, v]) => (
                                        <div key={k} className="min-w-0 flex items-start justify-between gap-1 group/det">
                                          <div className="min-w-0 select-text">
                                            <span className="text-[10px] uppercase font-bold text-gray-400 block truncate">{k}</span>
                                            <span className="font-bold text-gray-900 break-words">{v}</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => copyToClipboard(String(v), `meter-detail-${item.id}-${k}`)}
                                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-white rounded transition-colors cursor-pointer flex-shrink-0 opacity-60 sm:opacity-0 group-hover/det:opacity-100"
                                            title={isEn ? "Copy" : "Másolás"}
                                          >
                                            {copiedField === `meter-detail-${item.id}-${k}` ? (
                                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                              <Copy className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Attachments */}
                                  <div className="space-y-2 pt-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                        <Paperclip className="w-3.5 h-3.5 text-sky-600" />
                                        <span>Mérőóra Fényképes Igazolás ({(item.attachments || []).length})</span>
                                      </span>
                                      <label className="text-xs font-bold text-[#1E3A8A] hover:underline cursor-pointer flex items-center gap-1">
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>+ Órafotó feltöltése</span>
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileUpload(item.id, e)} />
                                      </label>
                                    </div>

                                    {(item.attachments || []).length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {item.attachments.map(att => {
                                          const isImg = isImageFile(att);
                                          return (
                                            <div key={att.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1.5 pr-2.5 text-xs text-gray-700 shadow-2xs group hover:border-sky-300 transition-colors">
                                              {isImg && att.fileData ? (
                                                <button
                                                  type="button"
                                                  onClick={() => setPreviewImage({ url: att.fileData, name: att.fileName })}
                                                  className="w-7 h-7 rounded-lg overflow-hidden border border-sky-200 flex-shrink-0 cursor-pointer hover:scale-105 transition-transform bg-white shadow-2xs"
                                                  title="Kattints a nagy felbontású megtekintéshez"
                                                >
                                                  <img src={att.fileData} alt={att.fileName} className="w-full h-full object-cover" />
                                                </button>
                                              ) : (
                                                <FileText className="w-4 h-4 text-sky-600 flex-shrink-0 ml-1" />
                                              )}
                                              <span className="font-medium truncate max-w-[160px]" title={att.fileName}>{att.fileName}</span>
                                              {att.fileSize && <span className="text-[10px] text-gray-400">({att.fileSize})</span>}
                                              <button type="button" onClick={() => handleDownloadAttachment(att)} className="p-1 text-gray-400 hover:text-sky-600 rounded cursor-pointer" title="Letöltés">
                                                <Download className="w-3.5 h-3.5" />
                                              </button>
                                              <button type="button" onClick={() => handleDeleteAttachment(item.id, att.id)} className="p-1 text-gray-400 hover:text-red-600 rounded cursor-pointer" title="Törlés">
                                                <X className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-gray-400 italic">Nincs feltöltött mérőóra fotó ehhez a leolvasáshoz.</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* MODUL 4: DOKUMENTUMOK & CSATOLT IRATOK (documents)       */}
                    {/* ======================================================== */}
                    {activeMods.includes('documents') && (
                      <div 
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingTileDocs(true);
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingTileDocs(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.currentTarget.contains(e.relatedTarget)) return;
                          setIsDraggingTileDocs(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingTileDocs(false);
                          handleTileDocumentUpload(selectedTile.id, e);
                        }}
                        className={`bg-white rounded-2xl border transition-all p-5 sm:p-6 shadow-xs space-y-4 relative ${
                          isDraggingTileDocs ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-400/40' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-purple-600" />
                            <div>
                              <h4 className="text-sm font-bold text-gray-900">
                                Dokumentumok & Csatolt iratok
                              </h4>
                              <span className="text-xs text-gray-400">
                                Szerződések, garancialevelek, jegyzőkönyvek és számlák csatolása
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <label className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer border border-purple-200 shadow-2xs">
                              <Upload className="w-3.5 h-3.5" />
                              <span>+ Fájlok feltöltése</span>
                              <input 
                                type="file" 
                                multiple
                                className="hidden" 
                                onChange={(e) => handleTileDocumentUpload(selectedTile.id, e)} 
                              />
                            </label>
                            {isTileEditMode && !isSingleModule && (
                              <button
                                type="button"
                                onClick={() => handleToggleModuleOnTile(selectedTile.id, 'documents')}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                title="Iratok modul eltávolítása a csempéből"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {(selectedTile.documents || []).length > 0 ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {(selectedTile.documents || []).map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <span className="font-bold text-gray-900 text-xs truncate block" title={doc.fileName}>
                                        {doc.fileName}
                                      </span>
                                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                        {doc.fileSize && <span>{doc.fileSize}</span>}
                                        {doc.date && <span>• {doc.date}</span>}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadAttachment(doc)}
                                      className="p-1.5 text-gray-500 hover:text-purple-700 hover:bg-purple-100 rounded-lg cursor-pointer transition-colors"
                                      title="Letöltés"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTileDocument(selectedTile.id, doc.id)}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                                      title="Törlés"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Additional dropzone below documents */}
                            <div
                              onClick={() => tileDocFileInputRef.current?.click()}
                              className={`border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all ${
                                isDraggingTileDocs
                                  ? 'border-purple-600 bg-purple-100/70 shadow-xs scale-[1.005]'
                                  : 'border-purple-200 hover:border-purple-400 bg-purple-50/30 hover:bg-purple-50/70'
                              }`}
                            >
                              <input 
                                ref={tileDocFileInputRef}
                                type="file" 
                                multiple 
                                className="hidden" 
                                onChange={(e) => handleTileDocumentUpload(selectedTile.id, e)} 
                              />
                              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-purple-900">
                                <Upload className="w-3.5 h-3.5 text-purple-600" />
                                <span>Húzd ide a további fájlokat, vagy kattints a feltöltéshez</span>
                              </div>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                Egyszerre több fájl is kijelölhető és csatolható (PDF, Word, Excel, képek)
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => tileDocFileInputRef.current?.click()}
                            className={`text-center py-8 px-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                              isDraggingTileDocs
                                ? 'border-purple-600 bg-purple-100/80 scale-[1.01] shadow-md'
                                : 'border-purple-200 hover:border-purple-400 bg-purple-50/30 hover:bg-purple-50/60'
                            }`}
                          >
                            <input 
                              ref={tileDocFileInputRef}
                              type="file" 
                              multiple 
                              className="hidden" 
                              onChange={(e) => handleTileDocumentUpload(selectedTile.id, e)} 
                            />
                            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
                              <Upload className="w-6 h-6" />
                            </div>
                            <h5 className="text-sm font-bold text-gray-800 mb-1">
                              {isDraggingTileDocs ? "Engedd el a fájlokat a feltöltéshez!" : "Húzd ide a fájlokat, vagy kattints a tallózáshoz"}
                            </h5>
                            <p className="text-xs text-gray-500 max-w-sm mx-auto">
                              Egyszerre több fájlt is kiválaszthatsz (PDF, szerződések, jegyzőkönyvek, számlák, képek).
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* MODUL 5: JEGYZETEK & SZÖVEGDOBOZOK (notes)                */}
                    {/* ======================================================== */}
                    {activeMods.includes('notes') && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 gap-2">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-amber-600" />
                            <div>
                              <h4 className="text-sm font-bold text-gray-900">
                                Jegyzetek & Szövegdobozok
                              </h4>
                              <span className="text-[11px] text-gray-400 hidden sm:inline">
                                Címmel ellátott egyedi szövegdobozok, kapukódok, eljárási rend
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {editingNoteId === null && (
                              <button
                                type="button"
                                onClick={handleStartAddNote}
                                className="px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer border border-amber-200"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Új szövegdoboz</span>
                              </button>
                            )}
                            {isTileEditMode && !isSingleModule && (
                              <button
                                type="button"
                                onClick={() => handleToggleModuleOnTile(selectedTile.id, 'notes')}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                title="Jegyzetek modul eltávolítása a csempéből"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Form: Add or Edit Note */}
                        {editingNoteId !== null && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSaveNote(selectedTile.id);
                            }}
                            className="p-4 bg-amber-50/40 rounded-xl border border-amber-200 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-900">
                                {editingNoteId === 'new' ? 'Új szövegdoboz létrehozása' : 'Szövegdoboz szerkesztése'}
                              </span>
                              <button
                                type="button"
                                onClick={handleCancelEditNote}
                                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                                Szövegdoboz címe *
                              </label>
                              <input
                                type="text"
                                value={noteTitleInput}
                                onChange={(e) => setNoteTitleInput(e.target.value)}
                                placeholder="pl. Kapukódok és belépés, Hétvégi ügyeleti rend, Karbantartási tudnivalók"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-600"
                                required
                                autoFocus
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                                Szöveg / Jegyzet tartalma *
                              </label>
                              <textarea
                                rows={4}
                                value={noteContentInput}
                                onChange={(e) => setNoteContentInput(e.target.value)}
                                placeholder="Írd be a jegyzet szövegét vagy utasításait ide..."
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-600"
                                required
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleCancelEditNote}
                                className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                              >
                                Mégse
                              </button>
                              <button
                                type="submit"
                                className="px-4 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 cursor-pointer shadow-xs"
                              >
                                Mentés
                              </button>
                            </div>
                          </form>
                        )}

                        {/* List of note textboxes */}
                        {(() => {
                          const notes = getTileNotes(selectedTile);
                          if (notes.length === 0 && editingNoteId === null) {
                            return (
                              <div className="text-center py-6 bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                                <p className="text-xs text-gray-400 mb-2">
                                  Még nincs rögzített szövegdoboz.
                                </p>
                                <button
                                  type="button"
                                  onClick={handleStartAddNote}
                                  className="px-3.5 py-1.5 bg-amber-50 text-amber-800 font-bold text-xs rounded-lg inline-flex items-center gap-1 hover:bg-amber-100 transition-colors cursor-pointer border border-amber-200"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Szövegdoboz létrehozása</span>
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              {notes.map(note => {
                                const isCopied = copiedField === `note-${note.id}`;
                                return (
                                  <div
                                    key={note.id}
                                    className="bg-amber-50/30 rounded-xl border border-amber-200/70 p-4 space-y-2 group hover:border-amber-300 transition-colors"
                                  >
                                    <div className="flex items-center justify-between gap-2 border-b border-amber-200/50 pb-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-bold text-xs text-gray-900 truncate">
                                          {note.title}
                                        </span>
                                        {note.date && (
                                          <span className="text-[10px] text-gray-400 font-medium">
                                            • {note.date}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => copyToClipboard(note.content, `note-${note.id}`)}
                                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 text-[11px] ${
                                            isCopied 
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold' 
                                              : 'bg-white hover:bg-amber-100 text-gray-500 border-amber-200/80'
                                          }`}
                                          title="Szöveg másolása"
                                        >
                                          {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditNote(note)}
                                          className="p-1.5 rounded-lg bg-white hover:bg-amber-100 text-gray-500 hover:text-gray-800 border border-amber-200/80 transition-colors cursor-pointer"
                                          title="Szerkesztés"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteNote(selectedTile.id, note.id)}
                                          className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 border border-amber-200/80 transition-colors cursor-pointer"
                                          title="Törlés"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                                      {note.content}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* DISZKRÉT MODUL HOZZÁADÁS SÁV                            */}
                    {/* ======================================================== */}
                    {AVAILABLE_MODULES.some(m => !activeMods.includes(m.id)) && (
                      <div className="pt-2 pb-2 flex flex-col items-center justify-center">
                        {!isModalAddMenuOpen ? (
                          <button
                            type="button"
                            onClick={() => setIsModalAddMenuOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-gray-300 hover:border-[#1E3A8A] bg-white hover:bg-blue-50 text-gray-600 hover:text-[#1E3A8A] text-xs font-semibold transition-all cursor-pointer shadow-2xs group"
                            title="További rész hozzáadása a csempéhez"
                          >
                            <div className="w-5 h-5 rounded-md bg-gray-100 group-hover:bg-[#1E3A8A] text-gray-500 group-hover:text-white flex items-center justify-center transition-colors">
                              <Plus className="w-3.5 h-3.5" />
                            </div>
                            <span>További részek hozzáadása</span>
                          </button>
                        ) : (
                          <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-md p-4 space-y-3 animate-fadeIn">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                              <div className="flex items-center gap-1.5">
                                <Plus className="w-4 h-4 text-[#1E3A8A]" />
                                <span className="text-xs font-bold text-gray-800">
                                  Válaszd ki, mit szeretnél hozzáadni:
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsModalAddMenuOpen(false)}
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {AVAILABLE_MODULES.filter(m => !activeMods.includes(m.id)).map(mod => {
                                const ModIcon = mod.icon;
                                return (
                                  <button
                                    key={mod.id}
                                    type="button"
                                    onClick={() => {
                                      handleToggleModuleOnTile(selectedTile.id, mod.id);
                                      setIsModalAddMenuOpen(false);
                                    }}
                                    className="p-2.5 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-blue-50 hover:border-[#1E3A8A] text-gray-700 hover:text-[#1E3A8A] font-bold text-xs flex items-center gap-2.5 transition-all cursor-pointer group shadow-2xs text-left"
                                  >
                                    <div className="w-7 h-7 rounded-lg bg-white group-hover:bg-blue-100 text-[#1E3A8A] flex items-center justify-center flex-shrink-0 shadow-2xs">
                                      <ModIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="truncate">{mod.title}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* --- MODAL: CREATE / EDIT TILE (Egyszerű, tiszta csempe modal) */}
      {/* ============================================================ */}
      {isTileModalOpen && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn cursor-default"
          {...getBackdropProps(handleCloseTileModal)}
        >
          <div 
            className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden my-auto cursor-default"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-gray-900">
                  {editingTile ? "Csempe szerkesztése" : "Új csempe létrehozása"}
                </h3>
                <span className="text-xs text-gray-400">
                  {editingTile 
                    ? "Módosítsd a csempe adatait és a bekapcsolt modulokat." 
                    : "Add meg a csempe nevét, válassz szimbólumot és színt."}
                </span>
              </div>
              <button onClick={handleCloseTileModal} className="p-1 rounded text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTile} className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs flex-1">
              
              {/* Tile Name */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Csempe megnevezése *
                </label>
                <input
                  type="text"
                  value={tileTitle}
                  onChange={(e) => setTileTitle(e.target.value)}
                  placeholder="pl. Kertészet, Vízművek, Schindler Lift vagy Gondnokság"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Alcím / Kiemelt felirat a csempén (opcionális)
                </label>
                <input
                  type="text"
                  value={tileSubtitle}
                  onChange={(e) => setTileSubtitle(e.target.value)}
                  placeholder="pl. Ügyfélszolgálat • +36 1 234 5678"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>

              {/* Symbol / Icon Picker */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1.5">
                  Csempe szimbóluma:
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsIconPickerOpen(prev => !prev)}
                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all cursor-pointer ${
                      isIconPickerOpen 
                        ? 'bg-blue-50/70 border-[#1E3A8A] ring-2 ring-[#1E3A8A]/20' 
                        : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center shadow-xs">
                      {(() => {
                        const ActiveIcon = ICON_MAP[tileIcon] || Shield;
                        return <ActiveIcon className="w-4 h-4" />;
                      })()}
                    </div>
                    <span className="text-xs font-bold text-gray-800">
                      Szimbólum kiválasztása
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${isIconPickerOpen ? 'rotate-180 text-[#1E3A8A]' : ''}`} />
                  </button>

                  {isIconPickerOpen && (
                    <span className="text-[11px] text-gray-400">
                      Kattints a kiválasztani kívánt szimbólumra
                    </span>
                  )}
                </div>

                {/* Expanded symbol palette */}
                {isIconPickerOpen && (
                  <div className="mt-2.5 p-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl animate-in fade-in duration-150">
                    <div className="flex items-center justify-between px-1 mb-2">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        Válassz szimbólumot ({ICON_OPTIONS.length} elérhető):
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsIconPickerOpen(false)}
                        className="text-xs font-semibold text-gray-400 hover:text-gray-700 px-2 py-0.5 rounded-md hover:bg-gray-200 cursor-pointer"
                      >
                        Bezárás
                      </button>
                    </div>
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-48 overflow-y-auto p-1.5 bg-white border border-gray-100 rounded-xl">
                      {ICON_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        const isSelected = tileIcon === opt.id;

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setTileIcon(opt.id);
                              setIsIconPickerOpen(false);
                            }}
                            className={`w-9 h-9 mx-auto rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-[#1E3A8A] text-white shadow-xs scale-105 ring-2 ring-[#1E3A8A] ring-offset-1' 
                                : 'bg-white hover:bg-blue-50 text-gray-700 hover:text-[#1E3A8A] border border-gray-200/80 hover:border-[#1E3A8A]/40'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Color Theme Picker */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1.5">
                  Csempe színtéma:
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {Object.keys(COLOR_THEMES).map(colorKey => {
                    const cTheme = COLOR_THEMES[colorKey];
                    const isSelected = tileColor === colorKey;

                    return (
                      <button
                        key={colorKey}
                        type="button"
                        onClick={() => setTileColor(colorKey)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${cTheme.bg} ${cTheme.text} ${
                          isSelected ? 'ring-2 ring-offset-1 ring-[#1E3A8A] border-transparent font-black' : 'border-gray-200 hover:opacity-80'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-current"></span>
                        <span className="capitalize">{colorKey}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bekapcsolt részek és funkciók (Modulok) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-semibold text-gray-700">
                    Csempéhez kapcsolt részek és funkciók:
                  </label>
                  <span className="text-[11px] text-gray-400">
                    Bármikor bővíthető vagy szűkíthető
                  </span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {AVAILABLE_MODULES.map(m => {
                    const MIcon = m.icon;
                    const isChecked = (tileModules || []).includes(m.id);

                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setTileModules(prev => {
                            const list = prev || [];
                            if (list.includes(m.id)) {
                              if (list.length <= 1) {
                                showToast(isEn ? "At least one section must be selected!" : "Legalább egy részt kötelező kijelölni!");
                                return list;
                              }
                              return list.filter(id => id !== m.id);
                            } else {
                              return [...list, m.id];
                            }
                          });
                        }}
                        className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isChecked 
                            ? 'border-[#1E3A8A] bg-blue-50/40 shadow-2xs' 
                            : 'border-gray-200 hover:border-gray-300 bg-gray-50/40 opacity-70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isChecked ? 'bg-[#1E3A8A] text-white' : 'bg-gray-200 text-gray-600'
                          }`}>
                            <MIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-bold text-gray-900 text-xs truncate">{m.title}</h5>
                            <p className="text-[11px] text-gray-500 truncate">{m.desc}</p>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                          isChecked ? 'bg-[#1E3A8A] border-[#1E3A8A] text-white' : 'border-gray-300 bg-white'
                        }`}>
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCloseTileModal}
                  className="px-3.5 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] cursor-pointer"
                >
                  {editingTile ? "Mentés" : "Csempe létrehozása"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* --- MODAL: CREATE / EDIT ITEM (Tétel vagy kárbejelentés) --- */}
      {/* ============================================================ */}
      {isItemModalOpen && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn cursor-default"
          {...getBackdropProps(handleCloseItemModal)}
        >
          <div 
            className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden my-auto cursor-default"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <h3 className="text-sm font-bold text-gray-900">
                {editingItem 
                  ? "Tétel szerkesztése" 
                  : (itemCategory === 'meter'
                      ? "Új óraállás leolvasás rögzítése"
                      : "Új kárbejelentés / tétel rögzítése")}
              </h3>
              <button onClick={handleCloseItemModal} className="p-1 rounded text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-3.5 overflow-y-auto text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  {itemCategory === 'meter' ? "Leolvasás időszaka / Megnevezés *" : "Megnevezés *"}
                </label>
                <input
                  type="text"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder={
                    itemCategory === 'meter'
                      ? "pl. 2026. augusztusi havi leolvasás"
                      : "pl. Tetőbeázás viharkár"
                  }
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  {itemCategory === 'meter' ? "Leolvasott Állás (pl. 1485 m³)" : "Alcím / Iktatószám / Érték"}
                </label>
                <input
                  type="text"
                  value={itemSubtitle}
                  onChange={(e) => setItemSubtitle(e.target.value)}
                  placeholder={
                    itemCategory === 'meter'
                      ? "pl. 1485 m³ (Fogyasztás: 55 m³)"
                      : "pl. Iktatószám: K-88192/2026"
                  }
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Dátum</label>
                  <input
                    type="date"
                    value={itemDate}
                    onChange={(e) => setItemDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Státusz</label>
                  <select
                    value={itemStatus}
                    onChange={(e) => setItemStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  >
                    {itemCategory === 'meter' ? (
                      <>
                        <option value="Elintézve">{isEn ? "Resolved / Recorded" : "Elintézve / Lejelentve"}</option>
                        <option value="Folyamatban">{isEn ? "Under Processing" : "Feldolgozás alatt"}</option>
                      </>
                    ) : (
                      <>
                        <option value="Folyamatban">{isEn ? "In Progress" : "Folyamatban"}</option>
                        <option value="Lezárt">{isEn ? "Closed" : "Lezárt"}</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Dynamic Detail Key-Values */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-gray-700">
                    {getTileType(selectedTile) === 'info_and_readings'
                      ? "Mérési adatok (pl. Előző állás, Havi fogyasztás)"
                      : "Egyedi adatok (pl. Káresemény, Szemle)"}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddDetailRow}
                    className="text-[11px] text-[#1E3A8A] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Új adatmező</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {itemDetails.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row.key}
                        onChange={(e) => handleDetailChange(idx, 'key', e.target.value)}
                        placeholder="Adat neve (pl. Előző állás)"
                        className="w-2/5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        value={row.val}
                        onChange={(e) => handleDetailChange(idx, 'val', e.target.value)}
                        placeholder="Érték (pl. 1430 m³)"
                        className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveDetailRow(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCloseItemModal}
                  className="px-3.5 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] cursor-pointer"
                >
                  {editingItem ? "Mentés" : "Rögzítés"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* --- MODAL: CONFIRM DELETE TILE (Custom styled confirmation) --- */}
      {/* ============================================================ */}
      {tileToDelete && (
        <div 
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn cursor-default"
          {...getBackdropProps(() => setTileToDelete(null))}
        >
          <div 
            className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4 my-auto cursor-default"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-2xs">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {isEn ? "Delete Tile" : "Csempe törlése"}
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {isEn 
                  ? `Are you sure you want to delete "${tileToDelete.title}" and all its stored records? This action cannot be undone.` 
                  : `Biztosan törölni szeretnéd a(z) "${tileToDelete.title}" csempét és az összes benne rögzített adatot? Ez a művelet nem vonható vissza.`}
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTileToDelete(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                {isEn ? "Cancel" : "Mégse"}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleExecuteDeleteTile(tileToDelete.id);
                  setTileToDelete(null);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                {isEn ? "Delete" : "Törlés"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* --- MODAL: CONFIRM DELETE ITEM (Custom styled confirmation) --- */}
      {/* ============================================================ */}
      {itemToDelete && (
        <div 
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn cursor-default"
          {...getBackdropProps(() => setItemToDelete(null))}
        >
          <div 
            className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4 my-auto cursor-default"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-2xs">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {isEn ? "Delete Record" : "Tétel törlése"}
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {isEn 
                  ? `Are you sure you want to delete "${itemToDelete.title}"?` 
                  : `Biztosan törölni szeretnéd a(z) "${itemToDelete.title}" tételt?`}
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                {isEn ? "Cancel" : "Mégse"}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleExecuteDeleteItem(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                {isEn ? "Delete" : "Törlés"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* --- MODAL: LINK TRANSACTION / EXPENSE TO CASE ---            */}
      {/* ============================================================ */}
      {linkingCaseItem && (() => {
        const caseItem = linkingCaseItem.item;
        const currentLinks = Array.isArray(caseItem.linkedTxIds) ? caseItem.linkedTxIds : [];

        // Filter items based on tab & search
        const filteredList = allAccountingItems.filter(acct => {
          if (linkTxFilter === 'expenses' && !acct.isExpense) return false;
          if (linkTxFilter === 'payments' && acct.isExpense) return false;
          if (!linkTxSearch.trim()) return true;
          const q = linkTxSearch.toLowerCase();
          return (
            (acct.titleDisplay && acct.titleDisplay.toLowerCase().includes(q)) ||
            (acct.subDisplay && acct.subDisplay.toLowerCase().includes(q)) ||
            (acct.dateStr && acct.dateStr.toLowerCase().includes(q)) ||
            (acct.amountDisplay && acct.amountDisplay.toString().includes(q))
          );
        });

        const totalExpensesCount = allAccountingItems.filter(a => a.isExpense).length;
        const totalPaymentsCount = allAccountingItems.filter(a => !a.isExpense).length;

        return (
          <div 
            className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn cursor-default"
            {...getBackdropProps(() => setLinkingCaseItem(null))}
          >
            <div 
              className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col my-auto overflow-hidden cursor-default"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/70">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 shadow-2xs">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                      Könyvelési tétel összekötése az üggyel
                    </h3>
                    <p className="text-xs text-blue-800 font-semibold truncate">
                      Ügy: {caseItem.title}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLinkingCaseItem(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Filters & Search */}
              <div className="p-4 border-b border-gray-100 space-y-3 bg-white">
                {/* Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setLinkTxFilter('all')}
                    className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                      linkTxFilter === 'all' 
                        ? 'bg-white text-gray-900 font-bold shadow-xs' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Összes ({allAccountingItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkTxFilter('expenses')}
                    className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                      linkTxFilter === 'expenses' 
                        ? 'bg-white text-red-700 font-bold shadow-xs' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Kiadások ({totalExpensesCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkTxFilter('payments')}
                    className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                      linkTxFilter === 'payments' 
                        ? 'bg-white text-emerald-700 font-bold shadow-xs' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Befizetések ({totalPaymentsCount})
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={linkTxSearch}
                    onChange={(e) => setLinkTxSearch(e.target.value)}
                    placeholder="Keresés partner, leírás vagy összeg alapján..."
                    className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                  {linkTxSearch && (
                    <button
                      type="button"
                      onClick={() => setLinkTxSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-gray-50">
                {filteredList.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-xs">
                    Nem található a szűrésnek megfelelő könyvelési tétel.
                  </div>
                ) : (
                  filteredList.map(acct => {
                    const isLinked = currentLinks.includes(acct.id);

                    return (
                      <div 
                        key={acct.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          isLinked 
                            ? 'bg-blue-50/60 border-blue-200' 
                            : 'bg-white border-gray-100 hover:bg-gray-50/80 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 mr-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            acct.isExpense ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {acct.isExpense ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                acct.isExpense ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {acct.isExpense ? 'Kiadás' : 'Befizetés'}
                              </span>
                              <span className="text-xs font-bold text-gray-900 truncate">
                                {acct.titleDisplay}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 truncate flex items-center gap-2">
                              <span>{acct.dateStr}</span>
                              {acct.subDisplay && <span>&bull; {acct.subDisplay}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <div className={`text-xs font-bold ${acct.isExpense ? 'text-red-600' : 'text-emerald-600'}`}>
                              {acct.isExpense ? '-' : '+'}{Math.abs(Math.round(acct.amountDisplay || 0)).toLocaleString('hu-HU')} Ft
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleLinkTxOnItem(linkingCaseItem.tileId, caseItem.id, acct.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              isLinked
                                ? 'bg-emerald-600 hover:bg-red-600 text-white shadow-xs group'
                                : 'bg-blue-50 hover:bg-[#1E3A8A] text-[#1E3A8A] hover:text-white border border-blue-200'
                            }`}
                          >
                            {isLinked ? (
                              <>
                                <Check className="w-3.5 h-3.5 group-hover:hidden" />
                                <span className="group-hover:hidden">Összekötve</span>
                                <X className="w-3.5 h-3.5 hidden group-hover:inline" />
                                <span className="hidden group-hover:inline">Leválasztás</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Összekötés</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                <span className="text-xs text-gray-500 font-medium">
                  Kattints az <strong>Összekötés</strong> gombra a tétel csatolásához!
                </span>
                <button
                  type="button"
                  onClick={() => setLinkingCaseItem(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Kész / Bezárás
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* High-Resolution Image Lightbox Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn cursor-default"
          {...getBackdropProps(() => setPreviewImage(null))}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col w-full cursor-default"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 bg-gray-900 text-white border-b border-gray-800">
              <div className="flex items-center gap-2 min-w-0 pr-4">
                <ImageIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-xs font-semibold truncate">{previewImage.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.url}
                  download={previewImage.name}
                  className="p-1.5 px-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
                  title="Letöltés"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Letöltés</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-600 text-gray-300 hover:text-white transition-colors cursor-pointer"
                  title="Bezárás"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-950 flex items-center justify-center min-h-[240px]">
              <img 
                src={previewImage.url} 
                alt={previewImage.name} 
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg" 
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
