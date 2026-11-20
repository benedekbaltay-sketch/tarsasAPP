import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Download,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  FileImage,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  loadDocumentBytes,
  createSafePdfBlobUrl,
  parseXlsxPreviewSheets,
  extractDocxParagraphs,
  isPreviewableImageExt,
  isSafePreviewImageSource,
  getExcelColumnLetter,
} from '../../utils/docPreview';
import { getDocumentTypeLabel } from '../../utils/docExplorer';

export function DocumentPreviewModal({ doc, isOpen, onClose, onDownload }) {
  const { state, t, fetchDocumentFile } = useApp();
  const isEn = state.currentLang === 'en';

  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'unsupported' | 'error'
  const [previewKind, setPreviewKind] = useState(null); // 'pdf' | 'image' | 'xlsx' | 'docx'
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [xlsxSheets, setXlsxSheets] = useState([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [docxParagraphs, setDocxParagraphs] = useState([]);

  const blobUrlRef = useRef(null);

  const revokeCurrentBlob = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  // Escape closes only the preview modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !doc) {
      revokeCurrentBlob();
      setStatus('idle');
      setPreviewKind(null);
      setPdfBlobUrl(null);
      setImageSrc(null);
      setImageZoom(1);
      setXlsxSheets([]);
      setActiveSheetIdx(0);
      setDocxParagraphs([]);
      return;
    }

    let cancelled = false;
    revokeCurrentBlob();
    setStatus('loading');
    setPreviewKind(null);
    setPdfBlobUrl(null);
    setImageSrc(null);
    setImageZoom(1);
    setXlsxSheets([]);
    setActiveSheetIdx(0);
    setDocxParagraphs([]);

    const loadPreview = async () => {
      try {
        let rawSource = doc.fileData;
        if (!rawSource && doc.id) {
          rawSource = await fetchDocumentFile(doc.id);
        }
        if (cancelled) return;

        if (!rawSource) {
          setStatus('error');
          return;
        }

        const ext = String(doc.fileType || '').toLowerCase().trim() ||
          String(doc.fileName || '').split('.').pop()?.toLowerCase() || '';

        // 1. Safe Raster Image preview (JPG / PNG / WEBP)
        if (isPreviewableImageExt(ext)) {
          if (!isSafePreviewImageSource(rawSource, doc.fileName || '')) {
            setStatus('error');
            return;
          }
          setImageSrc(rawSource);
          setPreviewKind('image');
          setStatus('ready');
          return;
        }

        // 2. PDF preview via strictly validated blob: iframe URL (CSP-safe)
        if (ext === 'pdf') {
          const bytes = await loadDocumentBytes(rawSource);
          if (cancelled) return;
          const url = createSafePdfBlobUrl(bytes);
          if (!url) {
            setStatus('error');
            return;
          }
          blobUrlRef.current = url;
          setPdfBlobUrl(url);
          setPreviewKind('pdf');
          setStatus('ready');
          return;
        }

        // 3. Excel (.xlsx) multi-sheet spreadsheet preview
        if (ext === 'xlsx') {
          const bytes = await loadDocumentBytes(rawSource);
          if (cancelled) return;
          const sheets = await parseXlsxPreviewSheets(bytes);
          if (cancelled) return;
          if (!sheets || sheets.length === 0) {
            setStatus('unsupported');
            return;
          }
          setXlsxSheets(sheets);
          setActiveSheetIdx(0);
          setPreviewKind('xlsx');
          setStatus('ready');
          return;
        }

        // 4. Word (.docx) safe text preview
        if (ext === 'docx') {
          const bytes = await loadDocumentBytes(rawSource);
          if (cancelled) return;
          const paragraphs = await extractDocxParagraphs(bytes);
          if (cancelled) return;
          if (!paragraphs) {
            setStatus('unsupported');
            return;
          }
          setDocxParagraphs(paragraphs);
          setPreviewKind('docx');
          setStatus('ready');
          return;
        }

        // 5. Legacy binary formats (.doc, .xls) or other unsupported formats
        setStatus('unsupported');
      } catch (err) {
        console.warn('Document preview error:', err?.message || err);
        if (!cancelled) setStatus('error');
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
      revokeCurrentBlob();
    };
  }, [isOpen, doc, fetchDocumentFile]);

  if (!isOpen || !doc) return null;

  const ext = String(doc.fileType || '').toLowerCase().trim();
  const activeSheet = xlsxSheets[activeSheetIdx] || null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/75 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview Top Header Bar */}
        <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center shrink-0">
              {ext === 'xlsx' || ext === 'xls' ? (
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              ) : isPreviewableImageExt(ext) ? (
                <FileImage className="w-5 h-5 text-purple-600" />
              ) : (
                <FileText className="w-5 h-5 text-[#1E3A8A]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate font-display">
                  {doc.title || doc.fileName}
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#1E3A8A] text-[10px] font-bold shrink-0">
                  <Eye className="w-3 h-3" />
                  {t.explorer_preview_badge || (isEn ? 'Preview' : 'Előnézet')}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 truncate">
                {doc.fileName}
                {doc.fileSize ? ` • ${doc.fileSize}` : ''}
                {doc.uploadDate ? ` • ${doc.uploadDate}` : ''}
              </div>
            </div>
          </div>

          {/* Right controls: Image zoom + Download + Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            {status === 'ready' && previewKind === 'image' && (
              <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-xl p-0.5 mr-1">
                <button
                  type="button"
                  onClick={() => setImageZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  className="p-1.5 rounded-lg hover:bg-white text-gray-700 cursor-pointer"
                  title={isEn ? 'Zoom out' : 'Kicsinyítés'}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-bold text-gray-700 w-10 text-center tabular-nums">
                  {Math.round(imageZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setImageZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                  className="p-1.5 rounded-lg hover:bg-white text-gray-700 cursor-pointer"
                  title={isEn ? 'Zoom in' : 'Nagyítás'}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                {imageZoom !== 1 && (
                  <button
                    type="button"
                    onClick={() => setImageZoom(1)}
                    className="p-1.5 rounded-lg hover:bg-white text-gray-700 cursor-pointer"
                    title={isEn ? 'Reset zoom' : 'Eredeti méret'}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => onDownload(doc)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
              title={t.download || (isEn ? 'Download' : 'Letöltés')}
            >
              <Download className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span className="hidden sm:inline">{t.download || (isEn ? 'Download' : 'Letöltés')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              title={t.close || (isEn ? 'Close (Esc)' : 'Bezárás (Esc)')}
              aria-label={t.close || (isEn ? 'Close' : 'Bezárás')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview Viewport */}
        <div className="flex-1 min-h-0 bg-slate-100 relative overflow-hidden flex flex-col">
          {status === 'loading' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
              <RefreshCw className="w-7 h-7 animate-spin text-[#1E3A8A]" />
              <span className="text-xs font-semibold">
                {t.explorer_preview_loading || (isEn ? 'Loading document preview...' : 'Dokumentum előnézet betöltése...')}
              </span>
            </div>
          )}

          {status === 'ready' && previewKind === 'pdf' && pdfBlobUrl && (
            <iframe
              src={pdfBlobUrl}
              title={doc.title || doc.fileName}
              className="w-full h-full border-0 bg-slate-200"
            />
          )}

          {status === 'ready' && previewKind === 'image' && imageSrc && (
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-6">
              <img
                src={imageSrc}
                alt={doc.title || doc.fileName}
                style={{
                  transform: `scale(${imageZoom})`,
                  transformOrigin: 'center center',
                }}
                className="max-w-full max-h-full object-contain rounded-xl shadow-md bg-white transition-transform duration-150"
              />
            </div>
          )}

          {status === 'ready' && previewKind === 'xlsx' && activeSheet && (
            <div className="flex-1 min-h-0 flex flex-col bg-white">
              {/* Sheet Tabs */}
              {xlsxSheets.length > 1 && (
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-1.5 overflow-x-auto shrink-0">
                  {xlsxSheets.map((s, idx) => (
                    <button
                      key={`${s.name}-${idx}`}
                      type="button"
                      onClick={() => setActiveSheetIdx(idx)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                        idx === activeSheetIdx
                          ? 'bg-[#1E3A8A] text-white shadow-2xs'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Scrollable Spreadsheet Grid */}
              <div className="flex-1 overflow-auto">
                {activeSheet.rows.length === 0 ? (
                  <div className="p-10 text-center text-xs text-gray-400">
                    {isEn ? 'This worksheet is empty.' : 'Ez a munkalap üres.'}
                  </div>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-gray-100 text-gray-600">
                      <tr>
                        <th className="border border-gray-200 px-2 py-1.5 text-center font-bold w-10 bg-gray-100 text-[10px]">
                          #
                        </th>
                        {Array.from({ length: activeSheet.colCount }).map((_, cIdx) => (
                          <th
                            key={cIdx}
                            className="border border-gray-200 px-2.5 py-1.5 text-left font-bold whitespace-nowrap bg-gray-100 text-[11px]"
                          >
                            {getExcelColumnLetter(cIdx)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeSheet.rows.map((row, rIdx) => (
                        <tr key={rIdx} className={rIdx === 0 ? 'bg-blue-50/40 font-semibold' : 'hover:bg-slate-50'}>
                          <td className="border border-gray-200 px-2 py-1 text-center text-[10px] font-semibold text-gray-400 bg-gray-50 tabular-nums">
                            {rIdx + 1}
                          </td>
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="border border-gray-200 px-2.5 py-1.5 text-gray-800 whitespace-pre-wrap max-w-xs break-words"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {activeSheet.truncatedRows && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-[11px] text-amber-800 font-medium shrink-0">
                  {isEn
                    ? `Showing first ${activeSheet.rows.length} of ${activeSheet.totalRowCount} rows. Download the file to view the full spreadsheet.`
                    : `Az első ${activeSheet.rows.length} sor látható az összesen ${activeSheet.totalRowCount} sorból. A teljes táblázathoz töltsd le a fájlt.`}
                </div>
              )}
            </div>
          )}

          {status === 'ready' && previewKind === 'docx' && (
            <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-full max-w-3xl p-6 sm:p-10 space-y-3 h-fit select-text">
                {docxParagraphs.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">
                    {isEn ? 'No readable text paragraphs found in this document.' : 'Nem található megjeleníthető szöveges tartalom ebben a dokumentumban.'}
                  </p>
                ) : (
                  docxParagraphs.map((para, idx) => (
                    <p
                      key={idx}
                      className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words"
                    >
                      {para}
                    </p>
                  ))
                )}
              </div>
            </div>
          )}

          {(status === 'unsupported' || status === 'error') && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    {status === 'unsupported'
                      ? t.explorer_preview_unsupported_title ||
                        (isEn ? 'Inline preview is not available for this file format' : 'Ehhez a fájlformátumhoz nem érhető el közvetlen előnézet')
                      : t.explorer_preview_error_title ||
                        (isEn ? 'Could not load document preview' : 'Nem sikerült betölteni a dokumentum előnézetét')}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    {getDocumentTypeLabel(doc.fileType, isEn)} • {doc.fileName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDownload(doc)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.download || (isEn ? 'Download' : 'Letöltés')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
