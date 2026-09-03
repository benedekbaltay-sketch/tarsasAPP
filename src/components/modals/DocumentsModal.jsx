import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  FolderOpen, 
  ArrowLeft, 
  Search, 
  Upload, 
  Download, 
  Trash2, 
  FileText, 
  File, 
  X,
  UploadCloud,
  ChevronDown
} from 'lucide-react';

export function DocumentsModal({ isOpen, onClose, onOpenDeleteDocConfirm }) {
  const { state, t, uploadDocument } = useApp();
  const { documents, currentUser, currentLang } = state;
  const isEn = currentLang === 'en';
  const isAdmin = currentUser?.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [fileType, setFileType] = useState('pdf');

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setFileSize((file.size / (1024 * 1024)).toFixed(1) + " MB");
    const ext = file.name.split('.').pop().toLowerCase();
    setFileType(ext || 'pdf');

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
      fileData: fileData || null
    });

    setDocTitle('');
    setFileData(null);
    setFileName('');
    setIsUploadOpen(false);
  };

  const handleDownload = (doc) => {
    if (doc.fileData) {
      const a = document.createElement('a');
      a.href = doc.fileData;
      a.download = doc.fileName || `${doc.title}.${doc.fileType || 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // Create fallback placeholder blob
      const content = `Társasház Dokumentum: ${doc.title}\nFájlnév: ${doc.fileName}\nDátum: ${doc.uploadDate}\n\nEz a dokumentum a Társasházkezelő portál hivatalos archívumának része.`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.fileName || doc.title}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  const filteredDocs = (documents || []).filter(d => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (d.title && d.title.toLowerCase().includes(q)) ||
      (d.fileName && d.fileName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#F3F4F6] flex flex-col animate-fadeIn">
      {/* Sticky Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
            title="Vissza"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-display">
                {t.documents_title}
              </h2>
              <span className="text-xs text-gray-500">
                {isEn ? "Condominium Repository" : "Társasházi Irattár"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5 max-w-4xl mx-auto w-full">
        
        {/* Admin Upload Section */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div
              onClick={() => setIsUploadOpen(!isUploadOpen)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-2.5">
                <UploadCloud className="w-5 h-5 text-[#1E3A8A]" />
                <h4 className="text-sm font-bold text-gray-900">{t.upload_document}</h4>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isUploadOpen ? 'rotate-180' : ''}`} />
            </div>

            {isUploadOpen && (
              <form onSubmit={handleUploadSubmit} className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">{t.doc_title_label}</label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="pl. 2026. Évi költségvetési beszámoló"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">{t.doc_file_label}</label>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    {t.doc_upload_btn}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search_docs_placeholder}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A] shadow-xs"
          />
        </div>

        {/* Documents List */}
        <div className="space-y-3">
          {filteredDocs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              {t.no_docs_found}
            </div>
          ) : (
            filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex items-center justify-between gap-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 truncate">
                      {doc.title}
                    </h4>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      <span>{doc.fileName}</span>
                      <span>&bull;</span>
                      <span>{doc.fileSize}</span>
                      <span>&bull;</span>
                      <span>{doc.uploadDate}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700"
                    title={t.download}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t.download}</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => onOpenDeleteDocConfirm(doc.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                      title={t.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
