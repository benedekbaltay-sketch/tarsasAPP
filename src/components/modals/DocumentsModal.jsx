import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Search,
  Download,
  Trash2,
  FileText,
  FileImage,
  X,
  UploadCloud,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Menu,
  RefreshCw,
  MoreVertical,
  ArrowUp,
  Check,
  Edit2,
  FileSpreadsheet,
  List,
  LayoutGrid,
  Copy,
  Scissors,
  ClipboardPaste,
  Home,
  AlertTriangle,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { ProfileSwitcherButton } from '../ProfileSwitcherButton';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';
import { DeleteFolderConfirmModal } from './ConfirmModals';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import {
  validateUploadFile,
  readFileAsDataUrl,
  triggerSafeDownload,
  getFileValidationErrorMessage,
  formatFileSize,
  MAX_DOCUMENT_BYTES,
  ALLOWED_ACCEPT_ATTR,
} from '../../utils/fileSecurity';
import {
  makeSelectionKey,
  parseSelectionKey,
  getFolderAncestors,
  isDescendantFolder,
  getFolderDirectItemCounts,
  buildHierarchicalFolderList,
  getDocumentTypeLabel,
} from '../../utils/docExplorer';

// ============================================================================
// WINDOWS 11 TWO-TONE EXPLORER TOOLBAR ICONS
// ============================================================================
function Win11NewIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="#525252" strokeWidth="1.35" />
      <path d="M10 6.2V13.8M6.2 10H13.8" stroke="#0067C0" strokeWidth="1.55" strokeLinecap="round" />
    </svg>
  );
}

function Win11CutIcon({ active }) {
  const base = active ? '#404040' : '#BDBDBD';
  const accent = active ? '#0067C0' : '#9DC6EC';
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-[18px] h-[18px]" aria-hidden="true">
      <path d="M5.5 3.5L12.6 13.4M14.5 3.5L7.4 13.4" stroke={base} strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="6.3" cy="15.2" r="2.1" stroke={accent} strokeWidth="1.35" />
      <circle cx="13.7" cy="15.2" r="2.1" stroke={accent} strokeWidth="1.35" />
    </svg>
  );
}

function Win11CopyIcon({ active }) {
  const base = active ? '#404040' : '#BDBDBD';
  const accent = active ? '#0067C0' : '#9DC6EC';
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-[18px] h-[18px]" aria-hidden="true">
      <path
        d="M6.8 6.5H5.5C4.67 6.5 4 7.17 4 8V15.5C4 16.33 4.67 17 5.5 17H11.5C12.33 17 13 16.33 13 15.5V14.2"
        stroke={base}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <rect x="7.5" y="3.2" width="8.5" height="10.8" rx="1.6" stroke={accent} strokeWidth="1.35" />
    </svg>
  );
}

function Win11PasteIcon({ active }) {
  const base = active ? '#404040' : '#BDBDBD';
  const accent = active ? '#0067C0' : '#9DC6EC';
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-[18px] h-[18px]" aria-hidden="true">
      <path
        d="M7.4 4.2H5.6C4.72 4.2 4 4.92 4 5.8V15.2C4 16.08 4.72 16.8 5.6 16.8H8.6"
        stroke={base}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M12.6 4.2H14.2C15.08 4.2 15.8 4.92 15.8 5.8V7.2"
        stroke={base}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <rect x="7.3" y="2.8" width="5.4" height="2.6" rx="0.9" stroke={base} strokeWidth="1.3" />
      <rect x="9.6" y="7.8" width="6.8" height="9" rx="1.4" stroke={accent} strokeWidth="1.4" />
    </svg>
  );
}

function Win11RenameIcon({ active }) {
  const base = active ? '#404040' : '#BDBDBD';
  const accent = active ? '#0067C0' : '#9DC6EC';
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-[19px] h-[19px]" aria-hidden="true">
      <path
        d="M11.8 6.2H4.5C3.67 6.2 3 6.87 3 7.7V12.8C3 13.63 3.67 14.3 4.5 14.3H11.8M15.4 6.2H15.8C16.63 6.2 17.3 6.87 17.3 7.7V12.8C17.3 13.63 16.63 14.3 15.8 14.3H15.4"
        stroke={base}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M5.7 12.2L7.5 8.1L9.3 12.2M6.3 11H8.7" stroke={accent} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.6 4.2V16.2M12.2 4.2H15M12.2 16.2H15" stroke={accent} strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

function Win11ShareDownloadIcon({ active }) {
  const base = active ? '#404040' : '#BDBDBD';
  const accent = active ? '#0067C0' : '#9DC6EC';
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-[18px] h-[18px]" aria-hidden="true">
      <path
        d="M10.2 5.2H5.8C4.8 5.2 4 6 4 7V14.5C4 15.5 4.8 16.3 5.8 16.3H13.3C14.3 16.3 15.1 15.5 15.1 14.5V11.6"
        stroke={base}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M8.5 12.2C8.9 9.2 11 7.6 14.5 7.6H16.2M16.2 7.6L13.3 4.8M16.2 7.6L13.3 10.4"
        stroke={accent}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Win11TrashIcon({ active }) {
  const base = active ? '#404040' : '#BDBDBD';
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-[18px] h-[18px]" aria-hidden="true">
      <path d="M3.8 5.8H16.2" stroke={base} strokeWidth="1.35" strokeLinecap="round" />
      <path d="M7.6 5.8V4.3C7.6 3.7 8.05 3.2 8.65 3.2H11.35C11.95 3.2 12.4 3.7 12.4 4.3V5.8" stroke={base} strokeWidth="1.35" strokeLinecap="round" />
      <path d="M5.4 5.8L6.2 15.4C6.27 16.2 6.95 16.8 7.75 16.8H12.25C13.05 16.8 13.73 16.2 13.8 15.4L14.6 5.8" stroke={base} strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.6 9V13.8M11.4 9V13.8" stroke={base} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const FOLDER_COLORS = {
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-500',
    fill: 'fill-amber-400/90 text-amber-600',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100/90',
    dot: 'bg-amber-500',
  },
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    fill: 'fill-blue-400/85 text-blue-700',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100/90',
    dot: 'bg-blue-600',
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    fill: 'fill-emerald-400/85 text-emerald-700',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100/90',
    dot: 'bg-emerald-600',
  },
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
    fill: 'fill-indigo-400/85 text-indigo-700',
    border: 'border-indigo-200',
    iconBg: 'bg-indigo-100/90',
    dot: 'bg-indigo-600',
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    fill: 'fill-purple-400/85 text-purple-700',
    border: 'border-purple-200',
    iconBg: 'bg-purple-100/90',
    dot: 'bg-purple-600',
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    fill: 'fill-red-400/85 text-red-700',
    border: 'border-red-200',
    iconBg: 'bg-red-100/90',
    dot: 'bg-red-600',
  },
  slate: {
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    fill: 'fill-slate-400/85 text-slate-700',
    border: 'border-slate-200',
    iconBg: 'bg-slate-100',
    dot: 'bg-slate-600',
  },
};

function parseFileSizeBytes(sizeStr) {
  if (!sizeStr || typeof sizeStr !== 'string') return 0;
  const match = sizeStr.match(/([\d.]+)\s*(B|KB|MB|GB)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]) || 0;
  const unit = match[2].toUpperCase();
  if (unit === 'GB') return val * 1024 * 1024 * 1024;
  if (unit === 'MB') return val * 1024 * 1024;
  if (unit === 'KB') return val * 1024;
  return val;
}

function getFileVisualMeta(fileType) {
  const ext = String(fileType || 'pdf').toLowerCase().trim();
  if (ext === 'xlsx' || ext === 'xls') {
    return {
      extLabel: ext.toUpperCase(),
      iconBg: 'bg-emerald-50 border-emerald-200/80 text-emerald-600',
      badgeBg: 'bg-emerald-600 text-white',
      kind: 'sheet',
    };
  }
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return {
      extLabel: ext === 'jpeg' ? 'JPG' : ext.toUpperCase(),
      iconBg: 'bg-purple-50 border-purple-200/80 text-purple-600',
      badgeBg: 'bg-purple-600 text-white',
      kind: 'image',
    };
  }
  if (ext === 'docx' || ext === 'doc') {
    return {
      extLabel: ext.toUpperCase(),
      iconBg: 'bg-blue-50 border-blue-200/80 text-blue-600',
      badgeBg: 'bg-blue-600 text-white',
      kind: 'word',
    };
  }
  return {
    extLabel: (ext || 'PDF').toUpperCase(),
    iconBg: 'bg-rose-50 border-rose-200/80 text-rose-600',
    badgeBg: 'bg-rose-600 text-white',
    kind: 'pdf',
  };
}

function loadSavedViewMode() {
  try {
    const saved = localStorage.getItem('tarsashaz_docs_view');
    if (saved === 'list' || saved === 'grid') return saved;
  } catch {
    // ignore storage errors
  }
  return 'list';
}

