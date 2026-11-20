/**
 * Pure helper utilities for the Windows-Explorer-style Documents & Nested Folder Manager.
 *
 * Handles:
 * - Multi-level nested folder hierarchies (breadcrumbs, descendants, cycle guards)
 * - Hierarchical folder path building for selectors & move dialogs
 * - Cycle-safe batch moving of documents and folders
 * - Deep recursive cloning for Ctrl+C / Ctrl+V clipboard copy/paste (including self-paste safety)
 * - Orphan-free deletion of folders (re-parenting surviving children to nearest surviving ancestor)
 * - Windows-style copy naming & localized file type labels
 */

export function makeSelectionKey(type, id) {
  return `${type}:${id}`;
}

export function parseSelectionKey(key) {
  if (typeof key !== 'string') return null;
  const idx = key.indexOf(':');
  if (idx <= 0) return null;
  const type = key.slice(0, idx);
  const id = key.slice(idx + 1);
  if ((type !== 'folder' && type !== 'doc') || !id) return null;
  return { type, id };
}

/**
 * Returns the ordered ancestor chain from top-level folder down to `folderId` (inclusive).
 * Uses a visited set to stay 100% safe even if legacy data ever contained a cycle.
 */
export function getFolderAncestors(folders = [], folderId) {
  if (!folderId) return [];
  const byId = new Map((folders || []).map((f) => [f.id, f]));
  const chain = [];
  const visited = new Set();
  let cursor = byId.get(folderId);

  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : null;
  }

  return chain;
}

/**
 * Returns a Set containing `folderId` and every recursive descendant folder ID.
 */
export function getFolderDescendantIds(folders = [], folderId) {
  const result = new Set();
  if (!folderId) return result;
  result.add(folderId);

  const byParent = new Map();
  for (const f of folders || []) {
    const pid = f.parentId || null;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(f.id);
  }

  const queue = [folderId];
  while (queue.length > 0) {
    const current = queue.shift();
    const children = byParent.get(current) || [];
    for (const childId of children) {
      if (!result.has(childId)) {
        result.add(childId);
        queue.push(childId);
      }
    }
  }

  return result;
}

/**
 * Returns true if `candidateTargetId` is `folderId` itself or a descendant of `folderId`.
 * Moving `folderId` into `candidateTargetId` would create a cycle and must be blocked.
 */
export function isDescendantFolder(folders = [], candidateTargetId, folderId) {
  if (!candidateTargetId || !folderId) return false;
  return getFolderDescendantIds(folders, folderId).has(candidateTargetId);
}

/**
 * Finds the nearest ancestor of `folderId` that is NOT in `deletedFolderIds` (or null for root).
 */
export function getNearestSurvivingParent(folders = [], folderId, deletedFolderIds = new Set()) {
  const byId = new Map((folders || []).map((f) => [f.id, f]));
  const visited = new Set();
  let cursorId = folderId ? (byId.get(folderId)?.parentId || null) : null;

  while (cursorId && !visited.has(cursorId)) {
    visited.add(cursorId);
    if (!deletedFolderIds.has(cursorId) && byId.has(cursorId)) {
      return cursorId;
    }
    cursorId = byId.get(cursorId)?.parentId || null;
  }

  return null;
}

/**
 * Returns direct child folders of `parentId` (null = root), naturally sorted by name.
 */
export function getDirectChildFolders(folders = [], parentId = null) {
  const targetParent = parentId || null;
  return (folders || [])
    .filter((f) => (f.parentId || null) === targetParent)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'hu', { numeric: true }));
}

/**
 * Counts direct child folders and direct documents inside a folder.
 */
export function getFolderDirectItemCounts(folders = [], docs = [], folderId) {
  const directFolders = (folders || []).filter((f) => (f.parentId || null) === folderId).length;
  const directDocs = (docs || []).filter((d) => (d.folderId || null) === folderId).length;
  return {
    directFolders,
    directDocs,
    total: directFolders + directDocs,
  };
}

/**
 * Builds a flat depth-annotated list of folders for dropdown selectors and move dialogs.
 * Excludes any folder IDs present in `excludeIds` (and their descendants automatically).
 */
