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
  Move,
  Check,
  Edit2,
  FileSpreadsheet,
  FileCheck,
  List,
  LayoutGrid,
  Copy,
  Scissors,
  ClipboardPaste,
  Home,
  AlertTriangle,
} from 'lucide-react';
import { ProfileSwitcherButton } from '../ProfileSwitcherButton';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';
import { DeleteFolderConfirmModal } from './ConfirmModals';
import {
  validateUploadFile,
  readFileAsDataUrl,
  triggerSafeDownload,
  getFileValidationErrorMessage,
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
    uploadDocument,
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
  const [dragOverTarget, setDragOverTarget] = useState(null); // { kind: 'folder' | 'root' | 'up', id: string | null }
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

  // Upload Form state
  const fileInputRef = useRef(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [fileType, setFileType] = useState('pdf');
  const [uploadFolderId, setUploadFolderId] = useState(null);

  // Folder modal state (Create / Settings)
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [folderModalName, setFolderModalName] = useState('');
  const [folderModalColor, setFolderModalColor] = useState('amber');
  const [folderToDelete, setFolderToDelete] = useState(null);

  // Delete confirmation modal states (single doc, single folder, or bulk selection)
  const [docToDelete, setDocToDelete] = useState(null);
  const [bulkDeletePayload, setBulkDeletePayload] = useState(null); // { docIds: [], folderIds: [] }

  // Edit / Replace Document Modal state
  const [isEditDocModalOpen, setIsEditDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editDocTitle, setEditDocTitle] = useState('');
  const [editDocFileName, setEditDocFileName] = useState('');
  const [editDocFolderId, setEditDocFolderId] = useState(null);
  const [editReplacementFile, setEditReplacementFile] = useState(null);
  const editFileInputRef = useRef(null);

  // Move Items Modal state (supports single or multi-select docs & folders)
  const [movePayload, setMovePayload] = useState(null); // { docIds: [], folderIds: [], label: string }

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

  const moveModalFolderOptions = useMemo(() => {
    if (!movePayload) return [];
    return buildHierarchicalFolderList(allFolders, new Set(movePayload.folderIds || []));
  }, [allFolders, movePayload]);

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

  // Keep upload target folder synced with current folder
  useEffect(() => {
    setUploadFolderId(currentFolderId);
  }, [currentFolderId]);

  // Clear selection and pending rename when switching folders
  const navigateToFolder = useCallback(
    (folderId) => {
      cancelPendingRenameTimer();
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

  // Download Handler
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

  // External Drag & Drop Batch File Upload (strictly validated with magic-byte guard!)
  const handleExternalFilesDrop = useCallback(
    async (fileList, targetFolderId) => {
      if (!isAdmin) return;
      const files = Array.from(fileList || []);
      if (files.length === 0) return;

      setIsUploadingDrop(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const readyDocs = [];
        let firstErrorMsg = null;
        let rejectedCount = 0;

        for (const file of files) {
          const check = await validateUploadFile(file);
          if (!check.ok) {
            rejectedCount += 1;
            if (!firstErrorMsg) {
              firstErrorMsg = getFileValidationErrorMessage(check.reason, t, isEn);
            }
            continue;
          }

          try {
            const dataUrl = await readFileAsDataUrl(file);
            const titleGuess = check.sanitizedName.replace(/\.[^/.]+$/, '').replace(/[_]+/g, ' ').trim() || check.sanitizedName;
            readyDocs.push({
              title: titleGuess,
              fileName: check.sanitizedName,
              fileSize: check.sizeFormatted,
              fileType: check.ext || 'pdf',
              mimeType: file.type || undefined,
              uploadDate: today,
              fileData: dataUrl,
              folderId: targetFolderId || null,
            });
          } catch {
            rejectedCount += 1;
          }
        }

        if (readyDocs.length > 0) {
          await uploadDocumentsBatch(readyDocs);
        }

        if (rejectedCount > 0) {
          showToast(
            readyDocs.length > 0
              ? isEn
                ? `${rejectedCount} file(s) skipped due to size or security format rules.`
                : `${rejectedCount} fájl kihagyva méret- vagy biztonsági formátumkorlát miatt.`
              : firstErrorMsg ||
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
      if (isFolderModalOpen || isEditDocModalOpen || Boolean(movePayload) || Boolean(folderToDelete)) {
        if (e.key === 'Escape') {
          setIsFolderModalOpen(false);
          setIsEditDocModalOpen(false);
          setMovePayload(null);
          setFolderToDelete(null);
        }
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      const lowerKey = e.key.toLowerCase();

      if (e.key === 'Escape') {
        if (contextMenu.isOpen) {
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

      // Backspace or Alt+ArrowUp -> Go up one folder level (Windows Explorer standard)
      if ((e.key === 'Backspace' || (e.altKey && e.key === 'ArrowUp')) && currentFolderId !== null) {
        e.preventDefault();
        navigateUp();
        return;
      }

      // Enter -> Open selected folder or download selected document
      if (e.key === 'Enter' && selectedKeys.length === 1) {
        const parsed = parseSelectionKey(selectedKeys[0]);
        if (parsed?.type === 'folder') {
          e.preventDefault();
          navigateToFolder(parsed.id);
        } else if (parsed?.type === 'doc') {
          const d = allDocs.find((item) => item.id === parsed.id);
          if (d) {
            e.preventDefault();
            handleDownload(d);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    isAdmin,
    renamingKey,
    docToDelete,
    bulkDeletePayload,
    isFolderModalOpen,
    isEditDocModalOpen,
    movePayload,
    folderToDelete,
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
    handleDownload,
    deleteDocument,
    deleteExplorerItems,
  ]);

  if (!isOpen || !currentUser) return null;

  // =========================================================================
  // ITEM INTERACTION HANDLERS (Selection, Slow 2nd Click Rename, Double Click)
  // =========================================================================
  const handleItemClick = (e, type, item) => {
    e.stopPropagation();
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
      // Delay briefly so a fast double-click initiated on an already-selected item cancels rename and opens instead
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

  const handleItemDoubleClick = (e, type, item) => {
    e.stopPropagation();
    const key = makeSelectionKey(type, item.id);
    if (renamingKey === key) return;
    cancelPendingRenameTimer();

    if (type === 'folder') {
      navigateToFolder(item.id);
    } else {
      handleDownload(item);
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
    // Block dropping a folder onto itself or any of its descendants
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
    // Only clear if actually leaving the drop target element (not moving into its children)
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
    cancelPendingRenameTimer();

    const menuWidth = 230;
    const menuHeight = 310;
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

  // Upload Form Handlers
  const handleRemoveFile = () => {
    setFileData(null);
    setFileName('');
    setFileSize('');
    setFileType('pdf');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCancelUpload = () => {
    setDocTitle('');
    handleRemoveFile();
    setIsUploadOpen(false);
  };

  const handleFileObjectSelected = async (file) => {
    if (!file) return;
    const check = await validateUploadFile(file);
    if (!check.ok) {
      showToast(getFileValidationErrorMessage(check.reason, t, isEn), 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFileName(check.sanitizedName);
    setFileSize(check.sizeFormatted);
    setFileType(check.ext || 'pdf');

    if (!docTitle.trim()) {
      const nameWithoutExt = check.sanitizedName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
      setDocTitle(nameWithoutExt);
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFileData(dataUrl);
    } catch {
      showToast(isEn ? 'Error reading file.' : 'Hiba történt a fájl beolvasásakor.', 'error');
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length === 1) {
      await handleFileObjectSelected(files[0]);
    } else {
      // Multi-file selection uploads directly as a batch
      await handleExternalFilesDrop(files, uploadFolderId);
      handleCancelUpload();
    }
  };

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (!docTitle.trim()) return;

    uploadDocument({
      id: `doc-${Date.now()}`,
      title: docTitle.trim(),
      fileName: fileName || `${docTitle.trim().replace(/\s+/g, '_')}.pdf`,
      fileSize: fileSize || '1.0 MB',
      fileType: fileType || 'pdf',
      uploadDate: new Date().toISOString().slice(0, 10),
      fileData: fileData || null,
      folderId: uploadFolderId || null,
    });

    setDocTitle('');
    handleRemoveFile();
    setIsUploadOpen(false);
  };

  // Folder Create / Settings Modal Handlers
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

  // Document Edit / Replace Modal Handlers
  const openEditDocModal = (doc) => {
    setEditingDoc(doc);
    setEditDocTitle(doc.title || '');
    setEditDocFileName(doc.fileName || '');
    setEditDocFolderId(doc.folderId || '');
    setEditReplacementFile(null);
    setIsEditDocModalOpen(true);
  };

  const handleEditReplacementFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const check = await validateUploadFile(file);
    if (!check.ok) {
      showToast(getFileValidationErrorMessage(check.reason, t, isEn), 'error');
      if (editFileInputRef.current) editFileInputRef.current.value = '';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setEditReplacementFile({
        name: check.sanitizedName,
        size: check.sizeFormatted,
        type: check.ext || 'pdf',
        data: dataUrl,
      });
    } catch {
      showToast(isEn ? 'Error reading file.' : 'Hiba történt a fájl beolvasásakor.', 'error');
    }
  };

  const handleEditDocSubmit = (e) => {
    e.preventDefault();
    if (!editingDoc || !editDocTitle.trim()) return;

    const updatedData = {
      title: editDocTitle.trim(),
      fileName: editDocFileName.trim() || editingDoc.fileName,
      folderId: editDocFolderId ? editDocFolderId : null,
    };

    if (editReplacementFile) {
      updatedData.fileData = editReplacementFile.data;
      updatedData.fileName = editReplacementFile.name;
      updatedData.fileSize = editReplacementFile.size;
      updatedData.fileType = editReplacementFile.type;
    }

    updateDocument(editingDoc.id, updatedData);
    setIsEditDocModalOpen(false);
    setEditingDoc(null);
    setEditReplacementFile(null);
  };

  // Move Modal Handlers
  const openMoveDialog = (payload, label) => {
    setMovePayload({
      docIds: payload.docIds || [],
      folderIds: payload.folderIds || [],
      label,
    });
  };

  const handleMoveDialogSelect = async (targetFolderId) => {
    if (!movePayload) return;
    await moveExplorerItems(
      { docIds: movePayload.docIds, folderIds: movePayload.folderIds },
      targetFolderId || null
    );
    setMovePayload(null);
    setSelectedKeys([]);
  };

  const getFolderPathLabel = (folderId) => {
    if (!folderId) return t.root_folder_breadcrumb || (isEn ? 'Root Folder' : 'Főkönyvtár');
    return folderPathMap.get(folderId) || (t.root_folder_breadcrumb || (isEn ? 'Root Folder' : 'Főkönyvtár'));
  };

  const clipboardTotal = (clipboard?.docIds?.length || 0) + (clipboard?.folderIds?.length || 0);
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

  // Resolve active payload for context menu actions (acts on full multi-selection if right-clicked item is part of it)
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

      {/* Main Content Area */}
      <div
        className="flex-1 min-h-0 overflow-y-auto w-full overscroll-contain relative"
        onClick={() => {
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
                {t.max_file_size_hint || 'PDF, Word, Excel, JPG, PNG, WEBP (max 2 MB)'}
              </p>
            </div>
          </div>
        )}

        <div className="p-3 sm:p-4 md:p-6 space-y-3.5 max-w-6xl mx-auto w-full">
          {/* ============================================================== */}
          {/* WINDOWS EXPLORER RIBBON: ADDRESS BAR + COMMAND BAR             */}
          {/* ============================================================== */}
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Row 1: Up Button + Multi-Level Droppable Breadcrumb Bar + View Toggle */}
            <div className="px-3 sm:px-4 py-2.5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/60">
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

            {/* Row 2: Explorer Command Buttons + Search Input */}
            <div className="px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
              {/* Left: Primary & Selection Actions */}
              <div className="flex flex-wrap items-center gap-1.5">
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={openCreateFolderModal}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                      title={t.new_folder_btn || (isEn ? 'New Folder' : 'Új mappa')}
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>{t.new_folder_btn || (isEn ? 'New Folder' : 'Új mappa')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsUploadOpen((prev) => !prev)}
                      className="px-3 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                      title={t.upload_document}
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>{t.upload_document || (isEn ? 'Upload' : 'Feltöltés')}</span>
                    </button>

                    <div className="hidden sm:block w-px h-6 bg-gray-200 mx-1" />

                    {/* Explorer Clipboard & Item Actions */}
                    <button
                      type="button"
                      disabled={selectedParsed.total === 0}
                      onClick={() => handleCopySelection()}
                      className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                        selectedParsed.total === 0
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer'
                      }`}
                      title={`${t.explorer_copy_btn || (isEn ? 'Copy' : 'Másolás')} (Ctrl+C)`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">{t.explorer_copy_btn || (isEn ? 'Copy' : 'Másolás')}</span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedParsed.total === 0}
                      onClick={() => handleCutSelection()}
                      className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                        selectedParsed.total === 0
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer'
                      }`}
                      title={`${t.explorer_cut_btn || (isEn ? 'Cut' : 'Kivágás')} (Ctrl+X)`}
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">{t.explorer_cut_btn || (isEn ? 'Cut' : 'Kivágás')}</span>
                    </button>

                    <button
                      type="button"
                      disabled={!clipboard}
                      onClick={() => handlePasteInto(currentFolderId)}
                      className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                        !clipboard
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] cursor-pointer shadow-2xs'
                      }`}
                      title={`${t.explorer_paste_btn || (isEn ? 'Paste' : 'Beillesztés')} (Ctrl+V)`}
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">{t.explorer_paste_btn || (isEn ? 'Paste' : 'Beillesztés')}</span>
                      {clipboardTotal > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[#1E3A8A] text-white text-[10px] font-bold leading-4">
                          {clipboardTotal}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={selectedKeys.length !== 1}
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
                      className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                        selectedKeys.length !== 1
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer'
                      }`}
                      title={`${t.explorer_rename_btn || (isEn ? 'Rename' : 'Átnevezés')} (F2)`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">{t.explorer_rename_btn || (isEn ? 'Rename' : 'Átnevezés')}</span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedParsed.total === 0}
                      onClick={() =>
                        openMoveDialog(
                          selectedParsed,
                          selectedParsed.total === 1
                            ? (() => {
                                const p = parseSelectionKey(selectedKeys[0]);
                                if (p?.type === 'folder') {
                                  return allFolders.find((f) => f.id === p.id)?.name || '';
                                }
                                return allDocs.find((d) => d.id === p?.id)?.title || '';
                              })()
                            : `${selectedParsed.total} ${t.items_count || (isEn ? 'items' : 'elem')}`
                        )
                      }
                      className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                        selectedParsed.total === 0
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer'
                      }`}
                      title={t.move_doc_btn || (isEn ? 'Move' : 'Áthelyezés')}
                    >
                      <Move className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={selectedParsed.total === 0}
                      onClick={() => triggerDeleteForPayload()}
                      className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                        selectedParsed.total === 0
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-red-200 bg-white hover:bg-red-50 text-red-600 cursor-pointer'
                      }`}
                      title={t.context_delete || (isEn ? 'Delete (Del)' : 'Törlés (Del)')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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

            {/* Active Clipboard Strip */}
            {isAdmin && clipboard && clipboardTotal > 0 && (
              <div className="px-3 sm:px-4 py-2 bg-blue-50/80 border-t border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-[#1E3A8A] font-semibold">
                  {clipboard.mode === 'cut' ? (
                    <Scissors className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>
                    {clipboardTotal}{' '}
                    {clipboard.mode === 'cut'
                      ? t.explorer_clipboard_cut || (isEn ? 'item(s) cut — press Ctrl+V to move here' : 'elem kivágva — nyomj Ctrl+V-t a beillesztéshez')
                      : t.explorer_clipboard_copied || (isEn ? 'item(s) copied to clipboard' : 'elem másolva a vágólapra')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePasteInto(currentFolderId)}
                    className="px-2.5 py-1 rounded-lg bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    <span>{t.explorer_paste_here || (isEn ? 'Paste here (Ctrl+V)' : 'Beillesztés ide (Ctrl+V)')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClipboard(null)}
                    className="p-1 rounded-lg text-gray-500 hover:bg-blue-100 hover:text-gray-800 cursor-pointer"
                    title={t.explorer_clipboard_clear || (isEn ? 'Clear clipboard' : 'Vágólap ürítése')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* ADMIN UPLOAD PANEL (Collapsible, supports drag-drop & browse)  */}
          {/* ============================================================== */}
          {isAdmin && isUploadOpen && (
            <div
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs animate-fadeIn"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <UploadCloud className="w-5 h-5 text-[#1E3A8A]" />
                  <h4 className="text-sm font-bold text-gray-900">
                    {t.upload_document}
                    {currentFolder ? ` → ${getFolderPathLabel(currentFolder.id)}` : ''}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t.doc_title_label} *
                    </label>
                    <input
                      type="text"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder={isEn ? 'e.g. 2026 Annual Budget Report' : 'pl. 2026. Évi költségvetési beszámoló'}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t.doc_folder_label || (isEn ? 'Target Folder' : 'Mappa kiválasztása')}
                    </label>
                    <select
                      value={uploadFolderId || ''}
                      onChange={(e) => setUploadFolderId(e.target.value || null)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A] cursor-pointer"
                    >
                      <option value="">{t.no_folder_root || (isEn ? 'Root Folder (No folder)' : 'Főkönyvtár (Nincs mappa)')}</option>
                      {folderOptions.map(({ folder, depth }) => (
                        <option key={folder.id} value={folder.id}>
                          {'\u00A0\u00A0'.repeat(depth)}
                          {depth > 0 ? '↳ ' : ''}
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t.doc_file_label || (isEn ? 'Document file' : 'Dokumentum fájl')}
                  </label>

                  {fileName ? (
                    <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0">
                          {renderFileIcon(fileType, 'w-5 h-5')}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900 truncate" title={fileName}>
                            {fileName}
                          </div>
                          <div className="text-[11px] text-gray-500 font-medium">
                            {fileSize} • {fileType?.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-2.5 py-1 text-xs text-[#1E3A8A] hover:bg-blue-100 rounded-lg font-bold cursor-pointer transition-colors"
                        >
                          {t.choose_different_file || (isEn ? 'Choose different' : 'Másik fájl')}
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                          title={t.delete || 'Törlés'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        externalDragDepthRef.current = 0;
                        setIsExternalFileDragging(false);
                        const files = Array.from(e.dataTransfer?.files || []);
                        if (files.length === 1) {
                          await handleFileObjectSelected(files[0]);
                        } else if (files.length > 1) {
                          await handleExternalFilesDrop(files, uploadFolderId);
                          handleCancelUpload();
                        }
                      }}
                      className="border-2 border-dashed border-gray-300 hover:border-[#1E3A8A] bg-gray-50/70 hover:bg-blue-50/20 rounded-xl p-5 text-center cursor-pointer transition-all group"
                    >
                      <UploadCloud className="w-7 h-7 text-gray-400 group-hover:text-[#1E3A8A] mx-auto mb-1.5 transition-colors" />
                      <div className="text-xs font-bold text-gray-700 group-hover:text-[#1E3A8A]">
                        {t.drop_file_here || (isEn ? 'Click or drag & drop files here' : 'Kattints ide vagy húzd ide a fájlokat')}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {t.max_file_size_hint || 'PDF, Word, Excel, JPG, PNG, WEBP (max 2 MB)'}
                      </div>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ALLOWED_ACCEPT_ATTR}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-gray-600 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    {t.cancel || 'Mégse'}
                  </button>
                  <button
                    type="submit"
                    disabled={!docTitle.trim()}
                    className={`px-4 py-2 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 ${
                      !docTitle.trim()
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-[#1E3A8A] hover:bg-[#1e40af] text-white cursor-pointer'
                    }`}
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{t.doc_upload_btn || (isEn ? 'Upload' : 'Feltöltés')}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ============================================================== */}
          {/* UNIFIED EXPLORER VIEWPORT (LIST VIEW OR LARGE ICONS VIEW)      */}
          {/* ============================================================== */}
          {isUploadingDrop && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 text-xs font-bold text-[#1E3A8A] animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <span>{isEn ? 'Validating and uploading files...' : 'Fájlok ellenőrzése és feltöltése...'}</span>
            </div>
          )}

          {totalVisibleItems === 0 ? (
            <div
              className="bg-white rounded-2xl border border-gray-200 p-10 sm:p-14 text-center space-y-3 shadow-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
                <FolderOpen className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800">
                  {isSearching
                    ? t.no_docs_found || (isEn ? 'No matching items found' : 'Nincs találat')
                    : currentFolderId
                    ? t.empty_folder || (isEn ? 'This folder is empty.' : 'Ez a mappa még üres.')
                    : t.no_docs_found}
                </h4>
                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                  {isAdmin
                    ? t.explorer_drag_upload_hint ||
                      (isEn
                        ? 'Drag & drop files straight from File Explorer, upload via button, or create a subfolder.'
                        : 'Húzz be fájlokat közvetlenül a Windows Fájlkezelőből, vagy hozz létre almappát.')
                    : currentFolderId
                    ? t.empty_folder_desc
                    : t.no_docs_desc}
                </p>
              </div>
              {isAdmin && !isSearching && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={openCreateFolderModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>{t.new_folder_btn || (isEn ? 'New Folder' : 'Új mappa')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{t.upload_document || (isEn ? 'Upload' : 'Feltöltés')}</span>
                  </button>
                </div>
              )}
            </div>
          ) : viewMode === 'list' ? (
            /* ------------------------------------------------------------ */
            /* 1. WINDOWS EXPLORER LIST / DETAILS VIEW (UNIFIED TABLE)      */
            /* ------------------------------------------------------------ */
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              {/* Column Header Row */}
              <div
                className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_105px_100px_84px] md:grid-cols-[minmax(0,1fr)_110px_145px_100px_88px] items-center gap-2 px-3 sm:px-4 py-2 bg-gray-50/90 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider"
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

              {/* Unified Rows: Folders first, then Documents (identical visual geometry!) */}
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
                      {/* Col 1: Folder Icon + Name / Inline Rename Input */}
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
                      {/* Col 1: File Icon + Title / Inline Rename Input */}
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
            </div>
          ) : (
            /* ------------------------------------------------------------ */
            /* 2. WINDOWS EXPLORER LARGE ICONS VIEW (UNIFIED GRID)          */
            /* ------------------------------------------------------------ */
            <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 shadow-xs">
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
                      {/* Top-right context button */}
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

                      {/* Large Folder Icon */}
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

                      {/* Name / Inline Rename */}
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

                {/* Document Tiles (Matching Large Icons Visual Rhythm!) */}
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
                      {/* Top-left Download & Top-right Menu */}
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

                      {/* Large Document Icon + Extension Badge */}
                      <div className="relative w-14 h-14 flex items-center justify-center">
                        <div className={`w-12 h-14 rounded-xl border ${meta.iconBg} flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform`}>
                          {renderFileIcon(doc.fileType, 'w-7 h-7')}
                        </div>
                        <span className={`absolute -bottom-1 right-0 px-1.5 py-0.2 rounded text-[9px] font-black tracking-wide shadow-xs ${meta.badgeBg}`}>
                          {meta.extLabel}
                        </span>
                      </div>

                      {/* Title / Inline Rename */}
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
                    ? 'Double-click: open • Slow 2nd click / F2: rename • Ctrl+C/X/V • Del: delete'
                    : 'Dupla klikk: megnyitás • Lassú 2. klikk / F2: átnevezés • Ctrl+C/X/V • Del: törlés')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT-CLICK CONTEXT MENU                                       */}
      {/* ============================================================== */}
      {contextMenu.isOpen && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 bg-white rounded-2xl border border-gray-200 shadow-xl py-1.5 min-w-[220px] animate-fadeIn text-xs"
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

                  {clipboard && (
                    <button
                      type="button"
                      onClick={() => {
                        handlePasteInto(contextMenu.item.id);
                        setContextMenu((prev) => ({ ...prev, isOpen: false }));
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-[#1E3A8A] font-semibold cursor-pointer"
                    >
                      <ClipboardPaste className="w-4 h-4 text-[#1E3A8A]" />
                      <span>{t.explorer_paste_here || (isEn ? 'Paste into folder' : 'Beillesztés ide')}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const payload = getContextActionPayload();
                      const count = payload.docIds.length + payload.folderIds.length;
                      openMoveDialog(
                        payload,
                        count > 1 ? `${count} ${t.items_count || (isEn ? 'items' : 'elem')}` : contextMenu.item.name
                      );
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <Move className="w-4 h-4 text-amber-500" />
                    <span>{t.context_move || (isEn ? 'Move to Folder...' : 'Áthelyezés mappába...')}</span>
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

          {/* 2. Document Context Menu */}
          {contextMenu.type === 'doc' && contextMenu.item && (
            <>
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
                      openEditDocModal(contextMenu.item);
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>{t.context_edit || (isEn ? 'Edit & Replace File' : 'Szerkesztés és Fájlcsere')}</span>
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

                  <button
                    type="button"
                    onClick={() => {
                      const payload = getContextActionPayload();
                      const count = payload.docIds.length + payload.folderIds.length;
                      openMoveDialog(
                        payload,
                        count > 1 ? `${count} ${t.items_count || (isEn ? 'items' : 'elem')}` : contextMenu.item.title
                      );
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <Move className="w-4 h-4 text-amber-500" />
                    <span>{t.context_move || (isEn ? 'Move to Folder...' : 'Áthelyezés mappába...')}</span>
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
                      setIsUploadOpen(true);
                      setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4 text-[#1E3A8A]" />
                    <span>{t.context_upload_doc || (isEn ? 'Upload Document' : 'Új dokumentum feltöltése')}</span>
                  </button>

                  {clipboard && (
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
      {/* EDIT / REPLACE DOCUMENT MODAL                                  */}
      {/* ============================================================== */}
      {isEditDocModalOpen && editingDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setIsEditDocModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-lg p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-gray-900 font-display">
                  {t.edit_doc_modal_title || (isEn ? 'Edit Document & Replace File' : 'Dokumentum szerkesztése és fájlcsere')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditDocModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditDocSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {t.doc_title_label || (isEn ? 'Document Title' : 'Dokumentum megnevezése')} *
                </label>
                <input
                  type="text"
                  value={editDocTitle}
                  onChange={(e) => setEditDocTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t.doc_filename_label || (isEn ? 'Filename' : 'Fájlnév')}
                  </label>
                  <input
                    type="text"
                    value={editDocFileName}
                    onChange={(e) => setEditDocFileName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t.doc_folder_label || (isEn ? 'Target Folder' : 'Mappa kiválasztása')}
                  </label>
                  <select
                    value={editDocFolderId || ''}
                    onChange={(e) => setEditDocFolderId(e.target.value || null)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A] cursor-pointer"
                  >
                    <option value="">{t.no_folder_root || (isEn ? 'Root Folder (No folder)' : 'Főkönyvtár (Nincs mappa)')}</option>
                    {folderOptions.map(({ folder, depth }) => (
                      <option key={folder.id} value={folder.id}>
                        {'\u00A0\u00A0'.repeat(depth)}
                        {depth > 0 ? '↳ ' : ''}
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* File Replacement Section */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  {t.replace_file_label || (isEn ? 'Replace File (optional)' : 'Fájl megváltoztatása / cseréje (opcionális)')}
                </label>

                {editReplacementFile ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="min-w-0 text-xs">
                        <div className="font-bold text-gray-900 truncate">{editReplacementFile.name}</div>
                        <div className="text-[11px] text-emerald-700">
                          {editReplacementFile.size} • {isEn ? 'New version' : 'Új verzió'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditReplacementFile(null);
                        if (editFileInputRef.current) editFileInputRef.current.value = '';
                      }}
                      className="text-xs text-red-600 hover:underline font-bold shrink-0 ml-2 cursor-pointer"
                    >
                      {t.cancel || 'Mégse'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="min-w-0 text-xs">
                        <div className="font-bold text-gray-700 truncate">{editingDoc.fileName}</div>
                        <div className="text-[11px] text-gray-400">
                          {editingDoc.fileSize} • {t.current_file || (isEn ? 'Current file' : 'Jelenlegi fájl')}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="px-3 py-1 bg-white border border-gray-200 hover:bg-gray-100 text-[#1E3A8A] font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                    >
                      {t.choose_different_file || (isEn ? 'Replace file' : 'Fájl cseréje')}
                    </button>
                  </div>
                )}

                <input
                  ref={editFileInputRef}
                  type="file"
                  accept={ALLOWED_ACCEPT_ATTR}
                  onChange={handleEditReplacementFileChange}
                  className="hidden"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditDocModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {t.cancel || 'Mégse'}
                </button>
                <button
                  type="submit"
                  disabled={!editDocTitle.trim()}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer shadow-xs ${
                    !editDocTitle.trim() ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#1E3A8A] hover:bg-[#1e40af]'
                  }`}
                >
                  {t.save_changes_btn || 'Módosítások mentése'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MOVE ITEMS TO FOLDER MODAL (HIERARCHICAL & CYCLE-SAFE)         */}
      {/* ============================================================== */}
      {movePayload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setMovePayload(null)}
        >
          <div
            className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Move className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-900 font-display truncate">
                    {movePayload.docIds.length + movePayload.folderIds.length > 1
                      ? t.explorer_move_selected_title || (isEn ? 'Move selected items' : 'Kijelölt elemek áthelyezése')
                      : t.move_doc_modal_title || (isEn ? 'Move to Folder' : 'Áthelyezés mappába')}
                  </h3>
                  <span className="text-xs text-gray-500 truncate block">{movePayload.label}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMovePayload(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto py-1">
              {/* Root destination */}
              <button
                type="button"
                onClick={() => handleMoveDialogSelect(null)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-200 text-gray-800 text-xs font-bold transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-[#1E3A8A]" />
                  <span>{t.root_folder_breadcrumb || (isEn ? 'Root Folder' : 'Főkönyvtár')}</span>
                </div>
              </button>

              {/* Hierarchical Folders list (cycle targets already excluded) */}
              {moveModalFolderOptions.map(({ folder, depth }) => {
                const style = FOLDER_COLORS[folder.color] || FOLDER_COLORS.amber;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => handleMoveDialogSelect(folder.id)}
                    style={{ paddingLeft: `${10 + depth * 16}px` }}
                    className="w-full flex items-center justify-between pr-3 py-2.5 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-200 text-gray-800 text-xs font-bold transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Folder className={`w-4 h-4 shrink-0 ${style.fill}`} />
                      <span className="truncate">{folder.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setMovePayload(null)}
                className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                {t.cancel || 'Mégse'}
              </button>
            </div>
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
