import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFolderAncestors,
  getFolderDescendantIds,
  isDescendantFolder,
  buildHierarchicalFolderList,
  getUniqueCopyName,
  getUniqueCopyFileName,
  planExplorerMove,
  planExplorerDelete,
  planFolderTreeCopy,
  getDocumentTypeLabel,
} from '../src/utils/docExplorer.js';
import {
  dataUrlToUint8Array,
  createSafePdfBlobUrl,
  extractParagraphsFromWordXml,
  getExcelColumnLetter,
  isSafePreviewImageSource,
  parseXlsxPreviewSheets,
} from '../src/utils/docPreview.js';
import writeXlsxFile from 'write-excel-file/universal';

const SAMPLE_FOLDERS = [
  { id: 'f-2026', name: '2026', parentId: null, color: 'amber', createdAt: '2026-01-01' },
  { id: 'f-assy', name: 'Közgyűlések', parentId: 'f-2026', color: 'blue', createdAt: '2026-02-01' },
  { id: 'f-min', name: 'Jegyzőkönyvek', parentId: 'f-assy', color: 'emerald', createdAt: '2026-03-01' },
  { id: 'f-inv', name: 'Számlák', parentId: null, color: 'slate', createdAt: '2026-01-10' },
];

const SAMPLE_DOCS = [
  { id: 'd-1', title: 'Alapító Okirat', fileName: 'alapito.pdf', fileType: 'pdf', folderId: null, hasFile: true },
  { id: 'd-2', title: 'Tavaszi Jegyzőkönyv', fileName: 'tavasz.pdf', fileType: 'pdf', folderId: 'f-min', hasFile: true },
  { id: 'd-3', title: 'Költségvetés', fileName: 'koltsegvetes.xlsx', fileType: 'xlsx', folderId: 'f-assy', hasFile: true },
  { id: 'd-4', title: 'Vízszámla', fileName: 'viz.pdf', fileType: 'pdf', folderId: 'f-inv', hasFile: false },
];

test('Nested folder breadcrumbs, descendant discovery & hierarchical paths', () => {
  const chain = getFolderAncestors(SAMPLE_FOLDERS, 'f-min');
  assert.deepEqual(
    chain.map((f) => f.id),
    ['f-2026', 'f-assy', 'f-min']
  );

  const descendants = getFolderDescendantIds(SAMPLE_FOLDERS, 'f-2026');
  assert.deepEqual(Array.from(descendants).sort(), ['f-2026', 'f-assy', 'f-min']);

  assert.equal(isDescendantFolder(SAMPLE_FOLDERS, 'f-min', 'f-2026'), true);
  assert.equal(isDescendantFolder(SAMPLE_FOLDERS, 'f-2026', 'f-2026'), true);
  assert.equal(isDescendantFolder(SAMPLE_FOLDERS, 'f-inv', 'f-2026'), false);
  assert.equal(isDescendantFolder(SAMPLE_FOLDERS, null, 'f-2026'), false);

  const treeList = buildHierarchicalFolderList(SAMPLE_FOLDERS, new Set(['f-assy']));
  assert.deepEqual(
    treeList.map((entry) => ({ id: entry.folder.id, depth: entry.depth, path: entry.pathLabel })),
    [
      { id: 'f-2026', depth: 0, path: '2026' },
      { id: 'f-inv', depth: 0, path: 'Számlák' },
    ]
  );
});