export function buildHierarchicalFolderList(folders = [], excludeIds = new Set()) {
  const safeFolders = Array.isArray(folders) ? folders : [];
  const validIds = new Set(safeFolders.map((f) => f.id));
  const blocked = new Set();

  for (const exId of excludeIds) {
    for (const descId of getFolderDescendantIds(safeFolders, exId)) {
      blocked.add(descId);
    }
  }

  const byParent = new Map();
  for (const f of safeFolders) {
    if (blocked.has(f.id)) continue;
    // Treat folders with dangling/unknown parentId as root so they remain reachable
    const pid = f.parentId && validIds.has(f.parentId) && !blocked.has(f.parentId) ? f.parentId : null;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(f);
  }

  for (const list of byParent.values()) {
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'hu', { numeric: true }));
  }

  const result = [];
  const visited = new Set();

  const walk = (parentId, depth, prefixParts) => {
    const children = byParent.get(parentId) || [];
    for (const folder of children) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      const nextParts = [...prefixParts, folder.name];
      result.push({
        folder,
        depth,
        pathLabel: nextParts.join(' / '),
      });
      walk(folder.id, depth + 1, nextParts);
    }
  };

  walk(null, 0, []);
  return result;
}

/**
 * Generates a unique Windows-style copy name when colliding with existing names in the target folder.
 */
export function getUniqueCopyName(baseName, existingNames = [], isEn = false) {
  const cleanBase = String(baseName || '').trim() || (isEn ? 'Untitled' : 'Névtelen');
  const existingSet = new Set(existingNames.map((n) => String(n || '').trim().toLowerCase()));

  if (!existingSet.has(cleanBase.toLowerCase())) {
    return cleanBase;
  }

  const suffix = isEn ? ' - Copy' : ' - másolat';
  let candidate = `${cleanBase}${suffix}`;
  if (!existingSet.has(candidate.toLowerCase())) {
    return candidate;
  }

  let counter = 2;
  while (existingSet.has(`${cleanBase}${suffix} (${counter})`.toLowerCase())) {
    counter += 1;
  }
  return `${cleanBase}${suffix} (${counter})`;
}

/**
 * Generates a unique copy filename while keeping the file extension intact.
 */
export function getUniqueCopyFileName(fileName, existingFileNames = [], isEn = false) {
  const clean = String(fileName || '').trim();
  if (!clean) return isEn ? 'document.pdf' : 'dokumentum.pdf';

  const existingSet = new Set(existingFileNames.map((n) => String(n || '').trim().toLowerCase()));
  if (!existingSet.has(clean.toLowerCase())) {
    return clean;
  }

  const dotIdx = clean.lastIndexOf('.');
  const hasExt = dotIdx > 0 && dotIdx < clean.length - 1;
  const stem = hasExt ? clean.slice(0, dotIdx) : clean;
  const ext = hasExt ? clean.slice(dotIdx) : '';
  const suffix = isEn ? ' - Copy' : ' - másolat';

  let candidate = `${stem}${suffix}${ext}`;
  if (!existingSet.has(candidate.toLowerCase())) {
    return candidate;
  }

  let counter = 2;
  while (existingSet.has(`${stem}${suffix} (${counter})${ext}`.toLowerCase())) {
    counter += 1;
  }
  return `${stem}${suffix} (${counter})${ext}`;
}

/**
 * Plans a cycle-safe batch move of documents and folders into `targetFolderId` (null = root).
 */
