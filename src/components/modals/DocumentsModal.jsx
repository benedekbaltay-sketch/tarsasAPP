import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Folder,
  FolderOpen, 
  FolderPlus,
  Search, 
  Upload, 
  Download, 
  Trash2, 
  FileText, 
  File, 
  X, 
  UploadCloud, 
  ChevronDown, 
  ChevronRight,
  Menu,
  RefreshCw,
  MoreVertical,
  ArrowLeft,
  Move,
  Check,
  Edit2,
  FileSpreadsheet,
  FileCheck,
  Sparkles,
  Info
} from 'lucide-react';
import { ProfileSwitcherButton } from '../ProfileSwitcherButton';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';
import { DeleteFolderConfirmModal } from './ConfirmModals';

const FOLDER_COLORS = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', iconBg: 'bg-blue-100', dot: 'bg-blue-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', iconBg: 'bg-amber-100', dot: 'bg-amber-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', iconBg: 'bg-emerald-100', dot: 'bg-emerald-600' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', iconBg: 'bg-indigo-100', dot: 'bg-indigo-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', iconBg: 'bg-purple-100', dot: 'bg-purple-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', iconBg: 'bg-red-100', dot: 'bg-red-600' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', iconBg: 'bg-slate-100', dot: 'bg-slate-600' }
};