test('Cycle-safe drag & drop move of documents and nested folders', () => {
  // Moving d-1 and f-inv into f-min succeeds
  const okMove = planExplorerMove({
    folders: SAMPLE_FOLDERS,
    docs: SAMPLE_DOCS,
    folderIds: ['f-inv'],
    docIds: ['d-1'],
    targetFolderId: 'f-min',
  });
  assert.equal(okMove.movedCount, 2);
  assert.equal(okMove.skippedCyclicCount, 0);
  assert.equal(okMove.updatedFolders.find((f) => f.id === 'f-inv').parentId, 'f-min');
  assert.equal(okMove.updatedDocs.find((d) => d.id === 'd-1').folderId, 'f-min');

  // Moving f-2026 into its own grandchild f-min is strictly blocked!
  const cyclicMove = planExplorerMove({
    folders: SAMPLE_FOLDERS,
    docs: SAMPLE_DOCS,
    folderIds: ['f-2026'],
    docIds: ['d-4'],
    targetFolderId: 'f-min',
  });
  assert.equal(cyclicMove.skippedCyclicCount, 1);
  assert.equal(cyclicMove.movedCount, 1); // d-4 moved, f-2026 skipped
  assert.equal(cyclicMove.updatedFolders.find((f) => f.id === 'f-2026').parentId, null);
  assert.equal(cyclicMove.updatedDocs.find((d) => d.id === 'd-4').folderId, 'f-min');
});

test('Ctrl+C / Ctrl+V deep folder tree copy prevents self-paste recursion and generates unique names', () => {
  let counter = 0;
  const idGenerator = (prefix) => `${prefix}-copy-${++counter}`;

  // Copy f-2026 and paste directly INTO its own child f-assy (must NOT recurse infinitely!)
  const selfPaste = planFolderTreeCopy({
    folders: SAMPLE_FOLDERS,
    docs: SAMPLE_DOCS,
    sourceFolderIds: ['f-2026'],
    sourceDocIds: [],
    targetFolderId: 'f-assy',
    isEn: false,
    today: '2026-11-20',
    idGenerator,
  });

  // Should clone exact snapshot: 3 folders (f-2026 -> f-assy -> f-min) and 2 docs (d-3, d-2)
  assert.equal(selfPaste.newFolders.length, 3);
  assert.equal(selfPaste.newDocs.length, 2);
  const topClone = selfPaste.newFolders[0];
  assert.equal(topClone.parentId, 'f-assy');
  assert.equal(topClone.name, '2026'); // No folder named '2026' inside f-assy yet

  // Copy d-1 into the SAME root folder -> must append " - másolat" (HU) or " - Copy" (EN)
  const huCopy = planFolderTreeCopy({
    folders: SAMPLE_FOLDERS,
    docs: SAMPLE_DOCS,
    sourceFolderIds: [],
    sourceDocIds: ['d-1'],
    targetFolderId: null,
    isEn: false,
    today: '2026-11-20',
    idGenerator,
  });
  assert.equal(huCopy.newDocs.length, 1);
  assert.equal(huCopy.newDocs[0].title, 'Alapító Okirat - másolat');
  assert.equal(huCopy.newDocs[0].fileName, 'alapito - másolat.pdf');
  assert.equal(huCopy.newDocs[0]._sourceDocId, 'd-1');

  assert.equal(
    getUniqueCopyName('Report', ['Report', 'Report - Copy'], true),
    'Report - Copy (2)'
  );
  assert.equal(
    getUniqueCopyFileName('budget.xlsx', ['budget.xlsx', 'budget - Copy.xlsx'], true),
    'budget - Copy (2).xlsx'
  );
});