export function planExplorerMove({ folders = [], docs = [], folderIds = [], docIds = [], targetFolderId = null }) {
  const target = targetFolderId || null;
  const folderIdSet = new Set(folderIds || []);
  const docIdSet = new Set(docIds || []);

  // Validate which folders can legally be moved into `target`
  const movableFolderIds = new Set();
  let skippedCyclicCount = 0;

  for (const fId of folderIdSet) {
    const existing = folders.find((f) => f.id === fId);
    if (!existing) continue;
    if (isDescendantFolder(folders, target, fId)) {
      skippedCyclicCount += 1;
      continue;
    }
    if ((existing.parentId || null) !== target) {
      movableFolderIds.add(fId);
    }
  }

  let movedCount = 0;

  const updatedFolders = folders.map((f) => {
    if (movableFolderIds.has(f.id)) {
      movedCount += 1;
      return { ...f, parentId: target };
    }
    return f;
  });

  const updatedDocs = docs.map((d) => {
    if (docIdSet.has(d.id) && (d.folderId || null) !== target) {
      movedCount += 1;
      return { ...d, folderId: target };
    }
    return d;
  });

  return {
    updatedFolders,
    updatedDocs,
    movedCount,
    skippedCyclicCount,
    movedFolderIds: Array.from(movableFolderIds),
    movedDocIds: docs
      .filter((d) => docIdSet.has(d.id) && (d.folderId || null) !== target)
      .map((d) => d.id),
  };
}

/**
 * Plans a safe deletion of selected folders and documents.
 * Any surviving child folders or surviving documents inside a deleted folder are promoted
 * to the nearest surviving ancestor folder (or root), preventing orphaned records.
 */
export function planExplorerDelete({ folders = [], docs = [], folderIds = [], docIds = [] }) {
  const deleteFolderSet = new Set(folderIds || []);
  const deleteDocSet = new Set(docIds || []);

  const remainingFolders = folders
    .filter((f) => !deleteFolderSet.has(f.id))
    .map((f) => {
      if (f.parentId && deleteFolderSet.has(f.parentId)) {
        return {
          ...f,
          parentId: getNearestSurvivingParent(folders, f.id, deleteFolderSet),
        };
      }
      return f;
    });

  const remainingDocs = docs
    .filter((d) => !deleteDocSet.has(d.id))
    .map((d) => {
      if (d.folderId && deleteFolderSet.has(d.folderId)) {
        return {
          ...d,
          folderId: getNearestSurvivingParent(folders, d.folderId, deleteFolderSet),
        };
      }
      return d;
    });

  return {
    remainingFolders,
    remainingDocs,
    deletedDocIds: docs.filter((d) => deleteDocSet.has(d.id)).map((d) => d.id),
    deletedFolderIds: folders.filter((f) => deleteFolderSet.has(f.id)).map((f) => f.id),
  };
}

/**
 * Plans a deep copy (Ctrl+C / Ctrl+V) of selected folders and documents into `targetFolderId`.
 * Snapshots the original tree before cloning so pasting a folder into itself or a child
 * NEVER triggers infinite recursion.
 */