export function DocumentsModal({ isOpen, onClose, onOpenDeleteDocConfirm, onOpenDrawer, onOpenProfileSelector }) {
  const { 
    state, 
    t, 
    uploadDocument, 
    updateDocument, 
    moveDocument, 
    deleteDocument, 
    createDocFolder, 
    updateDocFolder, 
    deleteDocFolder, 
    fetchDocumentFile, 
    showToast 
  } = useApp();

  const { documents, docFolders, currentUser, currentLang } = state;
  const isEn = currentLang === 'en';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  // Navigation & selection state
  const [currentFolderId, setCurrentFolderId] = useState(null); // null = root
  const [selectedItem, setSelectedItem] = useState(null); // { id, type: 'folder' | 'doc' }
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingDocId, setLoadingDocId] = useState(null);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    item: null,
    type: null // 'folder' | 'doc' | 'background'
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

  // Folder modal state (Create / Rename)
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null); // null for new, folder obj for edit
  const [folderModalName, setFolderModalName] = useState('');
  const [folderModalColor, setFolderModalColor] = useState('blue');
  const [folderToDelete, setFolderToDelete] = useState(null);

  // Edit / Replace Document Modal state
  const [isEditDocModalOpen, setIsEditDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editDocTitle, setEditDocTitle] = useState('');
  const [editDocFileName, setEditDocFileName] = useState('');
  const [editDocFolderId, setEditDocFolderId] = useState(null);
  const [editReplacementFile, setEditReplacementFile] = useState(null);
  const editFileInputRef = useRef(null);

  // Quick Move Document Modal state
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [docToMove, setDocToMove] = useState(null);

  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
  const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'xlsx', 'xls', 'docx', 'doc'];

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

  // Keep upload folder synced with current folder
  useEffect(() => {
    setUploadFolderId(currentFolderId);
  }, [currentFolderId]);

  // Close context menu on any global click or escape
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu.isOpen) {
        setContextMenu(prev => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu.isOpen]);

  // Keyboard navigation & Delete shortcut listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'Escape') {
        if (contextMenu.isOpen) {
          setContextMenu(prev => ({ ...prev, isOpen: false }));
        } else if (isFolderModalOpen) {
          setIsFolderModalOpen(false);
        } else if (isEditDocModalOpen) {
          setIsEditDocModalOpen(false);
        } else if (isMoveModalOpen) {
          setIsMoveModalOpen(false);
        } else if (currentFolderId !== null) {
          setCurrentFolderId(null);
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && isAdmin && selectedItem) {
        e.preventDefault();
        if (selectedItem.type === 'doc') {
          onOpenDeleteDocConfirm(selectedItem.id);
        } else if (selectedItem.type === 'folder') {
          const folder = (docFolders || []).find(f => f.id === selectedItem.id);
          if (folder) setFolderToDelete(folder);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAdmin, selectedItem, contextMenu.isOpen, isFolderModalOpen, isEditDocModalOpen, isMoveModalOpen, currentFolderId, docFolders, onOpenDeleteDocConfirm]);

  if (!isOpen || !currentUser) return null;

  const currentFolder = (docFolders || []).find(f => f.id === currentFolderId);

  // File Upload Handlers
  const handleRemoveFile = () => {
    setFileData(null);
    setFileName('');
    setFileSize('');
    setFileType('pdf');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancelUpload = () => {
    setDocTitle('');
    handleRemoveFile();
    setIsUploadOpen(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showToast(t.file_too_large || "A feltöltött fájl mérete túl nagy! A megengedett maximális méret 2 MB.", "error");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      showToast(t.file_type_unsupported || "Nem támogatott fájlformátum! Kizárólag PDF, JPG, PNG vagy XLSX tölthető fel.", "error");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFileName(file.name);
    setFileSize(
      file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    );
    setFileType(ext || 'pdf');

    if (!docTitle.trim()) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setDocTitle(nameWithoutExt);
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (!docTitle.trim()) return;

    uploadDocument({
      id: `doc-${Date.now()}`,
      title: docTitle.trim(),
      fileName: fileName || `${docTitle.trim().replace(/\s+/g, '_')}.pdf`,
      fileSize: fileSize || "1.0 MB",
      fileType: fileType || "pdf",
      uploadDate: new Date().toISOString().slice(0, 10),
      fileData: fileData || null,
      folderId: uploadFolderId || null
    });

    setDocTitle('');
    handleRemoveFile();
    setIsUploadOpen(false);
  };

  // Download Handler
  const handleDownload = async (doc) => {
    let data = doc.fileData;
    if (!data && doc.id) {
      setLoadingDocId(doc.id);
      try {
        data = await fetchDocumentFile(doc.id);
      } catch (err) {
        console.warn("Document download error:", err);
      } finally {
        setLoadingDocId(null);
      }
    }

    if (data) {
      const a = document.createElement('a');
      a.href = data;
      a.download = doc.fileName || `${doc.title}.${doc.fileType || 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      showToast(t.file_download_error || (isEn ? "The document file could not be downloaded." : "A dokumentum fájlja jelenleg nem tölthető le."), "error");
    }
  };

  // Right-Click Context Menu Handler
  const handleContextMenu = (e, item, type) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 220;
    const menuHeight = 240;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

    if (item) {
      setSelectedItem({ id: item.id, type });
    } else {
      setSelectedItem(null);
    }

    setContextMenu({
      isOpen: true,
      x: Math.max(10, x),
      y: Math.max(10, y),
      item,
      type
    });
  };

  // Folder Operations
  const openCreateFolderModal = () => {
    setEditingFolder(null);
    setFolderModalName('');
    setFolderModalColor('blue');
    setIsFolderModalOpen(true);
  };

  const openRenameFolderModal = (folder) => {
    setEditingFolder(folder);
    setFolderModalName(folder.name);
    setFolderModalColor(folder.color || 'blue');
    setIsFolderModalOpen(true);
  };

  const handleFolderModalSubmit = (e) => {
    e.preventDefault();
    if (!folderModalName.trim()) return;

    if (editingFolder) {
      updateDocFolder(editingFolder.id, {
        name: folderModalName.trim(),
        color: folderModalColor
      });
    } else {
      createDocFolder({
        name: folderModalName.trim(),
        color: folderModalColor,
        parentId: currentFolderId || null
      });
    }

    setIsFolderModalOpen(false);
    setEditingFolder(null);
  };

  // Document Edit / Replace Operations
  const openEditDocModal = (doc) => {
    setEditingDoc(doc);
    setEditDocTitle(doc.title || '');
    setEditDocFileName(doc.fileName || '');
    setEditDocFolderId(doc.folderId || '');
    setEditReplacementFile(null);
    setIsEditDocModalOpen(true);
  };

  const handleEditReplacementFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showToast(t.file_too_large || "A fájl mérete túl nagy! Maximum 2 MB engedélyezett.", "error");
      if (editFileInputRef.current) editFileInputRef.current.value = '';
      return;
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      showToast(t.file_type_unsupported || "Nem támogatott fájlformátum!", "error");
      if (editFileInputRef.current) editFileInputRef.current.value = '';
      return;
    }

    const sizeStr = file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    const reader = new FileReader();
    reader.onload = () => {
      setEditReplacementFile({
        name: file.name,
        size: sizeStr,
        type: ext || 'pdf',
        data: reader.result
      });
    };
    reader.readAsDataURL(file);
  };

  const handleEditDocSubmit = (e) => {
    e.preventDefault();
    if (!editingDoc || !editDocTitle.trim()) return;

    const updatedData = {
      title: editDocTitle.trim(),
      fileName: editDocFileName.trim() || editingDoc.fileName,
      folderId: editDocFolderId ? editDocFolderId : null
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

  // Quick Move Operations
  const openMoveModal = (doc) => {
    setDocToMove(doc);
    setIsMoveModalOpen(true);
  };

  const handleMoveTo = (targetFolderId) => {
    if (!docToMove) return;
    moveDocument(docToMove.id, targetFolderId || null);
    setIsMoveModalOpen(false);
    setDocToMove(null);
  };

  // Filtering documents & folders
  const allFolders = docFolders || [];
  const allDocs = documents || [];

  // When searching, search globally across all folders
  const isSearching = Boolean(searchQuery.trim());
  const searchFilter = (item) => {
    if (!isSearching) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.fileName && item.fileName.toLowerCase().includes(q)) ||
      (item.name && item.name.toLowerCase().includes(q))
    );
  };

  const displayedFolders = isSearching
    ? allFolders.filter(searchFilter)
    : (currentFolderId === null ? allFolders : []);

  const displayedDocs = isSearching
    ? allDocs.filter(searchFilter)
    : allDocs.filter(d => (d.folderId || null) === currentFolderId);

  const getDocCountForFolder = (folderId) => {
    return allDocs.filter(d => d.folderId === folderId).length;
  };

  const getFolderName = (folderId) => {
    if (!folderId) return t.root_folder_breadcrumb || (isEn ? "Root Folder" : "Főkönyvtár");
    const found = allFolders.find(f => f.id === folderId);
    return found ? found.name : (t.root_folder_breadcrumb || "Főkönyvtár");
  };

  return (
    <div 
      className="fixed inset-0 z-40 bg-[#F3F4F6] flex flex-col overflow-hidden animate-fadeIn select-none"
      onContextMenu={(e) => handleContextMenu(e, null, 'background')}
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
                title={isEn ? "Open Menu" : "Menü megnyitása"}
                aria-label={isEn ? "Open Menu" : "Menü megnyitása"}
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
                  {isEn ? "Condominium Repository & Folders" : "Társasházi Irattár & Mapparendszer"}
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
      <div className="flex-1 min-h-0 overflow-y-auto w-full overscroll-contain">
        <div className="p-4 md:p-8 space-y-5 max-w-5xl mx-auto w-full">

          {/* Breadcrumb & Navigation Bar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-600 overflow-x-auto py-1">
              <button
                type="button"
                onClick={() => {
                  setCurrentFolderId(null);
                  setSelectedItem(null);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  currentFolderId === null
                    ? 'bg-[#1E3A8A] text-white font-bold shadow-xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Folder className="w-4 h-4" />
                <span>{t.root_folder_breadcrumb || (isEn ? "Root Folder" : "Főkönyvtár")}</span>
              </button>

              {currentFolder && (
                <>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-bold shadow-xs">
                    <FolderOpen className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="truncate max-w-[200px]">{currentFolder.name}</span>
                  </div>
                </>
              )}
            </div>

            {/* Quick Action Toolbar (New Folder, Upload, Back) */}
            <div className="flex items-center gap-2">
              {currentFolderId !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentFolderId(null);
                    setSelectedItem(null);
                  }}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title={t.back_to_root || (isEn ? "Back to Root Folder" : "Vissza a főkönyvtárba")}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.back_to_root || "Főkönyvtár"}</span>
                </button>
              )}

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={openCreateFolderModal}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title={t.new_folder_btn || (isEn ? "New Folder" : "Új mappa")}
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>{t.new_folder_btn || "Új mappa"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(!isUploadOpen)}
                    className="px-3.5 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title={t.upload_document}
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{t.upload_document || "Feltöltés"}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Admin Upload Section (Collapsible) */}
          {isAdmin && isUploadOpen && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <UploadCloud className="w-5 h-5 text-[#1E3A8A]" />
                  <h4 className="text-sm font-bold text-gray-900">
                    {t.upload_document}
                    {currentFolder ? ` → 📁 ${currentFolder.name}` : ''}
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
                      placeholder="pl. 2026. Évi költségvetési beszámoló"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t.doc_folder_label || "Mappa kiválasztása"}
                    </label>
                    <select
                      value={uploadFolderId || ''}
                      onChange={(e) => setUploadFolderId(e.target.value || null)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A] cursor-pointer"
                    >
                      <option value="">🏠 {t.no_folder_root || (isEn ? "Root Folder (No folder)" : "Főkönyvtár (Nincs mappa)")}</option>
                      {allFolders.map(f => (
                        <option key={f.id} value={f.id}>📁 {f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t.doc_file_label || "Dokumentum fájl"}
                  </label>
                  
                  {fileName ? (
                    <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
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
                          {t.choose_different_file || "Másik fájl"}
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                          title="Fájl törlése"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 hover:border-[#1E3A8A] bg-gray-50/70 hover:bg-blue-50/20 rounded-xl p-5 text-center cursor-pointer transition-all group"
                    >
                      <UploadCloud className="w-7 h-7 text-gray-400 group-hover:text-[#1E3A8A] mx-auto mb-1.5 transition-colors" />
                      <div className="text-xs font-bold text-gray-700 group-hover:text-[#1E3A8A]">
                        {t.drop_file_here || "Kattints ide a fájl kiválasztásához"}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {t.max_file_size_hint || "PDF, Word, Excel vagy képformátum (max 2 MB)"}
                      </div>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc"
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
                    {t.cancel || "Mégse"}
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
                    <span>{t.doc_upload_btn || "Feltöltés"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Search bar & Senior Keyboard Helper Tip */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search_docs_placeholder || "Keresés dokumentum neve, fájlnév vagy mappa alapján..."}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A] shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {isAdmin && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 px-1">
                <Info className="w-3.5 h-3.5 shrink-0 text-[#1E3A8A]" />
                <span>
                  {t.delete_key_hint || (isEn 
                    ? "Tip: Right-click any folder or file, or select and press Delete to delete." 
                    : "Tipp: Jobbklikkel vagy kijelölés után a Delete billentyűvel is gyorsan kezelheted a mappákat és fájlokat!")}
                </span>
              </div>
            )}
          </div>

          {/* 1. Folders Section (Rendered in Root or when searching) */}
          {displayedFolders.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-amber-500" />
                  {t.folders_section_title || (isEn ? "Folders" : "Mappák")} ({displayedFolders.length})
                </span>
                {isAdmin && currentFolderId === null && (
                  <button
                    type="button"
                    onClick={openCreateFolderModal}
                    className="text-xs font-bold text-[#1E3A8A] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    + {t.new_folder_btn || "Új mappa"}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {displayedFolders.map((folder) => {
                  const style = FOLDER_COLORS[folder.color] || FOLDER_COLORS.blue;
                  const count = getDocCountForFolder(folder.id);
                  const isSelected = selectedItem?.id === folder.id && selectedItem?.type === 'folder';

                  return (
                    <div
                      key={folder.id}
                      onClick={() => setSelectedItem({ id: folder.id, type: 'folder' })}
                      onDoubleClick={() => {
                        setCurrentFolderId(folder.id);
                        setSelectedItem(null);
                      }}
                      onContextMenu={(e) => handleContextMenu(e, folder, 'folder')}
                      className={`group relative rounded-2xl border p-4 transition-all cursor-pointer flex items-start justify-between gap-2 shadow-xs ${
                        isSelected 
                          ? 'border-[#1E3A8A] ring-2 ring-[#1E3A8A]/30 bg-blue-50/40' 
                          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                      title={isEn ? "Double click to open folder" : "Dupla kattintással megnyitható"}
                    >
                      <div 
                        className="flex items-center gap-3 min-w-0 flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentFolderId(folder.id);
                          setSelectedItem(null);
                        }}
                      >
                        <div className={`w-10 h-10 rounded-xl ${style.iconBg} ${style.text} flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}>
                          <Folder className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate group-hover:text-[#1E3A8A] transition-colors">
                            {folder.name}
                          </h4>
                          <span className="text-[11px] text-gray-500 font-medium block mt-0.5">
                            {count} {t.items_count || (isEn ? "items" : "fájl")}
                          </span>
                        </div>
                      </div>

                      {/* Folder Action 3-dots Menu Button */}
                      {isAdmin && (
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleContextMenu(e, folder, 'folder');
                            }}
                            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                            title={isEn ? "Folder options" : "Mappa beállításai"}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Documents Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                {t.documents_section_title || (isEn ? "Documents" : "Dokumentumok")} ({displayedDocs.length})
              </span>
              {currentFolder && (
                <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  📁 {currentFolder.name}
                </span>
              )}
            </div>

            {displayedDocs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">
                    {currentFolderId ? (t.empty_folder || "Ez a mappa még üres.") : t.no_docs_found}
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">
                    {currentFolderId 
                      ? (t.empty_folder_desc || "Tölts fel egy új dokumentumot közvetlenül ide, vagy helyezz át meglévő iratot ebbe a mappába.")
                      : t.no_docs_desc}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#1e40af] transition-colors cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{t.upload_document}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {displayedDocs.map((doc) => {
                  const isSelected = selectedItem?.id === doc.id && selectedItem?.type === 'doc';
                  const isXls = doc.fileType === 'xlsx' || doc.fileType === 'xls';
                  const isImg = ['jpg', 'jpeg', 'png', 'webp'].includes(doc.fileType);

                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedItem({ id: doc.id, type: 'doc' })}
                      onContextMenu={(e) => handleContextMenu(e, doc, 'doc')}
                      className={`rounded-2xl border p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-[#1E3A8A] ring-2 ring-[#1E3A8A]/30 bg-blue-50/40' 
                          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                          isXls 
                            ? 'bg-emerald-50 text-emerald-600'
                            : isImg 
                            ? 'bg-purple-50 text-purple-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}>
                          {isXls ? <FileSpreadsheet className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 truncate">
                            {doc.title}
                          </h4>
                          <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="font-mono text-[11px]">{doc.fileName}</span>
                            <span>&bull;</span>
                            <span>{doc.fileSize}</span>
                            <span>&bull;</span>
                            <span>{doc.uploadDate}</span>

                            {/* Show folder badge if searching across multiple folders */}
                            {isSearching && (
                              <>
                                <span>&bull;</span>
                                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                  <Folder className="w-3 h-3 text-amber-500" />
                                  {getFolderName(doc.folderId)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons (Senior-friendly visible buttons) */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleDownload(doc)}
                          disabled={loadingDocId === doc.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 disabled:opacity-50 transition-colors cursor-pointer"
                          title={loadingDocId === doc.id ? (t.downloading || "Letöltés...") : t.download}
                        >
                          {loadingDocId === doc.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-[#1E3A8A]" />
                          )}
                          <span>
                            {loadingDocId === doc.id ? (t.downloading || "Letöltés...") : t.download}
                          </span>
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditDocModal(doc)}
                              className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-[#1E3A8A] transition-colors cursor-pointer"
                              title={t.context_edit || "Szerkesztés / Fájlcsere"}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => openMoveModal(doc)}
                              className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-amber-600 transition-colors cursor-pointer"
                              title={t.move_doc_modal_title || "Áthelyezés mappába"}
                            >
                              <Move className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenDeleteDocConfirm(doc.id)}
                              className="p-1.5 rounded-xl border border-gray-200 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                              title={t.delete || "Törlés"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT-CLICK CONTEXT MENU                                        */}
      {/* ============================================================== */}
      {contextMenu.isOpen && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 bg-white rounded-2xl border border-gray-200 shadow-xl py-1.5 min-w-[200px] animate-fadeIn text-xs"
        >
          {/* 1. Folder Context Menu */}
          {contextMenu.type === 'folder' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setCurrentFolderId(contextMenu.item.id);
                  setContextMenu(prev => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <span>{t.context_open_folder || "Mappa megnyitása"}</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      openRenameFolderModal(contextMenu.item);
                      setContextMenu(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-blue-600" />
                    <span>{t.context_rename || "Átnevezés"}</span>
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    type="button"
                    onClick={() => {
                      setFolderToDelete(contextMenu.item);
                      setContextMenu(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-red-50 text-red-600 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t.context_delete || "Törlés (Del)"}</span>
                  </button>
                </>
              )}
            </>
          )}

          {/* 2. Document Context Menu */}
          {contextMenu.type === 'doc' && (
            <>
              <button
                type="button"
                onClick={() => {
                  handleDownload(contextMenu.item);
                  setContextMenu(prev => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>{t.context_download || "Letöltés"}</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      openEditDocModal(contextMenu.item);
                      setContextMenu(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-blue-600" />
                    <span>{t.context_edit || "Szerkesztés / Fájlcsere"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      openMoveModal(contextMenu.item);
                      setContextMenu(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <Move className="w-4 h-4 text-amber-500" />
                    <span>{t.context_move || "Áthelyezés mappába..."}</span>
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    type="button"
                    onClick={() => {
                      onOpenDeleteDocConfirm(contextMenu.item.id);
                      setContextMenu(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-red-50 text-red-600 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t.context_delete || "Törlés (Del)"}</span>
                  </button>
                </>
              )}
            </>
          )}

          {/* 3. Background Context Menu (Admin only) */}
          {contextMenu.type === 'background' && (
            <>
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      openCreateFolderModal();
                      setContextMenu(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4 text-amber-500" />
                    <span>{t.context_new_folder || "Új mappa létrehozása"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadOpen(true);
                      setContextMenu(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-gray-800 font-semibold cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4 text-[#1E3A8A]" />
                    <span>{t.context_upload_doc || "Új dokumentum feltöltése"}</span>
                  </button>
                </>
              ) : (
                <div className="px-3 py-2 text-gray-400 text-xs">
                  {t.documents_title}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* CREATE / RENAME FOLDER MODAL                                   */}
      {/* ============================================================== */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-gray-900 font-display">
                  {editingFolder ? (t.rename_folder_title || "Mappa átnevezése") : (t.create_folder_modal_title || "Új mappa létrehozása")}
                </h3>
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
                  {t.folder_name_label || "Mappa neve"} *
                </label>
                <input
                  type="text"
                  value={folderModalName}
                  onChange={(e) => setFolderModalName(e.target.value)}
                  placeholder={t.folder_name_placeholder || "pl. 2026. Évi Közgyűlések"}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  {t.folder_color_label || "Mappa színe"}
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
                  {t.cancel || "Mégse"}
                </button>
                <button
                  type="submit"
                  disabled={!folderModalName.trim()}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer shadow-xs ${
                    !folderModalName.trim()
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[#1E3A8A] hover:bg-[#1e40af]'
                  }`}
                >
                  {editingFolder ? (t.save_changes_btn || "Mentés") : (t.save_folder_btn || "Mappa mentése")}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-gray-900 font-display">
                  {t.edit_doc_modal_title || "Dokumentum szerkesztése és fájlcsere"}
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
                  {t.doc_title_label || "Dokumentum megnevezése"} *
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
                    {t.doc_filename_label || "Fájlnév"}
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
                    {t.doc_folder_label || "Mappa kiválasztása"}
                  </label>
                  <select
                    value={editDocFolderId || ''}
                    onChange={(e) => setEditDocFolderId(e.target.value || null)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A] cursor-pointer"
                  >
                    <option value="">🏠 {t.no_folder_root || "Főkönyvtár (Nincs mappa)"}</option>
                    {allFolders.map(f => (
                      <option key={f.id} value={f.id}>📁 {f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* File Replacement Section */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  {t.replace_file_label || "Fájl megváltoztatása / cseréje (opcionális)"}
                </label>

                {editReplacementFile ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="min-w-0 text-xs">
                        <div className="font-bold text-gray-900 truncate">{editReplacementFile.name}</div>
                        <div className="text-[11px] text-emerald-700">{editReplacementFile.size} • Új verzió</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditReplacementFile(null);
                        if (editFileInputRef.current) editFileInputRef.current.value = '';
                      }}
                      className="text-xs text-red-600 hover:underline font-bold shrink-0 ml-2"
                    >
                      {t.cancel || "Mégse"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="min-w-0 text-xs">
                        <div className="font-bold text-gray-700 truncate">{editingDoc.fileName}</div>
                        <div className="text-[11px] text-gray-400">{editingDoc.fileSize} • Jelenlegi fájl</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="px-3 py-1 bg-white border border-gray-200 hover:bg-gray-100 text-[#1E3A8A] font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                    >
                      {t.choose_different_file || "Fájl cseréje"}
                    </button>
                  </div>
                )}

                <input
                  ref={editFileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc"
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
                  {t.cancel || "Mégse"}
                </button>
                <button
                  type="submit"
                  disabled={!editDocTitle.trim()}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer shadow-xs ${
                    !editDocTitle.trim()
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[#1E3A8A] hover:bg-[#1e40af]'
                  }`}
                >
                  {t.save_changes_btn || "Módosítások mentése"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* QUICK MOVE DOCUMENT MODAL                                      */}
      {/* ============================================================== */}
      {isMoveModalOpen && docToMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Move className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-display">
                    {t.move_doc_modal_title || "Áthelyezés mappába"}
                  </h3>
                  <span className="text-xs text-gray-500 truncate block max-w-[200px]">
                    {docToMove.title}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoveModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto py-1">
              {/* Root destination */}
              <button
                type="button"
                onClick={() => handleMoveTo(null)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  !docToMove.folderId 
                    ? 'border-[#1E3A8A] bg-blue-50/70 text-[#1E3A8A]' 
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Folder className="w-4 h-4" />
                  <span>🏠 {t.root_folder_breadcrumb || "Főkönyvtár"}</span>
                </div>
                {!docToMove.folderId && <Check className="w-4 h-4 text-[#1E3A8A]" />}
              </button>

              {/* Folders list */}
              {allFolders.map(f => {
                const isCurrent = docToMove.folderId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleMoveTo(f.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isCurrent 
                        ? 'border-[#1E3A8A] bg-blue-50/70 text-[#1E3A8A]' 
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Folder className="w-4 h-4 text-amber-500" />
                      <span className="truncate max-w-[200px]">{f.name}</span>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-[#1E3A8A]" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsMoveModalOpen(false)}
                className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                {t.cancel || "Mégse"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DELETE FOLDER CONFIRMATION MODAL                               */}
      {/* ============================================================== */}
      <DeleteFolderConfirmModal
        isOpen={Boolean(folderToDelete)}
        folder={folderToDelete}
        onClose={() => setFolderToDelete(null)}
        onConfirm={(folderId) => {
          deleteDocFolder(folderId);
          if (currentFolderId === folderId) {
            setCurrentFolderId(null);
          }
          setSelectedItem(null);
        }}
      />
    </div>
  );
}