test('Orphan-free deletion of nested folders promotes surviving children to nearest surviving ancestor', () => {
  // Delete middle folder 'f-assy' -> child folder 'f-min' and doc 'd-3' must move up to 'f-2026' (NOT orphaned!)
  const res = planExplorerDelete({
    folders: SAMPLE_FOLDERS,
    docs: SAMPLE_DOCS,
    folderIds: ['f-assy'],
    docIds: ['d-4'],
  });

  assert.equal(res.remainingFolders.some((f) => f.id === 'f-assy'), false);
  assert.equal(res.remainingFolders.find((f) => f.id === 'f-min').parentId, 'f-2026');
  assert.equal(res.remainingDocs.find((d) => d.id === 'd-3').folderId, 'f-2026');
  assert.equal(res.remainingDocs.some((d) => d.id === 'd-4'), false);
  assert.deepEqual(res.deletedDocIds, ['d-4']);

  // Deleting BOTH 'f-2026' and 'f-assy' promotes 'f-min' cleanly to root (null)
  const multiDel = planExplorerDelete({
    folders: SAMPLE_FOLDERS,
    docs: SAMPLE_DOCS,
    folderIds: ['f-2026', 'f-assy'],
    docIds: [],
  });
  assert.equal(multiDel.remainingFolders.find((f) => f.id === 'f-min').parentId, null);
  assert.equal(multiDel.remainingDocs.find((d) => d.id === 'd-3').folderId, null);
});

test('Localized Windows-Explorer-style document type labels', () => {
  assert.equal(getDocumentTypeLabel('pdf', false), 'PDF dokumentum');
  assert.equal(getDocumentTypeLabel('pdf', true), 'PDF Document');
  assert.equal(getDocumentTypeLabel('xlsx', false), 'Excel táblázat');
  assert.equal(getDocumentTypeLabel('png', true), 'PNG Image');
});

test('In-app document preview enforces magic bytes, blocks SVG/HTML, and parses XLSX & DOCX safely', async () => {
  // Base64 decoding & PDF magic byte validation
  const fakeHtmlAsPdf = dataUrlToUint8Array(
    `data:application/pdf;base64,${Buffer.from('<html><script>alert(1)</script></html>').toString('base64')}`
  );
  assert.equal(createSafePdfBlobUrl(fakeHtmlAsPdf), null);

  const realPdf = dataUrlToUint8Array(
    `data:application/pdf;base64,${Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj').toString('base64')}`
  );
  const blobUrl = createSafePdfBlobUrl(realPdf);
  assert.equal(typeof blobUrl, 'string');
  assert.ok(blobUrl.startsWith('blob:'));
  URL.revokeObjectURL(blobUrl);

  // Image preview blocks SVG XSS payloads while allowing safe PNG Data URLs
  assert.equal(isSafePreviewImageSource('data:image/svg+xml;base64,PHN2Zz4=', 'evil.svg'), false);
  assert.equal(isSafePreviewImageSource('data:image/png;base64,iVBORw0KGgo=', 'photo.png'), true);

  // Excel column letters
  assert.equal(getExcelColumnLetter(0), 'A');
  assert.equal(getExcelColumnLetter(25), 'Z');
  assert.equal(getExcelColumnLetter(26), 'AA');

  // DOCX Word XML paragraph extraction
  const paragraphs = extractParagraphsFromWordXml(
    `<w:document><w:body>
      <w:p><w:r><w:t>Közgyűlési </w:t></w:r><w:r><w:t>jegyzőkönyv &amp; határozat</w:t></w:r></w:p>
      <w:p><w:r><w:t>1. napirendi pont</w:t></w:r></w:p>
    </w:body></w:document>`
  );
  assert.deepEqual(paragraphs, ['Közgyűlési jegyzőkönyv & határozat', '1. napirendi pont']);

  // Live XLSX buffer preview parsing via read-excel-file/universal
  const xlsxBlob = await writeXlsxFile(
    [
      [{ value: 'Lakás', type: String }, { value: 'Egyenleg', type: String }],
      [{ value: '1. lakás', type: String }, { value: 15000, type: Number }],
    ],
    { sheet: 'Elszámolás' }
  ).toBlob();
  const xlsxBuf = await xlsxBlob.arrayBuffer();
  const sheets = await parseXlsxPreviewSheets(new Uint8Array(xlsxBuf));
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].name, 'Elszámolás');
  assert.deepEqual(sheets[0].rows[0], ['Lakás', 'Egyenleg']);
  assert.deepEqual(sheets[0].rows[1], ['1. lakás', '15000']);
});