export function planFolderTreeCopy({
  folders = [],
  docs = [],
  sourceFolderIds = [],
  sourceDocIds = [],
  targetFolderId = null,
  isEn = false,
  today = new Date().toISOString().slice(0, 10),
  idGenerator = null,
}) {
  const target = targetFolderId || null;
  let seq = 0;
  const makeId =
    typeof idGenerator === 'function'
      ? idGenerator
      : (prefix) => `${prefix}-${Date.now()}-${++seq}-${Math.random().toString(36).slice(2, 6)}`;

  const folderById = new Map(folders.map((f) => [f.id, f]));
  const docById = new Map(docs.map((d) => [d.id, d]));

  // Deduplicate: if both a parent folder and one of its descendants were selected,
  // only clone the top-most selected folder (its descendants come along automatically).
  const rawFolderSet = new Set(sourceFolderIds || []);
  const topSelectedFolderIds = (sourceFolderIds || []).filter((fId) => {
    if (!folderById.has(fId)) return false;
    const ancestors = getFolderAncestors(folders, fId);
    // If any strict ancestor is also selected, skip this child at top level
    return !ancestors.some((a) => a.id !== fId && rawFolderSet.has(a.id));
  });

  // Collect all folder IDs covered by topSelectedFolderIds to avoid double-copying selected docs inside them
  const coveredFolderIds = new Set();
  for (const fId of topSelectedFolderIds) {
    for (const dId of getFolderDescendantIds(folders, fId)) {
      coveredFolderIds.add(dId);
    }
  }

  const standaloneDocIds = (sourceDocIds || []).filter((dId) => {
    const doc = docById.get(dId);
    if (!doc) return false;
    return !doc.folderId || !coveredFolderIds.has(doc.folderId);
  });

  const existingFolderNamesInTarget = folders
    .filter((f) => (f.parentId || null) === target)
    .map((f) => f.name);
  const existingDocTitlesInTarget = docs
    .filter((d) => (d.folderId || null) === target)
    .map((d) => d.title);
  const existingDocFileNamesInTarget = docs
    .filter((d) => (d.folderId || null) === target)
    .map((d) => d.fileName);

  const newFolders = [];
  const newDocs = []; // each entry includes `_sourceDocId` so caller can duplicate binary payload

  const cloneFolderRecursive = (srcFolderId, destParentId, isTopLevel, visited) => {
    if (visited.has(srcFolderId)) return;
    const srcFolder = folderById.get(srcFolderId);
    if (!srcFolder) return;

    const nextVisited = new Set(visited);
    nextVisited.add(srcFolderId);

    const newFolderId = makeId('folder');
    let finalName = srcFolder.name;
    if (isTopLevel) {
      finalName = getUniqueCopyName(srcFolder.name, existingFolderNamesInTarget, isEn);
      existingFolderNamesInTarget.push(finalName);
    }

    newFolders.push({
      ...srcFolder,
      id: newFolderId,
      name: finalName,
      parentId: destParentId,
      createdAt: today,
    });

    // Snapshot direct docs of srcFolder from the original `docs` array
    const childDocs = docs.filter((d) => (d.folderId || null) === srcFolderId);
    for (const srcDoc of childDocs) {
      const newDocId = makeId('doc');
      newDocs.push({
        ...srcDoc,
        id: newDocId,
        folderId: newFolderId,
        uploadDate: today,
        fileData: null,
        _sourceDocId: srcDoc.id,
      });
    }

    // Snapshot direct child folders from the original `folders` array
    const childFolders = folders.filter((f) => (f.parentId || null) === srcFolderId);
    for (const childF of childFolders) {
      cloneFolderRecursive(childF.id, newFolderId, false, nextVisited);
    }
  };

  for (const fId of topSelectedFolderIds) {
    cloneFolderRecursive(fId, target, true, new Set());
  }

  for (const dId of standaloneDocIds) {
    const srcDoc = docById.get(dId);
    if (!srcDoc) continue;
    const newDocId = makeId('doc');
    const newTitle = getUniqueCopyName(srcDoc.title || srcDoc.fileName, existingDocTitlesInTarget, isEn);
    existingDocTitlesInTarget.push(newTitle);
    const newFileName = getUniqueCopyFileName(srcDoc.fileName || `${newTitle}.${srcDoc.fileType || 'pdf'}`, existingDocFileNamesInTarget, isEn);
    existingDocFileNamesInTarget.push(newFileName);

    newDocs.push({
      ...srcDoc,
      id: newDocId,
      title: newTitle,
      fileName: newFileName,
      folderId: target,
      uploadDate: today,
      fileData: null,
      _sourceDocId: srcDoc.id,
    });
  }

  return { newFolders, newDocs };
}

/**
 * Returns a localized Windows-Explorer-style type label for a document extension.
 */
export function getDocumentTypeLabel(fileType, isEn = false) {
  const ext = String(fileType || '').toLowerCase().trim();
  switch (ext) {
    case 'pdf':
      return isEn ? 'PDF Document' : 'PDF dokumentum';
    case 'xlsx':
    case 'xls':
      return isEn ? 'Excel Spreadsheet' : 'Excel táblázat';
    case 'docx':
    case 'doc':
      return isEn ? 'Word Document' : 'Word dokumentum';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
      return isEn ? `${ext.toUpperCase()} Image` : `${ext.toUpperCase()} kép`;
    default:
      return ext ? `${ext.toUpperCase()} ${isEn ? 'File' : 'fájl'}` : (isEn ? 'Document' : 'Dokumentum');
  }
}