export function DocumentsModal({ isOpen, onClose, onOpenDeleteDocConfirm, onOpenDrawer, onOpenProfileSelector }) {
  const {
    state,
    t,
    uploadDocumentsBatch,
    updateDocument,
    moveExplorerItems,
    duplicateExplorerItems,
    deleteDocument,
    deleteExplorerItems,
    createDocFolder,
    updateDocFolder,
    deleteDocFolder,
    fetchDocumentFile,
    showToast,
  } = useApp();

  const { documents, docFolders, currentUser, currentLang } = state;
  const isEn = currentLang === 'en';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  // Navigation, View Mode & Sorting
  const [currentFolderId, setCurrentFolderId] = useState(null); // null = root
  const [viewMode, setViewMode] = useState(loadSavedViewMode); // 'list' | 'grid'
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'date' | 'type' | 'size'
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingDocId, setLoadingDocId] = useState(null);

  // "Új ▾" dropdown menu state
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const newMenuRef = useRef(null);

  // In-App Document Preview Modal state (opened on fast double-click or Enter!)
  const [previewDoc, setPreviewDoc] = useState(null);

  // Windows Explorer Selection, Clipboard & Inline Rename state
  const [selectedKeys, setSelectedKeys] = useState([]); // array of 'folder:id' | 'doc:id'
  const [lastSelectedKey, setLastSelectedKey] = useState(null);
  const [clipboard, setClipboard] = useState(null); // { mode: 'copy' | 'cut', docIds: [], folderIds: [] }
  const [renamingKey, setRenamingKey] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef(null);
  const renameTimerRef = useRef(null);
  const renameCancelledRef = useRef(false);
  const lastClickRef = useRef({ key: null, time: 0 });

  // Drag & Drop state (External OS files + Internal docs/folders)
  const [isExternalFileDragging, setIsExternalFileDragging] = useState(false);
  const [dragOverTarget, setDragOverTarget] = useState(null); // { kind: 'folder' | 'root' | 'up' | 'crumb', id: string | null }
  const [isDraggingInternal, setIsDraggingInternal] = useState(false);
  const externalDragDepthRef = useRef(0);
  const internalDragPayloadRef = useRef(null); // { docIds: [], folderIds: [] }
  const [isUploadingDrop, setIsUploadingDrop] = useState(false);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    item: null,
    type: null, // 'folder' | 'doc' | 'background'
  });

  // Direct OS file picker input ref & Oversized File Modal state (iLovePDF helper)
  const fileInputRef = useRef(null);
  const [oversizedFiles, setOversizedFiles] = useState([]); // [{ name, sizeFormatted }]

  // Folder modal state (Create / Color settings)
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [folderModalName, setFolderModalName] = useState('');
  const [folderModalColor, setFolderModalColor] = useState('amber');

  // Delete confirmation modal states (single doc, single folder, or bulk selection)
  const [docToDelete, setDocToDelete] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [bulkDeletePayload, setBulkDeletePayload] = useState(null); // { docIds: [], folderIds: [] }

  const allFolders = useMemo(() => docFolders || [], [docFolders]);
  const allDocs = useMemo(() => documents || [], [documents]);

  // Ensure currentFolderId remains valid if deleted remotely
  useEffect(() => {
    if (currentFolderId && !allFolders.some((f) => f.id === currentFolderId)) {
      setCurrentFolderId(null);
    }
  }, [allFolders, currentFolderId]);

  const currentFolder = useMemo(
    () => allFolders.find((f) => f.id === currentFolderId) || null,
    [allFolders, currentFolderId]
  );

  const breadcrumbs = useMemo(
    () => getFolderAncestors(allFolders, currentFolderId),
    [allFolders, currentFolderId]
  );

  const isSearching = Boolean(searchQuery.trim());

  // Filtered & Sorted Folders + Documents (Folders always grouped above Documents like Windows Explorer)
  const { displayedFolders, displayedDocs, orderedKeys } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = (item) => {
      if (!q) return true;
      return (
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.fileName && item.fileName.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q))
      );
    };

    const rawFolders = isSearching
      ? allFolders.filter(matchesSearch)
      : allFolders.filter((f) => (f.parentId || null) === (currentFolderId || null));

    const rawDocs = isSearching
      ? allDocs.filter(matchesSearch)
      : allDocs.filter((d) => (d.folderId || null) === (currentFolderId || null));

    const dirMult = sortDir === 'asc' ? 1 : -1;

    const sortedFolders = [...rawFolders].sort((a, b) => {
      if (sortBy === 'date') {
        return String(a.createdAt || '').localeCompare(String(b.createdAt || '')) * dirMult;
      }
      if (sortBy === 'size') {
        const countA = getFolderDirectItemCounts(allFolders, allDocs, a.id).total;
        const countB = getFolderDirectItemCounts(allFolders, allDocs, b.id).total;
        return (countA - countB) * dirMult;
      }
      return String(a.name || '').localeCompare(String(b.name || ''), 'hu', { numeric: true }) * dirMult;
    });

    const sortedDocs = [...rawDocs].sort((a, b) => {
      if (sortBy === 'date') {
        return String(a.uploadDate || '').localeCompare(String(b.uploadDate || '')) * dirMult;
      }
      if (sortBy === 'type') {
        return String(a.fileType || '').localeCompare(String(b.fileType || ''), 'hu') * dirMult;
      }
      if (sortBy === 'size') {
        return (parseFileSizeBytes(a.fileSize) - parseFileSizeBytes(b.fileSize)) * dirMult;
      }
      return String(a.title || a.fileName || '').localeCompare(String(b.title || b.fileName || ''), 'hu', { numeric: true }) * dirMult;
    });

    const keys = [
      ...sortedFolders.map((f) => makeSelectionKey('folder', f.id)),
      ...sortedDocs.map((d) => makeSelectionKey('doc', d.id)),
    ];

    return { displayedFolders: sortedFolders, displayedDocs: sortedDocs, orderedKeys: keys };
  }, [allFolders, allDocs, currentFolderId, isSearching, searchQuery, sortBy, sortDir]);

  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const selectedParsed = useMemo(() => {
    const docIds = [];
    const folderIds = [];
    for (const key of selectedKeys) {
      const parsed = parseSelectionKey(key);
      if (!parsed) continue;
      if (parsed.type === 'doc' && allDocs.some((d) => d.id === parsed.id)) {
        docIds.push(parsed.id);
      } else if (parsed.type === 'folder' && allFolders.some((f) => f.id === parsed.id)) {
        folderIds.push(parsed.id);
      }
    }
    return { docIds, folderIds, total: docIds.length + folderIds.length };
  }, [selectedKeys, allDocs, allFolders]);

  const cutKeySet = useMemo(() => {
    if (!clipboard || clipboard.mode !== 'cut') return new Set();
    const set = new Set();
    (clipboard.folderIds || []).forEach((id) => set.add(makeSelectionKey('folder', id)));
    (clipboard.docIds || []).forEach((id) => set.add(makeSelectionKey('doc', id)));
    return set;
  }, [clipboard]);

  const folderOptions = useMemo(() => buildHierarchicalFolderList(allFolders), [allFolders]);

  const folderPathMap = useMemo(() => {
    const map = new Map();
    for (const entry of folderOptions) {
      map.set(entry.folder.id, entry.pathLabel);
    }
    return map;
  }, [folderOptions]);

  const handleChangeViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('tarsashaz_docs_view', mode);
    } catch {
      // ignore storage errors
    }
  };

  // Close "Új ▾" dropdown on outside click
  useEffect(() => {
    if (!isNewMenuOpen) return;
    const handleOutside = (event) => {
      if (newMenuRef.current && !newMenuRef.current.contains(event.target)) {
        setIsNewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isNewMenuOpen]);

  // Clear pending rename timer cleanly
  const cancelPendingRenameTimer = useCallback(() => {
    if (renameTimerRef.current) {
      clearTimeout(renameTimerRef.current);
      renameTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cancelPendingRenameTimer();
  }, [cancelPendingRenameTimer]);

  // Focus & select inline rename input when opening
  useEffect(() => {
    if (renamingKey && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingKey]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
  }, [isOpen]);

  useEffect(() => {
    if (!currentUser && isOpen) {
      onClose();
    }
  }, [currentUser, isOpen, onClose]);

  // Clear selection and pending rename when switching folders
  const navigateToFolder = useCallback(
    (folderId) => {
      cancelPendingRenameTimer();
      setIsNewMenuOpen(false);
      setRenamingKey(null);
      setSelectedKeys([]);
      setLastSelectedKey(null);
      setCurrentFolderId(folderId || null);
      if (isSearching) setSearchQuery('');
    },
    [cancelPendingRenameTimer, isSearching]
  );

  const navigateUp = useCallback(() => {
    if (!currentFolderId) return;
    const parentId = currentFolder?.parentId || null;
    navigateToFolder(parentId);
  }, [currentFolderId, currentFolder, navigateToFolder]);

  // Close context menu on global click
  useEffect(() => {
    if (!contextMenu.isOpen) return;
    const handleGlobalClick = () => {
      setContextMenu((prev) => ({ ...prev, isOpen: false }));
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu.isOpen]);

  // Inline Rename Actions
  const startInlineRename = useCallback(
    (type, item) => {
      if (!isAdmin || !item) return;
      cancelPendingRenameTimer();
      renameCancelledRef.current = false;
      const key = makeSelectionKey(type, item.id);
      setSelectedKeys([key]);
      setLastSelectedKey(key);
      setRenamingKey(key);
      setRenameValue(type === 'folder' ? item.name || '' : item.title || item.fileName || '');
    },
    [isAdmin, cancelPendingRenameTimer]
  );

  const cancelInlineRename = useCallback(() => {
    renameCancelledRef.current = true;
    setRenamingKey(null);
    setRenameValue('');
  }, []);

  const commitInlineRename = useCallback(() => {
    if (renameCancelledRef.current) return;
    if (!renamingKey) return;
    const parsed = parseSelectionKey(renamingKey);
    const trimmed = renameValue.trim();
    renameCancelledRef.current = true;
    setRenamingKey(null);
    setRenameValue('');

    if (!parsed || !trimmed) return;

    if (parsed.type === 'folder') {
      const existing = allFolders.find((f) => f.id === parsed.id);
      if (existing && trimmed !== existing.name) {
        updateDocFolder(existing.id, { name: trimmed });
      }
    } else if (parsed.type === 'doc') {
      const existing = allDocs.find((d) => d.id === parsed.id);
      if (existing && trimmed !== (existing.title || existing.fileName)) {
        updateDocument(existing.id, { title: trimmed });
      }
    }
  }, [renamingKey, renameValue, allFolders, allDocs, updateDocFolder, updateDocument]);

  // Clipboard Operations (Ctrl+C / Ctrl+X / Ctrl+V)
  const handleCopySelection = useCallback(
    (overridePayload = null) => {
      if (!isAdmin) return;
      const payload = overridePayload || selectedParsed;
      const total = (payload.docIds?.length || 0) + (payload.folderIds?.length || 0);
      if (total === 0) return;
      setClipboard({
        mode: 'copy',
        docIds: [...(payload.docIds || [])],
        folderIds: [...(payload.folderIds || [])],
      });
      showToast(
        `${total} ${t.explorer_clipboard_copied || (isEn ? 'item(s) copied to clipboard' : 'elem másolva a vágólapra')}`
      );
    },
    [isAdmin, selectedParsed, showToast, t, isEn]
  );

  const handleCutSelection = useCallback(
    (overridePayload = null) => {
      if (!isAdmin) return;
      const payload = overridePayload || selectedParsed;
      const total = (payload.docIds?.length || 0) + (payload.folderIds?.length || 0);
      if (total === 0) return;
      setClipboard({
        mode: 'cut',
        docIds: [...(payload.docIds || [])],
        folderIds: [...(payload.folderIds || [])],
      });
      showToast(
        `${total} ${t.explorer_clipboard_cut || (isEn ? 'item(s) cut — press Ctrl+V in target folder' : 'elem kivágva — válassz célmappát és nyomj Ctrl+V-t')}`
      );
    },
    [isAdmin, selectedParsed, showToast, t, isEn]
  );

  const handlePasteInto = useCallback(
    async (targetFolderId = currentFolderId) => {
      if (!isAdmin || !clipboard) return;
      const { mode, docIds, folderIds } = clipboard;
      if ((docIds?.length || 0) + (folderIds?.length || 0) === 0) return;

      if (mode === 'cut') {
        const res = await moveExplorerItems({ docIds, folderIds }, targetFolderId || null);
        if (res?.movedCount > 0 || res?.skippedCyclicCount === 0) {
          setClipboard(null);
          setSelectedKeys([]);
        }
      } else {
        await duplicateExplorerItems({ docIds, folderIds }, targetFolderId || null);
      }
    },
    [isAdmin, clipboard, currentFolderId, moveExplorerItems, duplicateExplorerItems]
  );

  // Trigger Delete Confirmation for current selection or explicit item
  const triggerDeleteForPayload = useCallback(
    (payload = selectedParsed) => {
      if (!isAdmin) return;
      const docIds = payload.docIds || [];
      const folderIds = payload.folderIds || [];
      const total = docIds.length + folderIds.length;
      if (total === 0) return;

      if (total === 1 && docIds.length === 1) {
        const doc = allDocs.find((d) => d.id === docIds[0]);
        if (doc) {
          setDocToDelete(doc);
        } else if (onOpenDeleteDocConfirm) {
          onOpenDeleteDocConfirm(docIds[0]);
        }
        return;
      }
      if (total === 1 && folderIds.length === 1) {
        const folder = allFolders.find((f) => f.id === folderIds[0]);
        if (folder) setFolderToDelete(folder);
        return;
      }
      setBulkDeletePayload({ docIds, folderIds });
    },
    [isAdmin, selectedParsed, allFolders, allDocs, onOpenDeleteDocConfirm]
  );

  // Explicit Download Handler
  const handleDownload = useCallback(
    async (doc) => {
      let data = doc.fileData;
      if (!data && doc.id) {
        setLoadingDocId(doc.id);
        try {
          data = await fetchDocumentFile(doc.id);
        } catch (err) {
          console.warn('Document download error:', err);
        } finally {
          setLoadingDocId(null);
        }
      }

      if (data && triggerSafeDownload(data, doc.fileName || `${doc.title}.${doc.fileType || 'pdf'}`)) {
        return;
      }
      showToast(
        t.file_download_error ||
          (isEn ? 'The document file could not be downloaded.' : 'A dokumentum fájlja jelenleg nem tölthető le.'),
        'error'
      );
    },
    [fetchDocumentFile, showToast, t, isEn]
  );

  // Toolbar 5th Icon Action: Download selected document(s)
  const handleDownloadSelectedDocs = useCallback(async () => {
    if (selectedParsed.docIds.length === 0) return;
    for (const dId of selectedParsed.docIds) {
      const found = allDocs.find((d) => d.id === dId);
      if (found) {
        await handleDownload(found);
      }
    }
  }, [selectedParsed.docIds, allDocs, handleDownload]);

  // Direct File Upload & External Drag & Drop Batch Handler
  // Enforces 10 MB per-document limit (long SZMSZ allowed, videos & huge files blocked) + magic bytes
  const handleExternalFilesDrop = useCallback(
    async (fileList, targetFolderId) => {
      if (!isAdmin) return;
      const files = Array.from(fileList || []);
      if (files.length === 0) return;

      setIsUploadingDrop(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const readyDocs = [];
        const tooLargeList = [];
        let firstOtherErrorMsg = null;
        let otherRejectedCount = 0;

        for (const file of files) {
          const check = await validateUploadFile(file, { maxBytes: MAX_DOCUMENT_BYTES });
          if (!check.ok) {
            if (check.reason === 'too_large') {
              tooLargeList.push({
                name: file.name || (isEn ? 'Unknown file' : 'Ismeretlen fájl'),
                sizeFormatted: formatFileSize(file.size),
              });
            } else {
              otherRejectedCount += 1;
              if (!firstOtherErrorMsg) {
                firstOtherErrorMsg = getFileValidationErrorMessage(check.reason, t, isEn, 10);
              }
            }
            continue;
          }

          try {
            const dataUrl = await readFileAsDataUrl(file);
            // Preserve the exact OS filename cleanly without mangling underscores or hyphens
            const exactBaseName = check.sanitizedName.replace(/\.[^/.]+$/, '') || check.sanitizedName;
            readyDocs.push({
              title: exactBaseName,
              fileName: check.sanitizedName,
              fileSize: check.sizeFormatted,
              fileType: check.ext || 'pdf',
              mimeType: file.type || undefined,
              uploadDate: today,
              fileData: dataUrl,
              folderId: targetFolderId || null,
            });
          } catch {
            otherRejectedCount += 1;
          }
        }

        if (readyDocs.length > 0) {
          await uploadDocumentsBatch(readyDocs);
        }

        if (tooLargeList.length > 0) {
          setOversizedFiles(tooLargeList);
        }

        if (otherRejectedCount > 0) {
          showToast(
            readyDocs.length > 0
              ? isEn
                ? `${otherRejectedCount} file(s) skipped due to unsupported file format (videos and unsafe files are blocked).`
                : `${otherRejectedCount} fájl kihagyva nem támogatott formátum miatt (videók és nem engedélyezett fájlok tiltva).`
              : firstOtherErrorMsg ||
                  (isEn ? 'Unsupported or invalid file.' : 'Nem támogatott vagy érvénytelen fájl.'),
            'error'
          );
        }
      } finally {
        setIsUploadingDrop(false);
      }
    },
    [isAdmin, t, isEn, uploadDocumentsBatch, showToast]
  );

  // Keyboard shortcuts listener (Windows Explorer parity: Ctrl+C/X/V/A, F2, Delete, Enter, Backspace, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Skip all explorer shortcuts while DocumentPreviewModal is open
      if (previewDoc) return;

      // Handle Oversized File (iLovePDF) modal shortcuts
      if (oversizedFiles.length > 0) {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          setOversizedFiles([]);
        }
        return;
      }

      // Handle Single Doc Delete Modal shortcuts
      if (docToDelete) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setDocToDelete(null);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const targetId = docToDelete.id;
          setDocToDelete(null);
          deleteDocument(targetId);
          setSelectedKeys([]);
        }
        return;
      }

      // Handle Bulk Delete Modal shortcuts
      if (bulkDeletePayload) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setBulkDeletePayload(null);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const payload = bulkDeletePayload;
          setBulkDeletePayload(null);
          deleteExplorerItems(payload);
          setSelectedKeys([]);
        }
        return;
      }

      // Skip shortcuts if typing in an input, textarea, select, or inline rename
      if (renamingKey) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      // Skip explorer shortcuts if a sub-dialog is open
      if (isFolderModalOpen || Boolean(folderToDelete)) {
        if (e.key === 'Escape') {
          setIsFolderModalOpen(false);
          setFolderToDelete(null);
        }
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      const lowerKey = e.key.toLowerCase();

      if (e.key === 'Escape') {
        if (isNewMenuOpen) {
          setIsNewMenuOpen(false);
        } else if (contextMenu.isOpen) {
          setContextMenu((prev) => ({ ...prev, isOpen: false }));
        } else if (selectedKeys.length > 0) {
          setSelectedKeys([]);
          setLastSelectedKey(null);
        } else if (clipboard) {
          setClipboard(null);
        } else if (currentFolderId !== null) {
          navigateUp();
        }
        return;
      }

      // Select All (Ctrl+A)
      if (mod && lowerKey === 'a') {
        e.preventDefault();
        setSelectedKeys(orderedKeys);
        if (orderedKeys.length > 0) setLastSelectedKey(orderedKeys[orderedKeys.length - 1]);
        return;
      }

      // Copy (Ctrl+C)
      if (mod && lowerKey === 'c' && isAdmin && selectedParsed.total > 0) {
        e.preventDefault();
        handleCopySelection();
        return;
      }

      // Cut (Ctrl+X)
      if (mod && lowerKey === 'x' && isAdmin && selectedParsed.total > 0) {
        e.preventDefault();
        handleCutSelection();
        return;
      }

      // Paste (Ctrl+V)
      if (mod && lowerKey === 'v' && isAdmin && clipboard) {
        e.preventDefault();
        handlePasteInto(currentFolderId);
        return;
      }

      // Rename (F2)
      if (e.key === 'F2' && isAdmin && selectedKeys.length === 1) {
        e.preventDefault();
        const parsed = parseSelectionKey(selectedKeys[0]);
        if (parsed?.type === 'folder') {
          const f = allFolders.find((item) => item.id === parsed.id);
          if (f) startInlineRename('folder', f);
        } else if (parsed?.type === 'doc') {
          const d = allDocs.find((item) => item.id === parsed.id);
          if (d) startInlineRename('doc', d);
        }
        return;
      }

      // Delete selected item(s)
      if (e.key === 'Delete' && isAdmin && selectedParsed.total > 0) {
        e.preventDefault();
        triggerDeleteForPayload();
        return;
      }

      // Backspace or Alt+ArrowUp -> Go up one folder level
      if ((e.key === 'Backspace' || (e.altKey && e.key === 'ArrowUp')) && currentFolderId !== null) {
        e.preventDefault();
        navigateUp();
        return;
      }

      // Enter -> Open selected folder OR open in-app Preview for selected document
      if (e.key === 'Enter' && selectedKeys.length === 1) {
        const parsed = parseSelectionKey(selectedKeys[0]);
        if (parsed?.type === 'folder') {
          e.preventDefault();
          navigateToFolder(parsed.id);
        } else if (parsed?.type === 'doc') {
          const d = allDocs.find((item) => item.id === parsed.id);
          if (d) {
            e.preventDefault();
            setPreviewDoc(d);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    isAdmin,
    previewDoc,
    oversizedFiles,
    renamingKey,
    docToDelete,
    bulkDeletePayload,
    isFolderModalOpen,
    folderToDelete,
    isNewMenuOpen,
    contextMenu.isOpen,
    selectedKeys,
    selectedParsed,
    orderedKeys,
    clipboard,
    currentFolderId,
    allFolders,
    allDocs,
    navigateUp,
    navigateToFolder,
    handleCopySelection,
    handleCutSelection,
    handlePasteInto,
    startInlineRename,
    triggerDeleteForPayload,
    deleteDocument,
    deleteExplorerItems,
  ]);

  if (!isOpen || !currentUser) return null;

  // =========================================================================
  // ITEM INTERACTION HANDLERS (Selection, Slow 2nd Click Rename, Double Click)
  // =========================================================================
  const handleItemClick = (e, type, item) => {
    e.stopPropagation();
    setIsNewMenuOpen(false);
    const key = makeSelectionKey(type, item.id);
    if (renamingKey === key) return;
    if (renamingKey) commitInlineRename();

    const now = Date.now();

    // Ctrl/Cmd + Click -> toggle multi-selection
    if (e.ctrlKey || e.metaKey) {
      cancelPendingRenameTimer();
      setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
      setLastSelectedKey(key);
      lastClickRef.current = { key, time: now };
      return;
    }

    // Shift + Click -> continuous range selection
    if (e.shiftKey && lastSelectedKey) {
      cancelPendingRenameTimer();
      const startIdx = orderedKeys.indexOf(lastSelectedKey);
      const endIdx = orderedKeys.indexOf(key);
      if (startIdx !== -1 && endIdx !== -1) {
        const low = Math.min(startIdx, endIdx);
        const high = Math.max(startIdx, endIdx);
        setSelectedKeys(orderedKeys.slice(low, high + 1));
        lastClickRef.current = { key, time: now };
        return;
      }
    }

    // Normal Left Click: check for Windows Explorer "slow second click" inline rename!
    const wasSoleSelected = selectedKeys.length === 1 && selectedKeys[0] === key;
    const elapsedSinceLastClick = lastClickRef.current.key === key ? now - lastClickRef.current.time : Infinity;

    if (isAdmin && wasSoleSelected && elapsedSinceLastClick >= 420) {
      cancelPendingRenameTimer();
      renameTimerRef.current = setTimeout(() => {
        renameTimerRef.current = null;
        startInlineRename(type, item);
      }, 320);
      lastClickRef.current = { key, time: now };
      return;
    }

    cancelPendingRenameTimer();
    setSelectedKeys([key]);
    setLastSelectedKey(key);
    lastClickRef.current = { key, time: now };
  };

  // Fast Double-Click: opens Folder OR opens In-App Preview Modal for Document (never auto-downloads!)
  const handleItemDoubleClick = (e, type, item) => {
    e.stopPropagation();
    const key = makeSelectionKey(type, item.id);
    if (renamingKey === key) return;
    cancelPendingRenameTimer();

    if (type === 'folder') {
      navigateToFolder(item.id);
    } else {
      setPreviewDoc(item);
    }
  };

  // =========================================================================
  // DRAG & DROP HANDLERS (External OS Files + Internal Items)
  // =========================================================================
  const hasExternalFiles = (dataTransfer) => {
    if (!dataTransfer || internalDragPayloadRef.current) return false;
    const types = Array.from(dataTransfer.types || []);
    return types.includes('Files');
  };

  const isTargetValidForInternalDrop = (targetFolderId) => {
    const payload = internalDragPayloadRef.current;
    if (!payload) return false;
    const dest = targetFolderId || null;
    for (const fId of payload.folderIds || []) {
      if (isDescendantFolder(allFolders, dest, fId)) return false;
    }
    return true;
  };

  const handleItemDragStart = (e, type, item) => {
    if (!isAdmin || renamingKey) {
      e.preventDefault();
      return;
    }
    cancelPendingRenameTimer();

    const key = makeSelectionKey(type, item.id);
    let payload;
    if (selectedKeySet.has(key) && selectedParsed.total > 1) {
      payload = {
        docIds: [...selectedParsed.docIds],
        folderIds: [...selectedParsed.folderIds],
      };
    } else {
      setSelectedKeys([key]);
      setLastSelectedKey(key);
      payload = {
        docIds: type === 'doc' ? [item.id] : [],
        folderIds: type === 'folder' ? [item.id] : [],
      };
    }

    internalDragPayloadRef.current = payload;
    setIsDraggingInternal(true);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('application/x-tarsasapp-explorer', JSON.stringify(payload));
      e.dataTransfer.setData('text/plain', type === 'folder' ? item.name : item.title || item.fileName);
    } catch {
      // ignore dataTransfer restrictions
    }
  };

  const handleItemDragEnd = () => {
    internalDragPayloadRef.current = null;
    setIsDraggingInternal(false);
    setDragOverTarget(null);
  };

  const handleCanvasDragEnter = (e) => {
    if (!isAdmin) return;
    if (hasExternalFiles(e.dataTransfer)) {
      e.preventDefault();
      externalDragDepthRef.current += 1;
      setIsExternalFileDragging(true);
    }
  };

  const handleCanvasDragOver = (e) => {
    if (!isAdmin) return;
    if (hasExternalFiles(e.dataTransfer)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (!isExternalFileDragging) setIsExternalFileDragging(true);
    }
  };

  const handleCanvasDragLeave = (e) => {
    if (!isAdmin) return;
    if (hasExternalFiles(e.dataTransfer)) {
      externalDragDepthRef.current = Math.max(0, externalDragDepthRef.current - 1);
      if (externalDragDepthRef.current === 0) {
        setIsExternalFileDragging(false);
        setDragOverTarget(null);
      }
    }
  };

  const handleCanvasDrop = async (e) => {
    e.preventDefault();
    externalDragDepthRef.current = 0;
    setIsExternalFileDragging(false);
    setDragOverTarget(null);

    if (!isAdmin) return;
    if (internalDragPayloadRef.current) {
      internalDragPayloadRef.current = null;
      setIsDraggingInternal(false);
      return;
    }

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      await handleExternalFilesDrop(e.dataTransfer.files, currentFolderId);
    }
  };

  const handleTargetDragOver = (e, targetKind, targetFolderId) => {
    if (!isAdmin) return;
    if (internalDragPayloadRef.current) {
      if (!isTargetValidForInternalDrop(targetFolderId)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setDragOverTarget((prev) =>
        prev?.kind === targetKind && prev?.id === (targetFolderId || null)
          ? prev
          : { kind: targetKind, id: targetFolderId || null }
      );
      return;
    }

    if (hasExternalFiles(e.dataTransfer)) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      setIsExternalFileDragging(true);
      setDragOverTarget((prev) =>
        prev?.kind === targetKind && prev?.id === (targetFolderId || null)
          ? prev
          : { kind: targetKind, id: targetFolderId || null }
      );
    }
  };

  const handleTargetDragLeave = (e, targetKind, targetFolderId) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverTarget((prev) =>
      prev?.kind === targetKind && prev?.id === (targetFolderId || null) ? null : prev
    );
  };

  const handleTargetDrop = async (e, targetFolderId) => {
    e.preventDefault();
    e.stopPropagation();
    externalDragDepthRef.current = 0;
    setIsExternalFileDragging(false);
    setDragOverTarget(null);

    if (!isAdmin) return;

    const internalPayload = internalDragPayloadRef.current;
    if (internalPayload) {
      internalDragPayloadRef.current = null;
      setIsDraggingInternal(false);
      const res = await moveExplorerItems(internalPayload, targetFolderId || null);
      if (res?.movedCount > 0) {
        setSelectedKeys([]);
      }
      return;
    }

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      await handleExternalFilesDrop(e.dataTransfer.files, targetFolderId || null);
    }
  };

  // =========================================================================
  // CONTEXT MENU & MODALS HANDLERS
  // =========================================================================
  const handleContextMenu = (e, item, type) => {
    e.preventDefault();
    e.stopPropagation();
    setIsNewMenuOpen(false);
    cancelPendingRenameTimer();

    const menuWidth = 225;
    const menuHeight = 270;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

    if (item && type) {
      const key = makeSelectionKey(type, item.id);
      if (!selectedKeySet.has(key)) {
        setSelectedKeys([key]);
        setLastSelectedKey(key);
      }
    }

    setContextMenu({
      isOpen: true,
      x: Math.max(10, x),
      y: Math.max(10, y),
      item,
      type,
    });
  };

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  // Direct OS File Picker Handler (opened via Új -> Dokumentum or Right-click -> Feltöltés)
  const triggerDirectFilePicker = () => {
    if (!isAdmin) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDirectFileInputChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    await handleExternalFilesDrop(files, currentFolderId);
  };

  // Folder Create / Color Settings Modal Handlers
  const openCreateFolderModal = () => {
    setEditingFolder(null);
    setFolderModalName('');
    setFolderModalColor('amber');
    setIsFolderModalOpen(true);
  };

  const openFolderSettingsModal = (folder) => {
    setEditingFolder(folder);
    setFolderModalName(folder.name);
    setFolderModalColor(folder.color || 'amber');
    setIsFolderModalOpen(true);
  };

  const handleFolderModalSubmit = (e) => {
    e.preventDefault();
    if (!folderModalName.trim()) return;

    if (editingFolder) {
      updateDocFolder(editingFolder.id, {
        name: folderModalName.trim(),
        color: folderModalColor,
      });
    } else {
      createDocFolder({
        name: folderModalName.trim(),
        color: folderModalColor,
        parentId: currentFolderId || null,
      });
    }

    setIsFolderModalOpen(false);
    setEditingFolder(null);
  };

  const getFolderPathLabel = (folderId) => {
    if (!folderId) return t.root_folder_breadcrumb || (isEn ? 'Root Folder' : 'Főkönyvtár');
    return folderPathMap.get(folderId) || (t.root_folder_breadcrumb || (isEn ? 'Root Folder' : 'Főkönyvtár'));
  };

  const totalVisibleItems = displayedFolders.length + displayedDocs.length;

  const renderFileIcon = (fileType, sizeClass = 'w-5 h-5') => {
    const meta = getFileVisualMeta(fileType);
    if (meta.kind === 'sheet') return <FileSpreadsheet className={sizeClass} />;
    if (meta.kind === 'image') return <FileImage className={sizeClass} />;
    return <FileText className={sizeClass} />;
  };

  const renderSortIcon = (col) => {
    if (sortBy !== col) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-[#1E3A8A] shrink-0" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-[#1E3A8A] shrink-0" />
    );
  };

  const getContextActionPayload = () => {
    if (!contextMenu.item || !contextMenu.type) return { docIds: [], folderIds: [] };
    const key = makeSelectionKey(contextMenu.type, contextMenu.item.id);
    if (selectedKeySet.has(key) && selectedParsed.total > 1) {
      return { docIds: selectedParsed.docIds, folderIds: selectedParsed.folderIds };
    }
    return {
      docIds: contextMenu.type === 'doc' ? [contextMenu.item.id] : [],
      folderIds: contextMenu.type === 'folder' ? [contextMenu.item.id] : [],
    };
  };

  const activeDropFolderName =
    dragOverTarget?.kind === 'folder'
      ? allFolders.find((f) => f.id === dragOverTarget.id)?.name || ''
      : currentFolder?.name || (t.root_folder_breadcrumb || (isEn ? 'Root Folder' : 'Főkönyvtár'));

  // Command bar button active flags (matching Windows 11 Explorer)
  const canCutOrCopy = selectedParsed.total > 0;
  const canPaste = Boolean(clipboard && (clipboard.docIds.length + clipboard.folderIds.length) > 0);
  const canRename = selectedKeys.length === 1;
  const canDownloadSelection = selectedParsed.docIds.length > 0;
  const canDelete = selectedParsed.total > 0;

  return (
    <div
      className="fixed inset-0 z-40 bg-[#F3F4F6] flex flex-col overflow-hidden animate-fadeIn select-none"
      onContextMenu={(e) => handleContextMenu(e, null, 'background')}
      onDragEnter={handleCanvasDragEnter}
      onDragOver={handleCanvasDragOver}
      onDragLeave={handleCanvasDragLeave}
      onDrop={handleCanvasDrop}
    >
      {/* Sticky Header Container */}
      <div className="sticky top-0 z-10 w-full shadow-xs">
        <ImpersonationBanner onExit={onClose} />
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 md:px-8 py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Menu & Website Logo -> Back to Home */}
          <div className="flex items-center justify-start gap-2 sm:gap-2.5 flex-1 min-w-0">
            {onOpenDrawer && (
              <button
                type="button"
                onClick={onOpenDrawer}
                className="w-8 h-8 sm:w-9 sm:h-8.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 shadow-2xs transition-all cursor-pointer flex-shrink-0 hover:border-gray-300"
                title={isEn ? 'Open Menu' : 'Menü megnyitása'}
                aria-label={isEn ? 'Open Menu' : 'Menü megnyitása'}
              >
                <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-gray-700" />
              </button>
            )}
            <NavLogoButton onClick={onClose} />
          </div>

          {/* Center: Current Interface Name */}
          <div className="flex items-center justify-center text-center px-1 sm:px-2 flex-shrink-0 max-w-[55%] sm:max-w-[50%]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <FolderOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0 text-left sm:text-center">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 font-display truncate">
                  {t.documents_title}
                </h2>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate block">
                  {isEn ? 'Condominium File Explorer' : 'Társasházi Irattár & Fájlkezelő'}
                </span>
              </div>
            </div>
          </div>

          {/* Right side: Profile Selector */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 flex-1 flex-shrink-0">
            <ProfileSwitcherButton onOpenProfileSelector={onOpenProfileSelector} />
          </div>
        </div>
      </div>

      {/* Hidden Direct OS File Picker Input (opened via Új -> Dokumentum or Right-click) */}
      {isAdmin && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_ACCEPT_ATTR}
          onChange={handleDirectFileInputChange}
          className="hidden"
        />
      )}

      {/* Main Content Area (scrollbar-gutter: stable eliminates width jump when folder is empty!) */}
      <div
        className="flex-1 min-h-0 overflow-y-auto w-full overscroll-contain relative"
        style={{ scrollbarGutter: 'stable' }}
        onClick={() => {
          setIsNewMenuOpen(false);
          if (renamingKey) {
            commitInlineRename();
          } else {
            setSelectedKeys([]);
            setLastSelectedKey(null);
          }
        }}
      >
        {/* External Drag-and-Drop Full-Canvas Upload Indicator */}
        {isAdmin && isExternalFileDragging && dragOverTarget?.kind !== 'folder' && (
          <div className="pointer-events-none fixed inset-x-4 bottom-6 top-20 z-30 flex items-center justify-center rounded-3xl border-2 border-dashed border-[#1E3A8A] bg-blue-50/90 backdrop-blur-[2px] shadow-xl animate-fadeIn">
            <div className="text-center space-y-2 px-6 py-8 bg-white/95 rounded-2xl border border-blue-200 shadow-md max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center mx-auto">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">
                {t.explorer_drop_upload_title || (isEn ? 'Drop files here to upload' : 'Engedd el a fájlokat a feltöltéshez')}
              </h3>
              <p className="text-xs text-[#1E3A8A] font-semibold">
                {t.explorer_drop_upload_target || (isEn ? 'Target folder' : 'Célmappa')}: {activeDropFolderName}
              </p>
              <p className="text-[11px] text-gray-400">
                {t.max_file_size_hint || (isEn ? 'PDF, Word, Excel or image format (max 10 MB)' : 'PDF, Word, Excel vagy képformátum (max. 10 MB)')}
              </p>
            </div>
          </div>
        )}

        <div className="p-3 sm:p-4 md:p-6 space-y-3.5 max-w-6xl mx-auto w-full">
          {/* ============================================================== */}
          {/* WINDOWS 11 EXPLORER RIBBON: ADDRESS BAR + COMMAND BAR          */}
          {/* ============================================================== */}
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Row 1: Up Button + Multi-Level Droppable Breadcrumb Bar + View Toggle */}
            <div className="px-3 sm:px-4 py-2.5 border-b border-gray-100 rounded-t-2xl flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/60">
              <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto">
                {/* Up One Level Button (also droppable to move items up!) */}
                <button
                  type="button"
                  disabled={!currentFolderId}
                  onClick={navigateUp}
                  onDragOver={(e) => {
                    if (currentFolderId) handleTargetDragOver(e, 'up', currentFolder?.parentId || null);
                  }}
                  onDragLeave={(e) => handleTargetDragLeave(e, 'up', currentFolder?.parentId || null)}
                  onDrop={(e) => {
                    if (currentFolderId) handleTargetDrop(e, currentFolder?.parentId || null);
                  }}
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                    !currentFolderId
                      ? 'border-gray-200 bg-gray-100/70 text-gray-300 cursor-not-allowed'
                      : dragOverTarget?.kind === 'up'
                      ? 'border-[#1E3A8A] bg-blue-100 text-[#1E3A8A] ring-2 ring-[#1E3A8A]/40 scale-105 cursor-pointer'
                      : 'border-gray-200 bg-white hover:bg-gray-100 text-gray-700 cursor-pointer shadow-2xs'
                  }`}
                  title={t.explorer_up_folder || (isEn ? 'Up one level (Backspace)' : 'Egy szinttel feljebb (Backspace)')}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>

                {/* Address / Breadcrumb Trail */}
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1 min-w-0 flex-1 overflow-x-auto shadow-2xs">
                  <button
                    type="button"
                    onClick={() => navigateToFolder(null)}
                    onDragOver={(e) => handleTargetDragOver(e, 'root', null)}
                    onDragLeave={(e) => handleTargetDragLeave(e, 'root', null)}
                    onDrop={(e) => handleTargetDrop(e, null)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      dragOverTarget?.kind === 'root'
                        ? 'bg-blue-100 text-[#1E3A8A] ring-2 ring-[#1E3A8A]'
                        : currentFolderId === null
                        ? 'bg-[#1E3A8A] text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Home className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.root_folder_breadcrumb || (isEn ? 'Root Folder' : 'Főkönyvtár')}</span>
                  </button>

                  {breadcrumbs.map((crumb, idx) => {
                    const isLast = idx === breadcrumbs.length - 1;
                    const isCrumbDrop = dragOverTarget?.kind === 'crumb' && dragOverTarget?.id === crumb.id;
                    return (
                      <React.Fragment key={crumb.id}>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <button
                          type="button"
                          onClick={() => navigateToFolder(crumb.id)}
                          onDragOver={(e) => handleTargetDragOver(e, 'crumb', crumb.id)}
                          onDragLeave={(e) => handleTargetDragLeave(e, 'crumb', crumb.id)}
                          onDrop={(e) => handleTargetDrop(e, crumb.id)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 max-w-[180px] ${
                            isCrumbDrop
                              ? 'bg-blue-100 text-[#1E3A8A] ring-2 ring-[#1E3A8A]'
                              : isLast
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">{crumb.name}</span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* View Mode Switcher (List / Large Icons) */}
              <div className="flex items-center bg-gray-100/90 p-0.5 rounded-xl border border-gray-200 shrink-0">
                <button
                  type="button"
                  onClick={() => handleChangeViewMode('list')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-white text-[#1E3A8A] shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                  title={t.explorer_view_list || (isEn ? 'List view' : 'Lista nézet')}
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {t.explorer_view_list || (isEn ? 'List' : 'Lista')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeViewMode('grid')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white text-[#1E3A8A] shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                  title={t.explorer_view_icons || (isEn ? 'Large icons' : 'Nagy ikonok')}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {t.explorer_view_icons || (isEn ? 'Large icons' : 'Nagy ikonok')}
                  </span>
                </button>
              </div>
            </div>

            {/* Row 2: Windows 11 Command Bar + Search Input */}
            <div className="px-3 sm:px-4 py-2 rounded-b-2xl flex flex-wrap items-center justify-between gap-2.5 bg-white">
              {/* Left: Windows 11 Minimalist Command Buttons */}
              <div className="flex items-center gap-0.5 sm:gap-1.5">
                {isAdmin && (
                  <>
                    {/* (+) Új ▾ Dropdown (Folder / Document only) */}
                    <div className="relative" ref={newMenuRef}>
                      <button
                        type="button"
                        onClick={() => setIsNewMenuOpen((prev) => !prev)}
                        aria-expanded={isNewMenuOpen}
                        aria-haspopup="menu"
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-gray-800 transition-colors cursor-pointer ${
                          isNewMenuOpen ? 'bg-gray-100' : 'hover:bg-gray-100/90 active:bg-gray-200/70'
                        }`}
                        title={t.explorer_new_btn || (isEn ? 'New' : 'Új')}
                      >
                        <Win11NewIcon />
                        <span>{t.explorer_new_btn || (isEn ? 'New' : 'Új')}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-150 ${
                            isNewMenuOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isNewMenuOpen && (
                        <div
                          role="menu"
                          className="absolute left-0 mt-1.5 w-48 bg-white rounded-xl border border-gray-200 shadow-xl py-1.5 z-40 animate-fadeIn text-xs"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setIsNewMenuOpen(false);
                              openCreateFolderModal();
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                          >
                            <Folder className="w-4 h-4 fill-amber-400/90 text-amber-600 shrink-0" />
                            <span>{t.explorer_new_folder_item || (isEn ? 'Folder' : 'Mappa')}</span>
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setIsNewMenuOpen(false);
                              triggerDirectFilePicker();
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                          >
                            <FileText className="w-4 h-4 text-[#0067C0] shrink-0" />
                            <span>{t.explorer_new_doc_item || (isEn ? 'Document' : 'Dokumentum')}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Vertical Divider */}
                    <div className="w-px h-6 bg-gray-200 mx-1.5 sm:mx-2 shrink-0" />

                    {/* 1. Cut (Kivágás) */}
                    <button
                      type="button"
                      disabled={!canCutOrCopy}
                      onClick={() => handleCutSelection()}
                      className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                        canCutOrCopy
                          ? 'hover:bg-gray-100 active:bg-gray-200/70 cursor-pointer'
                          : 'cursor-default'
                      }`}
                      title={`${t.explorer_cut_btn || (isEn ? 'Cut' : 'Kivágás')} (Ctrl+X)`}
                      aria-label={t.explorer_cut_btn || (isEn ? 'Cut' : 'Kivágás')}
                    >
                      <Win11CutIcon active={canCutOrCopy} />
                    </button>

                    {/* 2. Copy (Másolás) */}
                    <button
                      type="button"
                      disabled={!canCutOrCopy}
                      onClick={() => handleCopySelection()}
                      className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                        canCutOrCopy
                          ? 'hover:bg-gray-100 active:bg-gray-200/70 cursor-pointer'
                          : 'cursor-default'
                      }`}
                      title={`${t.explorer_copy_btn || (isEn ? 'Copy' : 'Másolás')} (Ctrl+C)`}
                      aria-label={t.explorer_copy_btn || (isEn ? 'Copy' : 'Másolás')}
                    >
                      <Win11CopyIcon active={canCutOrCopy} />
                    </button>

                    {/* 3. Paste (Beillesztés) */}
                    <button
                      type="button"
                      disabled={!canPaste}
                      onClick={() => handlePasteInto(currentFolderId)}
                      className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                        canPaste
                          ? 'hover:bg-gray-100 active:bg-gray-200/70 cursor-pointer'
                          : 'cursor-default'
                      }`}
                      title={`${t.explorer_paste_btn || (isEn ? 'Paste' : 'Beillesztés')} (Ctrl+V)`}
                      aria-label={t.explorer_paste_btn || (isEn ? 'Paste' : 'Beillesztés')}
                    >
                      <Win11PasteIcon active={canPaste} />
                    </button>

                    {/* 4. Rename (Átnevezés [A|]) */}
                    <button
                      type="button"
                      disabled={!canRename}
                      onClick={() => {
                        const parsed = parseSelectionKey(selectedKeys[0]);
                        if (parsed?.type === 'folder') {
                          const f = allFolders.find((item) => item.id === parsed.id);
                          if (f) startInlineRename('folder', f);
                        } else if (parsed?.type === 'doc') {
                          const d = allDocs.find((item) => item.id === parsed.id);
                          if (d) startInlineRename('doc', d);
                        }
                      }}
                      className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                        canRename
                          ? 'hover:bg-gray-100 active:bg-gray-200/70 cursor-pointer'
                          : 'cursor-default'
                      }`}
                      title={`${t.explorer_rename_btn || (isEn ? 'Rename' : 'Átnevezés')} (F2)`}
                      aria-label={t.explorer_rename_btn || (isEn ? 'Rename' : 'Átnevezés')}
                    >
                      <Win11RenameIcon active={canRename} />
                    </button>

                    {/* 5. Share / Download (Letöltés) */}
                    <button
                      type="button"
                      disabled={!canDownloadSelection}
                      onClick={handleDownloadSelectedDocs}
                      className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                        canDownloadSelection
                          ? 'hover:bg-gray-100 active:bg-gray-200/70 cursor-pointer'
                          : 'cursor-default'
                      }`}
                      title={t.download || (isEn ? 'Download' : 'Letöltés')}
                      aria-label={t.download || (isEn ? 'Download' : 'Letöltés')}
                    >
                      <Win11ShareDownloadIcon active={canDownloadSelection} />
                    </button>

                    {/* 6. Delete (Törlés) */}
                    <button
                      type="button"
                      disabled={!canDelete}
                      onClick={() => triggerDeleteForPayload()}
                      className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                        canDelete
                          ? 'hover:bg-red-50 active:bg-red-100/80 cursor-pointer'
                          : 'cursor-default'
                      }`}
                      title={t.context_delete || (isEn ? 'Delete (Del)' : 'Törlés (Del)')}
                      aria-label={t.context_delete || (isEn ? 'Delete' : 'Törlés')}
                    >
                      <Win11TrashIcon active={canDelete} />
                    </button>
                  </>
                )}
              </div>

              {/* Right: Search Input */}
              <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.search_docs_placeholder || (isEn ? 'Search folders & files...' : 'Keresés mappák és fájlok között...')}
                  className="w-full pl-8 pr-8 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* UNIFIED EXPLORER VIEWPORT (CONSISTENT WIDTH & MINIMAL EMPTY)   */}
          {/* ============================================================== */}
          {isUploadingDrop && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 text-xs font-bold text-[#1E3A8A] animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <span>{isEn ? 'Validating and uploading files...' : 'Fájlok ellenőrzése és feltöltése...'}</span>
            </div>
          )}

          {viewMode === 'list' ? (
            /* ------------------------------------------------------------ */
            /* 1. WINDOWS EXPLORER LIST / DETAILS VIEW (UNIFIED TABLE)      */
            /* ------------------------------------------------------------ */
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden min-h-[360px] flex flex-col">
              {/* Column Header Row (always visible so layout never jumps when empty!) */}
              <div
                className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_105px_100px_84px] md:grid-cols-[minmax(0,1fr)_110px_145px_100px_88px] items-center gap-2 px-3 sm:px-4 py-2 bg-gray-50/90 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => toggleSort('name')}
                  className="flex items-center gap-1 text-left hover:text-gray-900 cursor-pointer"
                >
                  <span>{t.explorer_col_name || (isEn ? 'Name' : 'Név')}</span>
                  {renderSortIcon('name')}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort('date')}
                  className="hidden sm:flex items-center gap-1 text-left hover:text-gray-900 cursor-pointer"
                >
                  <span>{t.explorer_col_date || (isEn ? 'Date modified' : 'Módosítva')}</span>
                  {renderSortIcon('date')}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort('type')}
                  className="hidden md:flex items-center gap-1 text-left hover:text-gray-900 cursor-pointer"
                >
                  <span>{t.explorer_col_type || (isEn ? 'Type' : 'Típus')}</span>
                  {renderSortIcon('type')}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort('size')}
                  className="hidden sm:flex items-center justify-end gap-1 text-right hover:text-gray-900 cursor-pointer"
                >
                  <span>{t.explorer_col_size || (isEn ? 'Size' : 'Méret')}</span>
                  {renderSortIcon('size')}
                </button>
                <span className="text-right pr-1">&nbsp;</span>
              </div>

              {totalVisibleItems === 0 ? (
                <div className="flex-1 flex items-center justify-center py-16 px-4 text-center">
                  <p className="text-xs sm:text-sm text-gray-400 font-medium">
                    {isSearching
                      ? t.explorer_no_search_results || (isEn ? 'No matching items found.' : 'Nincs találat.')
                      : t.empty_folder || (isEn ? 'This folder is empty.' : 'A mappa üres.')}
                  </p>
                </div>
              ) : (
              /* Unified Rows: Folders first, then Documents */
              <div className="divide-y divide-gray-100">
                {displayedFolders.map((folder) => {
                  const key = makeSelectionKey('folder', folder.id);
                  const style = FOLDER_COLORS[folder.color] || FOLDER_COLORS.amber;
                  const counts = getFolderDirectItemCounts(allFolders, allDocs, folder.id);
                  const isSelected = selectedKeySet.has(key);
                  const isCut = cutKeySet.has(key);
                  const isRenaming = renamingKey === key;
                  const isDropHovered = dragOverTarget?.kind === 'folder' && dragOverTarget?.id === folder.id;

                  return (
                    <div
                      key={folder.id}
                      draggable={isAdmin && !isRenaming}
                      onDragStart={(e) => handleItemDragStart(e, 'folder', folder)}
                      onDragEnd={handleItemDragEnd}
                      onDragOver={(e) => handleTargetDragOver(e, 'folder', folder.id)}
                      onDragLeave={(e) => handleTargetDragLeave(e, 'folder', folder.id)}
                      onDrop={(e) => handleTargetDrop(e, folder.id)}
                      onClick={(e) => handleItemClick(e, 'folder', folder)}
                      onDoubleClick={(e) => handleItemDoubleClick(e, 'folder', folder)}
                      onContextMenu={(e) => handleContextMenu(e, folder, 'folder')}
                      className={`group grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_105px_100px_84px] md:grid-cols-[minmax(0,1fr)_110px_145px_100px_88px] items-center gap-2 px-3 sm:px-4 py-2.5 transition-all cursor-pointer ${
                        isDropHovered
                          ? 'bg-blue-100/85 ring-2 ring-inset ring-[#1E3A8A]'
                          : isSelected
                          ? 'bg-blue-50/95 ring-1 ring-inset ring-blue-300 border-l-2 border-l-[#1E3A8A]'
                          : 'bg-white hover:bg-slate-50/90'
                      } ${isCut ? 'opacity-50' : ''}`}
                    >
                      {/* Col 1: Folder Icon + Name / Inline Rename */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg ${style.iconBg} flex items-center justify-center shrink-0`}>
                          {isDropHovered ? (
                            <FolderOpen className={`w-4.5 h-4.5 ${style.fill}`} />
                          ) : (
                            <Folder className={`w-4.5 h-4.5 ${style.fill}`} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {isRenaming ? (
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onDoubleClick={(e) => e.stopPropagation()}
                              onBlur={commitInlineRename}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  commitInlineRename();
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelInlineRename();
                                }
                              }}
                              className="w-full max-w-sm px-2 py-0.5 bg-white border-2 border-[#1E3A8A] rounded-md text-xs sm:text-sm font-semibold text-gray-900 focus:outline-none shadow-xs"
                            />
                          ) : (
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                                {folder.name}
                              </span>
                              {isDropHovered && (
                                <span className="px-1.5 py-0.5 rounded-md bg-[#1E3A8A] text-white text-[10px] font-bold shrink-0">
                                  {isDraggingInternal
                                    ? t.explorer_drop_move_here || (isEn ? 'Move here' : 'Ide helyezés')
                                    : t.explorer_drop_upload_here || (isEn ? 'Upload here' : 'Feltöltés ide')}
                                </span>
                              )}
                            </div>
                          )}
                          {isSearching && folder.parentId && (
                            <span className="text-[10px] text-gray-400 truncate block">
                              {getFolderPathLabel(folder.parentId)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Col 2: Date */}
                      <div className="hidden sm:block text-xs text-gray-500 tabular-nums">
                        {folder.createdAt || '—'}
                      </div>

                      {/* Col 3: Type */}
                      <div className="hidden md:block text-xs text-gray-500 truncate">
                        {t.explorer_folder_type || (isEn ? 'File folder' : 'Mappa')}
                      </div>

                      {/* Col 4: Size / Count */}
                      <div className="hidden sm:block text-xs text-gray-500 text-right tabular-nums">
                        {counts.total === 0
                          ? t.explorer_empty_short || (isEn ? 'Empty' : 'Üres')
                          : `${counts.total} ${t.items_count || (isEn ? 'items' : 'elem')}`}
                      </div>

                      {/* Col 5: Subtle Quick Actions */}
                      <div className="flex items-center justify-end gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToFolder(folder.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#1E3A8A] hover:bg-blue-50 transition-colors cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                          title={t.context_open_folder || (isEn ? 'Open Folder' : 'Mappa megnyitása')}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleContextMenu(e, folder, 'folder');
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                            title={isEn ? 'More actions' : 'További műveletek'}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {displayedDocs.map((doc) => {
                  const key = makeSelectionKey('doc', doc.id);
                  const meta = getFileVisualMeta(doc.fileType);
                  const isSelected = selectedKeySet.has(key);
                  const isCut = cutKeySet.has(key);
                  const isRenaming = renamingKey === key;

                  return (
                    <div
                      key={doc.id}
                      draggable={isAdmin && !isRenaming}
                      onDragStart={(e) => handleItemDragStart(e, 'doc', doc)}
                      onDragEnd={handleItemDragEnd}
                      onClick={(e) => handleItemClick(e, 'doc', doc)}
                      onDoubleClick={(e) => handleItemDoubleClick(e, 'doc', doc)}
                      onContextMenu={(e) => handleContextMenu(e, doc, 'doc')}
                      className={`group grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_105px_100px_84px] md:grid-cols-[minmax(0,1fr)_110px_145px_100px_88px] items-center gap-2 px-3 sm:px-4 py-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/95 ring-1 ring-inset ring-blue-300 border-l-2 border-l-[#1E3A8A]'
                          : 'bg-white hover:bg-slate-50/90'
                      } ${isCut ? 'opacity-50' : ''}`}
                    >
                      {/* Col 1: File Icon + Title / Inline Rename */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg border ${meta.iconBg} flex items-center justify-center shrink-0`}>
                          {renderFileIcon(doc.fileType, 'w-4 h-4')}
                        </div>
                        <div className="min-w-0 flex-1">
                          {isRenaming ? (
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onDoubleClick={(e) => e.stopPropagation()}
                              onBlur={commitInlineRename}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  commitInlineRename();
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelInlineRename();
                                }
                              }}
                              className="w-full max-w-sm px-2 py-0.5 bg-white border-2 border-[#1E3A8A] rounded-md text-xs sm:text-sm font-semibold text-gray-900 focus:outline-none shadow-xs"
                            />
                          ) : (
                            <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate" title={doc.fileName || doc.title}>
                              {doc.title}
                            </div>
                          )}
                          {isSearching && (
                            <span className="text-[10px] text-gray-400 truncate block">
                              {getFolderPathLabel(doc.folderId)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Col 2: Date */}
                      <div className="hidden sm:block text-xs text-gray-500 tabular-nums">
                        {doc.uploadDate || '—'}
                      </div>

                      {/* Col 3: Type */}
                      <div className="hidden md:block text-xs text-gray-500 truncate">
                        {getDocumentTypeLabel(doc.fileType, isEn)}
                      </div>

                      {/* Col 4: Size */}
                      <div className="hidden sm:block text-xs text-gray-500 text-right tabular-nums">
                        {doc.fileSize || '—'}
                      </div>

                      {/* Col 5: Download + Context Menu */}
                      <div className="flex items-center justify-end gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(doc);
                          }}
                          disabled={loadingDocId === doc.id}
                          className="p-1.5 rounded-lg text-[#1E3A8A] hover:bg-blue-100/80 disabled:opacity-50 transition-colors cursor-pointer"
                          title={loadingDocId === doc.id ? t.downloading || 'Letöltés...' : t.download || 'Letöltés'}
                        >
                          {loadingDocId === doc.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleContextMenu(e, doc, 'doc');
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                            title={isEn ? 'More actions' : 'További műveletek'}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          ) : (
            /* ------------------------------------------------------------ */
            /* 2. WINDOWS EXPLORER LARGE ICONS VIEW (UNIFIED GRID)          */
            /* ------------------------------------------------------------ */
            <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 shadow-xs min-h-[360px] flex flex-col">
              {totalVisibleItems === 0 ? (
                <div className="flex-1 flex items-center justify-center py-16 px-4 text-center">
                  <p className="text-xs sm:text-sm text-gray-400 font-medium">
                    {isSearching
                      ? t.explorer_no_search_results || (isEn ? 'No matching items found.' : 'Nincs találat.')
                      : t.empty_folder || (isEn ? 'This folder is empty.' : 'A mappa üres.')}
                  </p>
                </div>
              ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
                {/* Folder Tiles */}
                {displayedFolders.map((folder) => {
                  const key = makeSelectionKey('folder', folder.id);
                  const style = FOLDER_COLORS[folder.color] || FOLDER_COLORS.amber;
                  const counts = getFolderDirectItemCounts(allFolders, allDocs, folder.id);
                  const isSelected = selectedKeySet.has(key);
                  const isCut = cutKeySet.has(key);
                  const isRenaming = renamingKey === key;
                  const isDropHovered = dragOverTarget?.kind === 'folder' && dragOverTarget?.id === folder.id;

                  return (
                    <div
                      key={folder.id}
                      draggable={isAdmin && !isRenaming}
                      onDragStart={(e) => handleItemDragStart(e, 'folder', folder)}
                      onDragEnd={handleItemDragEnd}
                      onDragOver={(e) => handleTargetDragOver(e, 'folder', folder.id)}
                      onDragLeave={(e) => handleTargetDragLeave(e, 'folder', folder.id)}
                      onDrop={(e) => handleTargetDrop(e, folder.id)}
                      onClick={(e) => handleItemClick(e, 'folder', folder)}
                      onDoubleClick={(e) => handleItemDoubleClick(e, 'folder', folder)}
                      onContextMenu={(e) => handleContextMenu(e, folder, 'folder')}
                      className={`group relative rounded-2xl border p-3.5 flex flex-col items-center text-center gap-2 transition-all cursor-pointer ${
                        isDropHovered
                          ? 'border-[#1E3A8A] bg-blue-100/80 ring-2 ring-[#1E3A8A]/40 scale-[1.02]'
                          : isSelected
                          ? 'border-[#1E3A8A] bg-blue-50/90 ring-2 ring-[#1E3A8A]/25'
                          : 'border-transparent hover:border-gray-200 hover:bg-slate-50/90'
                      } ${isCut ? 'opacity-50' : ''}`}
                    >
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContextMenu(e, folder, 'folder');
                          }}
                          className="absolute top-1.5 right-1.5 p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/90 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                          title={isEn ? 'More actions' : 'Mappa műveletek'}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div className="relative w-16 h-14 flex items-center justify-center">
                        {isDropHovered ? (
                          <FolderOpen className={`w-14 h-14 ${style.fill} drop-shadow-2xs transition-transform scale-105`} strokeWidth={1.6} />
                        ) : (
                          <Folder className={`w-14 h-14 ${style.fill} drop-shadow-2xs group-hover:scale-105 transition-transform`} strokeWidth={1.6} />
                        )}
                        {counts.total > 0 && (
                          <span className="absolute -bottom-0.5 right-0.5 px-1.5 py-0.2 rounded-md bg-white/95 border border-gray-200 text-[10px] font-bold text-gray-700 shadow-2xs">
                            {counts.total}
                          </span>
                        )}
                      </div>

                      <div className="w-full min-w-0">
                        {isRenaming ? (
                          <input
                            ref={renameInputRef}
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                            onBlur={commitInlineRename}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitInlineRename();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelInlineRename();
                              }
                            }}
                            className="w-full px-1.5 py-0.5 bg-white border-2 border-[#1E3A8A] rounded-md text-xs font-semibold text-gray-900 text-center focus:outline-none shadow-xs"
                          />
                        ) : (
                          <div className="text-xs font-semibold text-gray-900 line-clamp-2 break-words leading-snug" title={folder.name}>
                            {folder.name}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                          {isDropHovered ? (
                            <span className="text-[#1E3A8A] font-bold">
                              {isDraggingInternal
                                ? t.explorer_drop_move_here || (isEn ? 'Move here' : 'Ide helyezés')
                                : t.explorer_drop_upload_here || (isEn ? 'Upload here' : 'Feltöltés ide')}
                            </span>
                          ) : counts.total === 0 ? (
                            t.explorer_empty_short || (isEn ? 'Empty' : 'Üres')
                          ) : (
                            `${counts.total} ${t.items_count || (isEn ? 'items' : 'elem')}`
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Document Tiles */}
                {displayedDocs.map((doc) => {
                  const key = makeSelectionKey('doc', doc.id);
                  const meta = getFileVisualMeta(doc.fileType);
                  const isSelected = selectedKeySet.has(key);
                  const isCut = cutKeySet.has(key);
                  const isRenaming = renamingKey === key;

                  return (
                    <div
                      key={doc.id}
                      draggable={isAdmin && !isRenaming}
                      onDragStart={(e) => handleItemDragStart(e, 'doc', doc)}
                      onDragEnd={handleItemDragEnd}
                      onClick={(e) => handleItemClick(e, 'doc', doc)}
                      onDoubleClick={(e) => handleItemDoubleClick(e, 'doc', doc)}
                      onContextMenu={(e) => handleContextMenu(e, doc, 'doc')}
                      className={`group relative rounded-2xl border p-3.5 flex flex-col items-center text-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#1E3A8A] bg-blue-50/90 ring-2 ring-[#1E3A8A]/25'
                          : 'border-transparent hover:border-gray-200 hover:bg-slate-50/90'
                      } ${isCut ? 'opacity-50' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(doc);
                        }}
                        disabled={loadingDocId === doc.id}
                        className="absolute top-1.5 left-1.5 p-1 rounded-lg text-[#1E3A8A] bg-white/90 hover:bg-blue-100 border border-gray-200/70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                        title={t.download || 'Letöltés'}
                      >
                        {loadingDocId === doc.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContextMenu(e, doc, 'doc');
                          }}
                          className="absolute top-1.5 right-1.5 p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/90 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                          title={isEn ? 'More actions' : 'Fájl műveletek'}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div className="relative w-14 h-14 flex items-center justify-center">
                        <div className={`w-12 h-14 rounded-xl border ${meta.iconBg} flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform`}>
                          {renderFileIcon(doc.fileType, 'w-7 h-7')}
                        </div>
                        <span className={`absolute -bottom-1 right-0 px-1.5 py-0.2 rounded text-[9px] font-black tracking-wide shadow-xs ${meta.badgeBg}`}>
                          {meta.extLabel}
                        </span>
                      </div>

                      <div className="w-full min-w-0">
                        {isRenaming ? (
                          <input
                            ref={renameInputRef}
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                            onBlur={commitInlineRename}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitInlineRename();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelInlineRename();
                              }
                            }}
                            className="w-full px-1.5 py-0.5 bg-white border-2 border-[#1E3A8A] rounded-md text-xs font-semibold text-gray-900 text-center focus:outline-none shadow-xs"
                          />
                        ) : (
                          <div className="text-xs font-semibold text-gray-900 line-clamp-2 break-words leading-snug" title={doc.title}>
                            {doc.title}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                          {doc.fileSize || doc.uploadDate}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* WINDOWS EXPLORER STATUS FOOTER                                 */}
          {/* ============================================================== */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1 text-[11px] text-gray-500">
            <div className="flex items-center gap-2 font-medium">
              <span>
                {displayedFolders.length} {t.explorer_status_folders || (isEn ? 'folder(s)' : 'mappa')},{' '}
                {displayedDocs.length} {t.explorer_status_files || (isEn ? 'file(s)' : 'fájl')}
              </span>
              {selectedParsed.total > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="font-bold text-[#1E3A8A]">
                    {selectedParsed.total} {t.explorer_selected_count || (isEn ? 'selected' : 'elem kijelölve')}
                  </span>
                </>
              )}
            </div>
            {isAdmin && (
              <div className="hidden md:block text-gray-400">
                {t.explorer_shortcuts_legend ||
                  (isEn
                    ? 'Double-click: open / preview • Slow 2nd click / F2: rename • Ctrl+C/X/V • Del: delete'
                    : 'Dupla klikk: megnyitás / előnézet • Lassú 2. klikk / F2: átnevezés • Ctrl+C/X/V • Del: törlés')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT-CLICK CONTEXT MENU (NO Edit/Replace, NO Move button!)    */}
      {/* ============================================================== */}
      {contextMenu.isOpen && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 bg-white rounded-2xl border border-gray-200 shadow-xl py-1.5 min-w-[215px] animate-fadeIn text-xs"
        >
          {/* 1. Folder Context Menu */}
          {contextMenu.type === 'folder' && contextMenu.item && (
            <>
              <button
                type="button"
                onClick={() => {
                  navigateToFolder(contextMenu.item.id);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <span>{t.context_open_folder || (isEn ? 'Open Folder' : 'Mappa megnyitása')}</span>
              </button>

              {isAdmin && (
                <>
                  <div className="my-1 border-t border-gray-100" />

                  <button
                    type="button"
                    onClick={() => {
                      startInlineRename('folder', contextMenu.item);
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-blue-600" />
                    <span>{t.context_rename || (isEn ? 'Rename' : 'Átnevezés')} (F2)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      openFolderSettingsModal(contextMenu.item);
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <Folder className="w-4 h-4 text-amber-500" />
                    <span>{t.explorer_folder_props || (isEn ? 'Folder color / settings' : 'Mappa színe / szerkesztése')}</span>
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    type="button"
                    onClick={() => {
                      handleCopySelection(getContextActionPayload());
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <Copy className="w-4 h-4 text-gray-600" />
                    <span>{t.explorer_copy_btn || (isEn ? 'Copy' : 'Másolás')} (Ctrl+C)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleCutSelection(getContextActionPayload());
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <Scissors className="w-4 h-4 text-gray-600" />
                    <span>{t.explorer_cut_btn || (isEn ? 'Cut' : 'Kivágás')} (Ctrl+X)</span>
                  </button>

                  {canPaste && (
                    <button
                      type="button"
                      onClick={() => {
                        handlePasteInto(contextMenu.item.id);
                        setContextMenu((prev) => ({ ...prev, isOpen: false }));
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-[#1E3A8A] font-semibold cursor-pointer"
                    >
                      <ClipboardPaste className="w-4 h-4 text-[#1E3A8A]" />
                      <span>{t.explorer_paste_here || (isEn ? 'Paste here' : 'Beillesztés ide')}</span>
                    </button>
                  )}

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    type="button"
                    onClick={() => {
                      triggerDeleteForPayload(getContextActionPayload());
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-red-50 text-red-600 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t.context_delete || 'Törlés (Del)'}</span>
                  </button>
                </>
              )}
            </>
          )}

          {/* 2. Document Context Menu (Preview + Download + Rename/Copy/Cut/Delete) */}
          {contextMenu.type === 'doc' && contextMenu.item && (
            <>
              <button
                type="button"
                onClick={() => {
                  setPreviewDoc(contextMenu.item);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-[#1E3A8A] font-bold cursor-pointer"
              >
                <Eye className="w-4 h-4 text-[#1E3A8A]" />
                <span>{t.explorer_preview_btn || (isEn ? 'Open preview' : 'Előnézet megnyitása')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleDownload(contextMenu.item);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>{t.context_download || (isEn ? 'Download' : 'Letöltés')}</span>
              </button>

              {isAdmin && (
                <>
                  <div className="my-1 border-t border-gray-100" />

                  <button
                    type="button"
                    onClick={() => {
                      startInlineRename('doc', contextMenu.item);
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-blue-600" />
                    <span>{t.context_rename || (isEn ? 'Rename' : 'Átnevezés')} (F2)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleCopySelection(getContextActionPayload());
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <Copy className="w-4 h-4 text-gray-600" />
                    <span>{t.explorer_copy_btn || (isEn ? 'Copy' : 'Másolás')} (Ctrl+C)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleCutSelection(getContextActionPayload());
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <Scissors className="w-4 h-4 text-gray-600" />
                    <span>{t.explorer_cut_btn || (isEn ? 'Cut' : 'Kivágás')} (Ctrl+X)</span>
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    type="button"
                    onClick={() => {
                      triggerDeleteForPayload(getContextActionPayload());
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-red-50 text-red-600 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t.context_delete || 'Törlés (Del)'}</span>
                  </button>
                </>
              )}
            </>
          )}

          {/* 3. Background Context Menu */}
          {contextMenu.type === 'background' && (
            <>
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      openCreateFolderModal();
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4 text-amber-500" />
                    <span>{t.context_new_folder || (isEn ? 'New Folder' : 'Új mappa létrehozása')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                      triggerDirectFilePicker();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4 text-[#1E3A8A]" />
                    <span>{t.context_upload_doc || (isEn ? 'Upload Document' : 'Új dokumentum feltöltése')}</span>
                  </button>

                  {canPaste && (
                    <>
                      <div className="my-1 border-t border-gray-100" />
                      <button
                        type="button"
                        onClick={() => {
                          handlePasteInto(currentFolderId);
                          setContextMenu((prev) => ({ ...prev, isOpen: false }));
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-[#1E3A8A] font-semibold cursor-pointer"
                      >
                        <ClipboardPaste className="w-4 h-4 text-[#1E3A8A]" />
                        <span>{t.explorer_paste_here || (isEn ? 'Paste here (Ctrl+V)' : 'Beillesztés ide (Ctrl+V)')}</span>
                      </button>
                    </>
                  )}

                  {orderedKeys.length > 0 && (
                    <>
                      <div className="my-1 border-t border-gray-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedKeys(orderedKeys);
                          setContextMenu((prev) => ({ ...prev, isOpen: false }));
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-700 font-semibold cursor-pointer"
                      >
                        <Check className="w-4 h-4 text-gray-500" />
                        <span>{t.explorer_select_all || (isEn ? 'Select all (Ctrl+A)' : 'Összes kijelölése (Ctrl+A)')}</span>
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="px-3 py-2 text-gray-400 text-xs">{t.documents_title}</div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* OVERSIZED FILE MODAL WITH ILOVEPDF COMPRESSION LINK            */}
      {/* ============================================================== */}
      {oversizedFiles.length > 0 && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setOversizedFiles([])}
        >
          <div
            className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-display">
                    {t.explorer_file_too_large_title || (isEn ? 'File is too large' : 'A fájl mérete túl nagy')}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.explorer_file_too_large_limit ||
                      (isEn
                        ? 'Maximum file size is 10 MB per document (videos and oversized files cannot be uploaded).'
                        : 'Egy dokumentum maximális mérete 10 MB lehet (videók és túl nagy fájlok nem tölthetők fel).')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOversizedFiles([])}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Rejected oversized filenames list */}
            <div className="bg-red-50/70 border border-red-200/80 rounded-xl p-3 space-y-1.5 max-h-28 overflow-y-auto">
              {oversizedFiles.map((f, idx) => (
                <div key={`${f.name}-${idx}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-gray-800 truncate" title={f.name}>
                    {f.name}
                  </span>
                  <span className="font-bold text-red-600 shrink-0 tabular-nums">
                    {f.sizeFormatted}
                  </span>
                </div>
              ))}
            </div>

            {/* iLovePDF Compression Explanation & Direct Link */}
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-gray-700 leading-relaxed">
                {t.explorer_compress_pdf_help ||
                  (isEn
                    ? 'If a longer PDF document (e.g. bylaws, founding deed, or scanned minutes) exceeds 10 MB, you can quickly reduce its file size for free using the link below:'
                    : 'Ha egy hosszabb PDF dokumentum (pl. SZMSZ, alapító okirat vagy szkennelt jegyzőkönyv) meghaladja a 10 MB-ot, az alábbi oldalon gyorsan és ingyenesen csökkentheted a PDF méretét:')}
              </p>

              <a
                href="https://www.ilovepdf.com/compress_pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <span>{t.explorer_compress_pdf_btn || (isEn ? 'Compress PDF (iLovePDF)' : 'PDF méretének csökkentése (iLovePDF)')}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>

              <div className="text-center">
                <a
                  href="https://www.ilovepdf.com/compress_pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-mono text-[#1E3A8A] hover:underline break-all"
                >
                  https://www.ilovepdf.com/compress_pdf
                </a>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setOversizedFiles([])}
                className="w-full py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {t.explorer_understood_btn || (isEn ? 'Got it' : 'Rendben')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* IN-APP DOCUMENT PREVIEW MODAL (ZERO AUTO-DOWNLOAD)             */}
      {/* ============================================================== */}
      <DocumentPreviewModal
        doc={previewDoc}
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        onDownload={handleDownload}
      />

      {/* ============================================================== */}
      {/* CREATE / EDIT FOLDER MODAL                                     */}
      {/* ============================================================== */}
      {isFolderModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setIsFolderModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-md p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-display">
                    {editingFolder
                      ? t.rename_folder_title || (isEn ? 'Folder Settings' : 'Mappa szerkesztése')
                      : t.create_folder_modal_title || (isEn ? 'Create New Folder' : 'Új mappa létrehozása')}
                  </h3>
                  {!editingFolder && currentFolder && (
                    <span className="text-[11px] text-gray-500 block truncate max-w-[260px]">
                      {getFolderPathLabel(currentFolder.id)}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFolderModalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {t.folder_name_label || (isEn ? 'Folder Name' : 'Mappa neve')} *
                </label>
                <input
                  type="text"
                  value={folderModalName}
                  onChange={(e) => setFolderModalName(e.target.value)}
                  placeholder={t.folder_name_placeholder || 'pl. 2026. Évi Közgyűlések'}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  {t.folder_color_label || (isEn ? 'Folder Color' : 'Mappa színe')}
                </label>
                <div className="flex items-center gap-3">
                  {Object.keys(FOLDER_COLORS).map((cKey) => {
                    const c = FOLDER_COLORS[cKey];
                    const isPicked = folderModalColor === cKey;
                    return (
                      <button
                        key={cKey}
                        type="button"
                        onClick={() => setFolderModalColor(cKey)}
                        className={`w-7 h-7 rounded-full ${c.dot} cursor-pointer transition-transform flex items-center justify-center ${
                          isPicked ? 'ring-3 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105 opacity-80'
                        }`}
                      >
                        {isPicked && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {t.cancel || 'Mégse'}
                </button>
                <button
                  type="submit"
                  disabled={!folderModalName.trim()}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer shadow-xs ${
                    !folderModalName.trim() ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#1E3A8A] hover:bg-[#1e40af]'
                  }`}
                >
                  {editingFolder ? t.save_changes_btn || 'Mentés' : t.save_folder_btn || 'Mappa mentése'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SINGLE DOCUMENT DELETE CONFIRMATION MODAL                      */}
      {/* ============================================================== */}
      {docToDelete && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setDocToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {t.delete_doc_confirm || (isEn ? 'Are you sure you want to delete this document?' : 'Biztosan törölni szeretnéd ezt a dokumentumot?')}
              </h3>
              <p className="text-xs font-bold text-gray-700 mt-1.5 truncate">
                "{docToDelete.title || docToDelete.fileName}"
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                {t.cancel || 'Mégse'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = docToDelete.id;
                  setDocToDelete(null);
                  deleteDocument(targetId);
                  setSelectedKeys([]);
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {t.delete_btn || (isEn ? 'Delete' : 'Törlés')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SINGLE FOLDER DELETE CONFIRMATION MODAL                        */}
      {/* ============================================================== */}
      <DeleteFolderConfirmModal
        isOpen={Boolean(folderToDelete)}
        folder={folderToDelete}
        onClose={() => setFolderToDelete(null)}
        onConfirm={(folderId) => {
          const deleted = allFolders.find((f) => f.id === folderId);
          deleteDocFolder(folderId);
          if (currentFolderId === folderId) {
            setCurrentFolderId(deleted?.parentId || null);
          }
          setSelectedKeys([]);
        }}
      />

      {/* ============================================================== */}
      {/* BULK DELETE CONFIRMATION MODAL (MULTI-SELECT)                  */}
      {/* ============================================================== */}
      {bulkDeletePayload && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setBulkDeletePayload(null)}
        >
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {t.explorer_bulk_delete_title || (isEn ? 'Delete selected items?' : 'Kijelölt elemek törlése?')}
              </h3>
              <p className="text-xs font-bold text-gray-700 mt-1.5">
                {bulkDeletePayload.folderIds.length > 0 &&
                  `${bulkDeletePayload.folderIds.length} ${t.explorer_status_folders || (isEn ? 'folder(s)' : 'mappa')}`}
                {bulkDeletePayload.folderIds.length > 0 && bulkDeletePayload.docIds.length > 0 ? ' • ' : ''}
                {bulkDeletePayload.docIds.length > 0 &&
                  `${bulkDeletePayload.docIds.length} ${t.explorer_status_files || (isEn ? 'file(s)' : 'fájl')}`}
              </p>
              <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                {t.explorer_bulk_delete_desc ||
                  (isEn
                    ? 'Selected documents will be permanently deleted. Unselected items inside deleted folders will safely move up one level.'
                    : 'A kiválasztott dokumentumok véglegesen törlődnek. A törölt mappákban lévő nem kijelölt elemek biztonságban feljebb kerülnek.')}
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBulkDeletePayload(null)}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                {t.cancel || 'Mégse'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const payload = bulkDeletePayload;
                  setBulkDeletePayload(null);
                  deleteExplorerItems(payload);
                  setSelectedKeys([]);
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {t.delete_btn || (isEn ? 'Delete' : 'Törlés')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
