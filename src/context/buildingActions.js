import { getPermanentVault, savePermanentVault, stripSensitiveUserFields } from './syncEngine';
import { getFirebaseInstance, IS_FIRESTORE_MODE } from '../constants/firebaseConfig';
import { ref, set, get } from 'firebase/database';
import {
  callProvisionBuilding,
  callManageUnitLifecycle,
  updateBuildingMetadata,
  updateUnitMasterData,
  updateOwnerUnitContact,
  saveBuildingDocument,
  deleteBuildingDocument,
  saveBuildingInfoSection,
  deleteBuildingInfoSection,
  uploadBase64ToStorage,
  deleteFromStorage,
  getSecureStorageDownloadUrl,
} from '../services/firestoreService';
import {
  uiFlatMasterToFirestoreUnitUpdate,
  uploadAttachmentsToStorage,
  slugifyUnitId,
} from '../services/firestoreAdapter';
import { sanitizeFileName, readFileAsDataUrl } from '../utils/fileSecurity';
import { planExplorerMove, planExplorerDelete, planFolderTreeCopy } from '../utils/docExplorer';
import {
  resolveUserOrgContext,
  canUserAccessBuilding,
  canUserManageBuilding,
  canUserCreateBuilding,
  canUserDeleteBuilding,
  canUserEditBankAccountNumbers,
  detectBankAccountChanges,
  buildBankChangeNotification,
  findOrganizationForBuilding,
  normalizeEmail,
} from '../utils/teamPermissions';

export function createBuildingActions({ state, setState, persistState, showToast, t, reloadCurrentBuilding, hydrateAndSwitchBuilding }) {
  const isAdmin = () => Boolean(
    state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'superadmin')
  );

  const requireAdmin = (targetBuildingId = null) => {
    if (!isAdmin()) {
      showToast(
        t.error_unauthorized || (state.currentLang === 'en' ? "Unauthorized action." : "Nincs jogosultságod ehhez a művelethez."),
        "error"
      );
      return false;
    }
    const bId = targetBuildingId || state.currentBuildingId || state.buildings?.[0]?.id;
    if (!canUserManageBuilding(state.currentUser, bId, state.organizations, state.buildings)) {
      showToast(
        t.team_viewer_readonly_error || (state.currentLang === 'en'
          ? "You have read-only (viewer) access to this condominium. Editing is not allowed."
          : "Csak megtekintési jogosultságod van ezen a társasházon. A módosítás nem engedélyezett."),
        "error"
      );
      return false;
    }
    return true;
  };

  // Switch Building
  const switchBuilding = (buildingId) => {
    const curB = (state.buildings || []).find(b => b.id === buildingId);
    if (!curB) return;
    if (isAdmin()) {
      if (!canUserAccessBuilding(state.currentUser, curB, state.organizations, state.buildings)) {
        showToast(
          t.error_unauthorized || (state.currentLang === 'en' ? "You do not have access to this condominium." : "Nincs jogosultságod ehhez a társasházhoz."),
          "error"
        );
        return;
      }
    }
    if (!isAdmin() && state.currentUser?.role !== 'szvb') {
      const userEmail = (state.currentUser?.email || "").toLowerCase().trim();
      const ownsFlatInBuilding = (curB.flats || []).some(f => {
        if ((f.email || "").toLowerCase().trim() === userEmail && userEmail) return true;
        if (Array.isArray(f.owners) && userEmail) {
          return f.owners.some(o =>
            (o.email || "").toLowerCase().trim() === userEmail ||
            (Array.isArray(o.emails) && o.emails.some(e => (e || "").toLowerCase().trim() === userEmail))
          );
        }
        return state.currentUser?.flatNum && state.currentUser.flatNum !== "0" && f.flatNum === state.currentUser.flatNum && state.currentUser.buildingId === buildingId;
      });
      const hasMembership = Boolean(state.currentUser?.memberships?.[buildingId]?.active);
      if (!ownsFlatInBuilding && !hasMembership) return;
    }

    if (IS_FIRESTORE_MODE && typeof hydrateAndSwitchBuilding === 'function') {
      hydrateAndSwitchBuilding(buildingId, false);
      return;
    }

    persistState(s => {
      const updatedUser = s.currentUser ? stripSensitiveUserFields({ ...s.currentUser, buildingId }) : s.currentUser;
      if (updatedUser && !IS_FIRESTORE_MODE) {
        try {
          localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(updatedUser));
          localStorage.setItem("tarsashaz_is_portfolio", "false");
        } catch (e) {}
      }
      return {
        ...s,
        currentUser: updatedUser,
        currentBuildingId: buildingId,
        isPortfolioView: false,
        flats: curB.flats || [],
        transactions: curB.transactions || [],
        expenses: curB.expenses || [],
        manualDebits: curB.manualDebits || [],
        documents: curB.documents || [],
        docFolders: curB.docFolders || [],
        loans: curB.loans || [],
        infoSections: curB.infoSections || [],
        buildingInitialReserveCommon: curB.buildingInitialReserveCommon || 0,
        buildingInitialReserveRenovation: curB.buildingInitialReserveRenovation || 0
      };
    }, 'localOnly');
  };

  // Add Flat
  const addFlat = (newFlat) => {
    if (!requireAdmin()) return;
    const { pass, password, resetToken, resetTokenExpiry, ...sanitizedFlat } = newFlat || {};
    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      if (!buildingId) return;
      callManageUnitLifecycle({
        action: 'create',
        buildingId,
        unitData: sanitizedFlat,
      })
        .then(async () => {
          if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
          showToast(state.currentLang === 'en' ? "Flat added!" : "Új lakás hozzáadva!");
        })
        .catch((err) => {
          console.warn('Firestore addFlat error:', err.message);
          showToast(state.currentLang === 'en' ? "Failed to add flat." : "Nem sikerült hozzáadni a lakást.", "error");
        });
      return;
    }

    persistState(s => {
      const flatWithTimestamp = { ...sanitizedFlat, lastUpdated: Date.now() };
      const updatedFlats = [...(s.flats || []), flatWithTimestamp];
      const newUser = {
        id: sanitizedFlat.flatNum,
        name: sanitizedFlat.ownerName,
        email: sanitizedFlat.email,
        role: "Owner",
        flatNum: sanitizedFlat.flatNum,
        buildingId: s.currentBuildingId
      };
      return {
        ...s,
        flats: updatedFlats,
        users: [...(s.users || []), newUser]
      };
    }, true);
    showToast(state.currentLang === 'en' ? "Flat added!" : "Új lakás hozzáadva!");
  };

  // Delete Flat
  const deleteFlat = (flatNum) => {
    if (!requireAdmin()) return;
    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      const targetFlat = (state.flats || []).find(f => f.flatNum === flatNum);
      const unitId = targetFlat?.unitId || targetFlat?.id || slugifyUnitId(flatNum);
      if (!buildingId || !unitId) return;
      callManageUnitLifecycle({
        action: 'delete',
        buildingId,
        unitId,
      })
        .then(async () => {
          if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
          showToast(state.currentLang === 'en' ? "Flat deleted!" : "Lakás törölve!");
        })
        .catch((err) => {
          console.warn('Firestore deleteFlat error:', err.message);
          showToast(state.currentLang === 'en' ? "Failed to delete flat." : "Nem sikerült törölni a lakást.", "error");
        });
      return;
    }

    const vault = getPermanentVault();
    vault.deletedFlatNums = vault.deletedFlatNums || [];
    if (!vault.deletedFlatNums.includes(flatNum)) {
      vault.deletedFlatNums.push(flatNum);
      savePermanentVault(vault);
    }

    persistState(s => ({
      ...s,
      flats: (s.flats || []).filter(f => f.flatNum !== flatNum),
      users: (s.users || []).filter(u => !(u.flatNum === flatNum && u.role === "Owner"))
    }), true);
    showToast(state.currentLang === 'en' ? "Flat deleted!" : "Lakás törölve!");
  };

  // Save Flat Master Data
  const saveFlatMaster = (flatNum, updatedData) => {
    let safeUpdate = updatedData || {};
    if (!isAdmin()) {
      // Non-admin Owners may only update their own unit's personal contact fields
      if (!state.currentUser || state.currentUser.role !== 'Owner' || state.currentUser.flatNum !== flatNum) {
        requireAdmin();
        return;
      }
      safeUpdate = {};
      if (updatedData?.phone !== undefined) safeUpdate.phone = updatedData.phone;
      if (updatedData?.emergencyContact !== undefined) safeUpdate.emergencyContact = updatedData.emergencyContact;
      if (updatedData?.notes !== undefined) safeUpdate.notes = updatedData.notes;
    } else {
      const { pass, password, resetToken, resetTokenExpiry, ...clean } = updatedData || {};
      safeUpdate = clean;
    }

    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      const existingFlat = (state.flats || []).find(f => f.flatNum === flatNum);
      const unitId = existingFlat?.unitId || existingFlat?.id || slugifyUnitId(flatNum);
      if (!buildingId || !unitId) return;

      const writePromise = isAdmin()
        ? updateUnitMasterData(buildingId, unitId, uiFlatMasterToFirestoreUnitUpdate(safeUpdate, existingFlat || {}))
        : updateOwnerUnitContact(buildingId, unitId, {
            phone: safeUpdate.phone ?? existingFlat?.phone ?? '',
            emergencyContact: safeUpdate.emergencyContact ?? existingFlat?.emergencyContact ?? '',
            notes: safeUpdate.notes ?? existingFlat?.notes ?? '',
          });

      writePromise
        .then(async () => {
          if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
          showToast(state.currentLang === 'en' ? "Flat data saved!" : "Lakás adatai mentve!");
        })
        .catch((err) => {
          console.warn('Firestore saveFlatMaster error:', err.message);
          showToast(state.currentLang === 'en' ? "Failed to save flat data." : "Nem sikerült menteni a lakás adatait.", "error");
        });
      return;
    }

    persistState(s => {
      const updatedFlats = (s.flats || []).map(f => {
        if (f.flatNum === flatNum) {
          return { ...f, ...safeUpdate, lastUpdated: Date.now() };
        }
        return f;
      });

      // Also update email or name in users (Admin edits only)
      const updatedUsers = isAdmin() ? (s.users || []).map(u => {
        if (u.flatNum === flatNum && u.role === "Owner") {
          let indName = u.name;
          if (Array.isArray(safeUpdate.owners) && safeUpdate.owners.length > 0) {
            const uEmail = (u.email || "").toLowerCase().trim();
            const matchedOwner = safeUpdate.owners.find(o => {
              const oEmail = (o.email || "").toLowerCase().trim();
              const oEmails = Array.isArray(o.emails) ? o.emails.map(e => (e || "").toLowerCase().trim()) : [];
              return uEmail && (oEmail === uEmail || oEmails.includes(uEmail));
            });
            if (matchedOwner && matchedOwner.name) {
              indName = matchedOwner.name;
            } else if (safeUpdate.owners.length === 1 && safeUpdate.owners[0].name) {
              indName = safeUpdate.owners[0].name;
            }
          } else if (safeUpdate.ownerName) {
            indName = safeUpdate.ownerName;
          }

          return stripSensitiveUserFields({
            ...u,
            name: indName,
            email: safeUpdate.email || u.email
          });
        }
        return u;
      }) : (s.users || []);

      let updatedCurUser = s.currentUser;
      if (isAdmin() && s.currentUser && s.currentUser.flatNum === flatNum && s.currentUser.role === 'Owner') {
        let indName = s.currentUser.name;
        if (Array.isArray(safeUpdate.owners) && safeUpdate.owners.length > 0) {
          const uEmail = (s.currentUser.email || "").toLowerCase().trim();
          const matchedOwner = safeUpdate.owners.find(o => {
            const oEmail = (o.email || "").toLowerCase().trim();
            const oEmails = Array.isArray(o.emails) ? o.emails.map(e => (e || "").toLowerCase().trim()) : [];
            return uEmail && (oEmail === uEmail || oEmails.includes(uEmail));
          });
          if (matchedOwner && matchedOwner.name) {
            indName = matchedOwner.name;
          }
        }
        updatedCurUser = {
          ...s.currentUser,
          name: indName
        };
      }

      return {
        ...s,
        currentUser: updatedCurUser,
        flats: updatedFlats,
        users: updatedUsers
      };
    });
    showToast(state.currentLang === 'en' ? "Flat data saved!" : "Lakás adatai mentve!");
  };

  // Document management: Upload Document
  const uploadDocument = async (newDoc) => {
    if (!requireAdmin()) return;
    const docId = newDoc.id || `doc-${Date.now()}`;
    const fileContent = newDoc.fileData;

    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      if (!buildingId) return;
      try {
        let storagePath = null;
        const safeFileName = sanitizeFileName(newDoc.fileName || `${docId}.${newDoc.fileType || 'pdf'}`);
        if (fileContent && typeof fileContent === 'string' && fileContent.startsWith('data:')) {
          storagePath = `buildings/${buildingId}/documents/${docId}/${safeFileName}`;
          await uploadBase64ToStorage(storagePath, fileContent, newDoc.mimeType);
        }
        await saveBuildingDocument(buildingId, docId, {
          ...newDoc,
          id: docId,
          fileName: safeFileName,
          folderId: newDoc.folderId || null,
          hasFile: Boolean(storagePath),
          storagePath,
          visibility: newDoc.visibility === 'admin' ? 'admin' : 'building',
        });
        if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
        showToast(state.currentLang === 'en' ? "Document uploaded!" : "Dokumentum feltöltve!");
      } catch (err) {
        console.warn('Firestore uploadDocument error:', err.message);
        showToast(state.currentLang === 'en' ? "Failed to upload document." : "Nem sikerült feltölteni a dokumentumot.", "error");
      }
      return;
    }

    if (fileContent) {
      const { rtdb } = getFirebaseInstance();
      if (rtdb) {
        set(ref(rtdb, `condo_files/${docId}`), fileContent).catch(err => {
          console.warn("Error uploading file to condo_files:", err.message);
        });
      }
    }

    const docMetadata = {
      ...newDoc,
      id: docId,
      folderId: newDoc.folderId || null,
      fileData: null,
      hasFile: Boolean(fileContent)
    };

    persistState(s => {
      const targetBId = s.currentBuildingId;
      const updatedDocs = [docMetadata, ...(s.documents || [])];
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === targetBId) {
          return { ...b, documents: updatedDocs };
        }
        return b;
      });
      return {
        ...s,
        buildings: updatedBuildings,
        documents: updatedDocs
      };
    });
    showToast(state.currentLang === 'en' ? "Document uploaded!" : "Dokumentum feltöltve!");
  };

  // Document management: Batch Upload Documents (Drag & Drop multi-file support)
  const uploadDocumentsBatch = async (newDocsArray = []) => {
    if (!requireAdmin()) return 0;
    const validItems = Array.isArray(newDocsArray) ? newDocsArray.filter(Boolean) : [];
    if (validItems.length === 0) return 0;

    const isEn = state.currentLang === 'en';
    const baseTs = Date.now();
    const prepared = validItems.map((item, idx) => {
      const docId = item.id || `doc-${baseTs}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
      return {
        ...item,
        id: docId,
        fileName: sanitizeFileName(item.fileName || `${docId}.${item.fileType || 'pdf'}`),
        folderId: item.folderId || null,
      };
    });

    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      if (!buildingId) return 0;
      try {
        await Promise.all(
          prepared.map(async (item) => {
            let storagePath = null;
            if (item.fileData && typeof item.fileData === 'string' && item.fileData.startsWith('data:')) {
              storagePath = `buildings/${buildingId}/documents/${item.id}/${item.fileName}`;
              await uploadBase64ToStorage(storagePath, item.fileData, item.mimeType);
            }
            const { fileData: _omit, ...meta } = item;
            await saveBuildingDocument(buildingId, item.id, {
              ...meta,
              hasFile: Boolean(storagePath),
              storagePath,
              visibility: item.visibility === 'admin' ? 'admin' : 'building',
            });
          })
        );
        if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
        showToast(
          prepared.length === 1
            ? (isEn ? "Document uploaded!" : "Dokumentum feltöltve!")
            : (isEn ? `${prepared.length} documents uploaded!` : `${prepared.length} dokumentum feltöltve!`)
        );
        return prepared.length;
      } catch (err) {
        console.warn('Firestore uploadDocumentsBatch error:', err.message);
        showToast(isEn ? "Failed to upload documents." : "Nem sikerült feltölteni a dokumentumokat.", "error");
        return 0;
      }
    }

    const { rtdb } = getFirebaseInstance();
    if (rtdb) {
      prepared.forEach((item) => {
        if (item.fileData) {
          set(ref(rtdb, `condo_files/${item.id}`), item.fileData).catch((err) => {
            console.warn("Error uploading batch file to condo_files:", err.message);
          });
        }
      });
    }

    const metadataDocs = prepared.map(({ fileData, ...rest }) => ({
      ...rest,
      fileData: null,
      hasFile: Boolean(fileData),
    }));

    persistState((s) => {
      const targetBId = s.currentBuildingId;
      const updatedDocs = [...metadataDocs, ...(s.documents || [])];
      const updatedBuildings = (s.buildings || []).map((b) =>
        b.id === targetBId ? { ...b, documents: updatedDocs } : b
      );
      return {
        ...s,
        buildings: updatedBuildings,
        documents: updatedDocs,
      };
    });

    showToast(
      prepared.length === 1
        ? (isEn ? "Document uploaded!" : "Dokumentum feltöltve!")
        : (isEn ? `${prepared.length} documents uploaded!` : `${prepared.length} dokumentum feltöltve!`)
    );
    return prepared.length;
  };

  // Document management: Update Document (Edit title, filename, folder, or replace file)
  const updateDocument = async (docId, updatedDocData) => {
    if (!requireAdmin()) return;
    const fileContent = updatedDocData.fileData;

    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      const existing = (state.documents || []).find(d => d.id === docId);
      if (!buildingId) return;
      try {
        let storagePath = existing?.storagePath || null;
        const safeFileName = sanitizeFileName(updatedDocData.fileName || existing?.fileName || `${docId}.pdf`);
        if (fileContent && typeof fileContent === 'string' && fileContent.startsWith('data:')) {
          storagePath = `buildings/${buildingId}/documents/${docId}/${safeFileName}`;
          await uploadBase64ToStorage(storagePath, fileContent, updatedDocData.mimeType);
        }
        await saveBuildingDocument(buildingId, docId, {
          ...(existing || {}),
          ...updatedDocData,
          fileName: safeFileName,
          folderId: updatedDocData.folderId !== undefined ? updatedDocData.folderId : (existing?.folderId || null),
          hasFile: Boolean(storagePath || existing?.hasFile),
          storagePath,
          lastModified: Date.now(),
        });
        if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
        showToast(state.currentLang === 'en' ? "Document updated!" : "Dokumentum módosítva!");
      } catch (err) {
        console.warn('Firestore updateDocument error:', err.message);
        showToast(state.currentLang === 'en' ? "Failed to update document." : "Nem sikerült módosítani a dokumentumot.", "error");
      }
      return;
    }

    if (fileContent) {
      const { rtdb } = getFirebaseInstance();
      if (rtdb) {
        set(ref(rtdb, `condo_files/${docId}`), fileContent).catch(err => {
          console.warn("Error updating file in condo_files:", err.message);
        });
      }
    }

    persistState(s => {
      const targetBId = s.currentBuildingId;
      const updatedDocs = (s.documents || []).map(doc => {
        if (doc.id === docId) {
          return {
            ...doc,
            ...updatedDocData,
            folderId: updatedDocData.folderId !== undefined ? updatedDocData.folderId : doc.folderId,
            fileData: null,
            hasFile: fileContent ? true : doc.hasFile,
            lastModified: Date.now()
          };
        }
        return doc;
      });

      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === targetBId) {
          return { ...b, documents: updatedDocs };
        }
        return b;
      });

      return {
        ...s,
        buildings: updatedBuildings,
        documents: updatedDocs
      };
    });
    showToast(state.currentLang === 'en' ? "Document updated!" : "Dokumentum módosítva!");
  };

  // Document management: Move Document to Folder (or null for root)
  const moveDocument = (docId, targetFolderId) => {
    if (!requireAdmin()) return;
    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      const existing = (state.documents || []).find(d => d.id === docId);
      if (buildingId && existing) {
        saveBuildingDocument(buildingId, docId, { ...existing, folderId: targetFolderId || null })
          .then(() => typeof reloadCurrentBuilding === 'function' && reloadCurrentBuilding(buildingId))
          .catch(err => console.warn('Firestore moveDocument error:', err.message));
      }
      showToast(state.currentLang === 'en' ? "Document moved!" : "Dokumentum áthelyezve!");
      return;
    }

    persistState(s => {
      const targetBId = s.currentBuildingId;
      const updatedDocs = (s.documents || []).map(doc => {
        if (doc.id === docId) {
          return { ...doc, folderId: targetFolderId || null };
        }
        return doc;
      });

      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === targetBId) {
          return { ...b, documents: updatedDocs };
        }
        return b;
      });

      return {
        ...s,
        buildings: updatedBuildings,
        documents: updatedDocs
      };
    });
    showToast(state.currentLang === 'en' ? "Document moved!" : "Dokumentum áthelyezve!");
  };

  // Document management: Delete Document
  const deleteDocument = (docId) => {
    if (!requireAdmin()) return;
    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      const existing = (state.documents || []).find(d => d.id === docId);
      const isSharedStoragePath = Boolean(
        existing?.storagePath &&
        (state.documents || []).some(d => d.id !== docId && d.storagePath === existing.storagePath)
      );
      if (buildingId && docId) {
        Promise.all([
          deleteBuildingDocument(buildingId, docId),
          existing?.storagePath && !isSharedStoragePath ? deleteFromStorage(existing.storagePath) : Promise.resolve(),
        ])
          .then(() => typeof reloadCurrentBuilding === 'function' && reloadCurrentBuilding(buildingId))
          .catch(err => console.warn('Firestore deleteDocument error:', err.message));
      }
      showToast(state.currentLang === 'en' ? "Document deleted!" : "Dokumentum törölve!");
      return;
    }

    const vault = getPermanentVault();
    vault.deletedIds = vault.deletedIds || [];
    if (!vault.deletedIds.includes(docId)) {
      vault.deletedIds.push(docId);
      savePermanentVault(vault);
    }
    const { rtdb } = getFirebaseInstance();
    if (rtdb && docId) {
      set(ref(rtdb, `condo_files/${docId}`), null).catch(() => {});
    }
    persistState(s => {
      const targetBId = s.currentBuildingId;
      const updatedDocs = (s.documents || []).filter(d => d.id !== docId);
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === targetBId) {
          return { ...b, documents: updatedDocs };
        }
        return b;
      });
      return {
        ...s,
        buildings: updatedBuildings,
        documents: updatedDocs
      };
    });
    showToast(state.currentLang === 'en' ? "Document deleted!" : "Dokumentum törölve!");
  };

  // Folder management: Create Folder
  const createDocFolder = (folderData) => {
    if (!requireAdmin()) return null;
    const newFolder = {
      id: folderData.id || `folder-${Date.now()}`,
      name: folderData.name?.trim() || "Új mappa",
      color: folderData.color || "blue",
      parentId: folderData.parentId || null,
      createdAt: new Date().toISOString().slice(0, 10)
    };

    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      const updatedFolders = [...(state.docFolders || []), newFolder];
      if (buildingId) {
        updateBuildingMetadata(buildingId, { docFolders: updatedFolders })
          .then(() => typeof reloadCurrentBuilding === 'function' && reloadCurrentBuilding(buildingId))
          .catch(err => console.warn('Firestore createDocFolder error:', err.message));
      }
      showToast(state.currentLang === 'en' ? "Folder created!" : "Mappa létrehozva!");
      return newFolder;
    }

    persistState(s => {
      const targetBId = s.currentBuildingId;
      const updatedFolders = [...(s.docFolders || []), newFolder];
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === targetBId) {
          return { ...b, docFolders: updatedFolders };
        }
        return b;
      });
      return {
        ...s,
        buildings: updatedBuildings,
        docFolders: updatedFolders
      };
    });
    showToast(state.currentLang === 'en' ? "Folder created!" : "Mappa létrehozva!");
    return newFolder;
  };

  // Folder management: Update / Rename Folder
  const updateDocFolder = (folderId, updatedData) => {
    if (!requireAdmin()) return;
    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      const updatedFolders = (state.docFolders || []).map(f => {
        if (f.id === folderId) {
          return { ...f, ...updatedData, name: updatedData.name !== undefined ? updatedData.name.trim() : f.name };
        }
        return f;
      });
      if (buildingId) {
        updateBuildingMetadata(buildingId, { docFolders: updatedFolders })
          .then(() => typeof reloadCurrentBuilding === 'function' && reloadCurrentBuilding(buildingId))
          .catch(err => console.warn('Firestore updateDocFolder error:', err.message));
      }
      showToast(state.currentLang === 'en' ? "Folder updated!" : "Mappa módosítva!");
      return;
    }

    persistState(s => {
      const targetBId = s.currentBuildingId;
      const updatedFolders = (s.docFolders || []).map(f => {
        if (f.id === folderId) {
          return {
            ...f,
            ...updatedData,
            name: updatedData.name !== undefined ? updatedData.name.trim() : f.name
          };
        }
        return f;
      });
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === targetBId) {
          return { ...b, docFolders: updatedFolders };
        }
        return b;
      });
      return {
        ...s,
        buildings: updatedBuildings,
        docFolders: updatedFolders
      };
    });
    showToast(state.currentLang === 'en' ? "Folder updated!" : "Mappa módosítva!");
  };

  // Folder management: Delete Folder (Promotes contained subfolders & documents safely to parent/root!)
  const deleteDocFolder = (folderId) => {
    if (!requireAdmin()) return;
    const isEn = state.currentLang === 'en';
    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      const { remainingFolders, remainingDocs } = planExplorerDelete({
        folders: state.docFolders || [],
        docs: state.documents || [],
        folderIds: [folderId],
        docIds: [],
      });
      const prevById = new Map((state.documents || []).map(d => [d.id, d]));
      const changedDocs = remainingDocs.filter(d => (prevById.get(d.id)?.folderId || null) !== (d.folderId || null));
      if (buildingId) {
        Promise.all([
          updateBuildingMetadata(buildingId, { docFolders: remainingFolders }),
          ...changedDocs.map(d => saveBuildingDocument(buildingId, d.id, d)),
        ])
          .then(() => typeof reloadCurrentBuilding === 'function' && reloadCurrentBuilding(buildingId))
          .catch(err => console.warn('Firestore deleteDocFolder error:', err.message));
      }
      showToast(isEn ? "Folder deleted! Contained items moved safely up." : "Mappa törölve! A benne lévő elemek biztonságban feljebb kerültek.");
      return;
    }

    persistState(s => {
      const targetBId = s.currentBuildingId;
      const { remainingFolders, remainingDocs } = planExplorerDelete({
        folders: s.docFolders || [],
        docs: s.documents || [],
        folderIds: [folderId],
        docIds: [],
      });
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === targetBId) {
          return {
            ...b,
            docFolders: remainingFolders,
            documents: remainingDocs
          };
        }
        return b;
      });
      return {
        ...s,
        buildings: updatedBuildings,
        docFolders: remainingFolders,
        documents: remainingDocs
      };
    });
    showToast(isEn ? "Folder deleted! Contained items moved safely up." : "Mappa törölve! A benne lévő elemek biztonságban feljebb kerültek.");
  };

  // Explorer batch action: Move multiple documents & folders with strict cycle protection
  const moveExplorerItems = async ({ docIds = [], folderIds = [] } = {}, targetFolderId = null) => {
    if (!requireAdmin()) return { movedCount: 0, skippedCyclicCount: 0 };
    const isEn = state.currentLang === 'en';
    const plan = planExplorerMove({
      folders: state.docFolders || [],
      docs: state.documents || [],
      folderIds,
      docIds,
      targetFolderId,
    });

    if (plan.movedCount === 0) {
      if (plan.skippedCyclicCount > 0) {
        showToast(
          isEn
            ? "A folder cannot be moved into itself or one of its subfolders."
            : "Egy mappa nem helyezhető át önmagába vagy saját almappájába.",
          "error"
        );
      }
      return { movedCount: 0, skippedCyclicCount: plan.skippedCyclicCount };
    }

    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      if (buildingId) {
        try {
          const ops = [];
          if (plan.movedFolderIds.length > 0) {
            ops.push(updateBuildingMetadata(buildingId, { docFolders: plan.updatedFolders }));
          }
          for (const movedDocId of plan.movedDocIds) {
            const docObj = plan.updatedDocs.find(d => d.id === movedDocId);
            if (docObj) ops.push(saveBuildingDocument(buildingId, movedDocId, docObj));
          }
          await Promise.all(ops);
          if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
        } catch (err) {
          console.warn('Firestore moveExplorerItems error:', err.message);
          showToast(isEn ? "Failed to move items." : "Nem sikerült áthelyezni az elemeket.", "error");
          return { movedCount: 0, skippedCyclicCount: plan.skippedCyclicCount };
        }
      }
    } else {
      persistState(s => {
        const targetBId = s.currentBuildingId;
        const freshPlan = planExplorerMove({
          folders: s.docFolders || [],
          docs: s.documents || [],
          folderIds,
          docIds,
          targetFolderId,
        });
        const updatedBuildings = (s.buildings || []).map(b =>
          b.id === targetBId
            ? { ...b, docFolders: freshPlan.updatedFolders, documents: freshPlan.updatedDocs }
            : b
        );
        return {
          ...s,
          buildings: updatedBuildings,
          docFolders: freshPlan.updatedFolders,
          documents: freshPlan.updatedDocs,
        };
      });
    }

    if (plan.skippedCyclicCount > 0) {
      showToast(
        isEn
          ? `${plan.movedCount} item(s) moved (nested self-target folder skipped).`
          : `${plan.movedCount} elem áthelyezve (saját almappába történő áthelyezés kihagyva).`
      );
    } else {
      showToast(
        plan.movedCount === 1
          ? (isEn ? "Item moved!" : "Elem áthelyezve!")
          : (isEn ? `${plan.movedCount} items moved!` : `${plan.movedCount} elem áthelyezve!`)
      );
    }
    return { movedCount: plan.movedCount, skippedCyclicCount: plan.skippedCyclicCount };
  };

  // Explorer batch action: Deep copy documents & folders (Ctrl+C / Ctrl+V)
  const duplicateExplorerItems = async ({ docIds = [], folderIds = [] } = {}, targetFolderId = null) => {
    if (!requireAdmin()) return 0;
    const isEn = state.currentLang === 'en';
    const { newFolders, newDocs } = planFolderTreeCopy({
      folders: state.docFolders || [],
      docs: state.documents || [],
      sourceFolderIds: folderIds,
      sourceDocIds: docIds,
      targetFolderId,
      isEn,
    });

    const totalCreated = newFolders.length + newDocs.length;
    if (totalCreated === 0) return 0;

    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      if (!buildingId) return 0;
      try {
        const ops = [];
        if (newFolders.length > 0) {
          ops.push(updateBuildingMetadata(buildingId, { docFolders: [...(state.docFolders || []), ...newFolders] }));
        }
        await Promise.all([
          ...ops,
          ...newDocs.map(async (clone) => {
            const { _sourceDocId, fileData: _omit, ...docMeta } = clone;
            let finalStoragePath = docMeta.storagePath || null;
            if (docMeta.storagePath) {
              try {
                const signedUrl = await getSecureStorageDownloadUrl(docMeta.storagePath);
                const resp = await fetch(signedUrl);
                if (resp.ok) {
                  const blob = await resp.blob();
                  const dataUrl = await readFileAsDataUrl(blob);
                  const safeName = sanitizeFileName(docMeta.fileName || `${docMeta.id}.${docMeta.fileType || 'pdf'}`);
                  finalStoragePath = `buildings/${buildingId}/documents/${docMeta.id}/${safeName}`;
                  await uploadBase64ToStorage(finalStoragePath, dataUrl, blob.type || undefined);
                }
              } catch (copyErr) {
                console.warn('Firestore storage clone fallback (shared path):', copyErr.message);
              }
            }
            await saveBuildingDocument(buildingId, docMeta.id, {
              ...docMeta,
              storagePath: finalStoragePath,
              hasFile: Boolean(finalStoragePath || docMeta.hasFile),
            });
          }),
        ]);
        if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
      } catch (err) {
        console.warn('Firestore duplicateExplorerItems error:', err.message);
        showToast(isEn ? "Failed to paste copied items." : "Nem sikerült beilleszteni a másolt elemeket.", "error");
        return 0;
      }
    } else {
      const { rtdb } = getFirebaseInstance();
      // Copy binary payloads in RTDB condo_files/ for cloned docs that have stored files
      if (rtdb) {
        await Promise.all(
          newDocs.map(async (clone) => {
            if (!clone._sourceDocId || !clone.hasFile) return;
            try {
              const snap = await get(ref(rtdb, `condo_files/${clone._sourceDocId}`));
              if (snap.exists()) {
                await set(ref(rtdb, `condo_files/${clone.id}`), snap.val());
              }
            } catch (copyErr) {
              console.warn('RTDB file clone error:', copyErr.message);
            }
          })
        );
      }

      const cleanedNewDocs = newDocs.map(({ _sourceDocId, ...rest }) => rest);
      persistState(s => {
        const targetBId = s.currentBuildingId;
        const updatedFolders = [...(s.docFolders || []), ...newFolders];
        const updatedDocs = [...cleanedNewDocs, ...(s.documents || [])];
        const updatedBuildings = (s.buildings || []).map(b =>
          b.id === targetBId
            ? { ...b, docFolders: updatedFolders, documents: updatedDocs }
            : b
        );
        return {
          ...s,
          buildings: updatedBuildings,
          docFolders: updatedFolders,
          documents: updatedDocs,
        };
      });
    }

    showToast(
      totalCreated === 1
        ? (isEn ? "Item pasted!" : "Elem beillesztve!")
        : (isEn ? `${totalCreated} items pasted!` : `${totalCreated} elem beillesztve!`)
    );
    return totalCreated;
  };

  // Explorer batch action: Delete multiple documents & folders safely
  const deleteExplorerItems = async ({ docIds = [], folderIds = [] } = {}) => {
    if (!requireAdmin()) return 0;
    const isEn = state.currentLang === 'en';
    const plan = planExplorerDelete({
      folders: state.docFolders || [],
      docs: state.documents || [],
      folderIds,
      docIds,
    });

    const totalDeleted = plan.deletedDocIds.length + plan.deletedFolderIds.length;
    if (totalDeleted === 0) return 0;

    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      if (buildingId) {
        try {
          const remainingPaths = new Set(plan.remainingDocs.map(d => d.storagePath).filter(Boolean));
          const prevDocById = new Map((state.documents || []).map(d => [d.id, d]));
          const changedDocs = plan.remainingDocs.filter(
            d => (prevDocById.get(d.id)?.folderId || null) !== (d.folderId || null)
          );
          const ops = [];
          if (plan.deletedFolderIds.length > 0) {
            ops.push(updateBuildingMetadata(buildingId, { docFolders: plan.remainingFolders }));
          }
          for (const d of changedDocs) {
            ops.push(saveBuildingDocument(buildingId, d.id, d));
          }
          for (const delId of plan.deletedDocIds) {
            ops.push(deleteBuildingDocument(buildingId, delId));
            const oldDoc = prevDocById.get(delId);
            if (oldDoc?.storagePath && !remainingPaths.has(oldDoc.storagePath)) {
              ops.push(deleteFromStorage(oldDoc.storagePath));
            }
          }
          await Promise.all(ops);
          if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
        } catch (err) {
          console.warn('Firestore deleteExplorerItems error:', err.message);
          showToast(isEn ? "Failed to delete selected items." : "Nem sikerült törölni a kijelölt elemeket.", "error");
          return 0;
        }
      }
    } else {
      if (plan.deletedDocIds.length > 0) {
        const vault = getPermanentVault();
        vault.deletedIds = vault.deletedIds || [];
        let changedVault = false;
        for (const id of plan.deletedDocIds) {
          if (!vault.deletedIds.includes(id)) {
            vault.deletedIds.push(id);
            changedVault = true;
          }
        }
        if (changedVault) savePermanentVault(vault);

        const { rtdb } = getFirebaseInstance();
        if (rtdb) {
          plan.deletedDocIds.forEach(id => {
            set(ref(rtdb, `condo_files/${id}`), null).catch(() => {});
          });
        }
      }

      persistState(s => {
        const targetBId = s.currentBuildingId;
        const freshPlan = planExplorerDelete({
          folders: s.docFolders || [],
          docs: s.documents || [],
          folderIds,
          docIds,
        });
        const updatedBuildings = (s.buildings || []).map(b =>
          b.id === targetBId
            ? { ...b, docFolders: freshPlan.remainingFolders, documents: freshPlan.remainingDocs }
            : b
        );
        return {
          ...s,
          buildings: updatedBuildings,
          docFolders: freshPlan.remainingFolders,
          documents: freshPlan.remainingDocs,
        };
      });
    }

    showToast(
      totalDeleted === 1
        ? (isEn ? "Item deleted!" : "Elem törölve!")
        : (isEn ? `${totalDeleted} items deleted!` : `${totalDeleted} elem törölve!`)
    );
    return totalDeleted;
  };

  // Dedicated document file store helper (Cloud Storage signed URL in Firestore mode, condo_files in legacy RTDB)
  const fetchDocumentFile = async (docId) => {
    if (!docId) return null;
    if (IS_FIRESTORE_MODE) {
      const docObj = (state.documents || []).find(d => d.id === docId);
      if (docObj?.storagePath) {
        try {
          return await getSecureStorageDownloadUrl(docObj.storagePath);
        } catch (err) {
          console.warn('Firestore Storage download URL error:', err.message);
          return null;
        }
      }
      return null;
    }

    const { rtdb } = getFirebaseInstance();
    if (!rtdb) return null;
    try {
      const snap = await get(ref(rtdb, `condo_files/${docId}`));
      if (snap.exists()) {
        return snap.val();
      }
    } catch (e) {
      console.warn("Error fetching document file:", e.message);
    }
    return null;
  };

  // Add Building (respects Owner-controlled `canCreateBuildings` permission & org ownership)
  const addBuilding = (newBuilding) => {
    if (!requireAdmin()) return;
    if (!canUserCreateBuilding(state.currentUser, state.organizations, state.buildings)) {
      showToast(
        t.team_no_create_building_perm || (state.currentLang === 'en'
          ? "Only the owner or an authorized colleague can add new condominiums."
          : "Új társasház létrehozásához tulajdonosi engedély szükséges."),
        "error"
      );
      return;
    }

    const orgCtx = resolveUserOrgContext(state.currentUser, state.organizations, state.buildings);
    const enrichedBuilding = {
      ...newBuilding,
      ...(orgCtx.org ? { organizationId: orgCtx.org.id } : {}),
      createdByEmail: normalizeEmail(state.currentUser?.email),
      createdAt: newBuilding?.createdAt || new Date().toISOString(),
    };

    if (IS_FIRESTORE_MODE) {
      callProvisionBuilding({
        id: enrichedBuilding?.id,
        name: enrichedBuilding?.name,
        address: enrichedBuilding?.address,
        taxNumber: enrichedBuilding?.taxNumber,
        defaultBank: enrichedBuilding?.defaultBank,
        repName: enrichedBuilding?.repName,
        phone: enrichedBuilding?.phone,
        email: enrichedBuilding?.email,
        bankKK: enrichedBuilding?.bankKK,
        bankFA: enrichedBuilding?.bankFA,
        organizationId: enrichedBuilding?.organizationId || null,
        initialReserveKK: enrichedBuilding?.buildingInitialReserveCommon || 0,
        initialReserveFA: enrichedBuilding?.buildingInitialReserveRenovation || 0,
      })
        .then(async (res) => {
          if (typeof hydrateAndSwitchBuilding === 'function' && res?.buildingId) {
            await hydrateAndSwitchBuilding(res.buildingId, false, true);
          }
          showToast(state.currentLang === 'en' ? "Condominium created!" : "Új társasház sikeresen létrehozva!");
        })
        .catch((err) => {
          console.warn('Firestore addBuilding error:', err.message);
          showToast(state.currentLang === 'en' ? "Failed to create condominium." : "Nem sikerült létrehozni a társasházat.", "error");
        });
      return;
    }

    persistState(s => {
      // If a staff member with `selected` building scope creates a building,
      // auto-assign it to them while keeping ownership strictly under the company organization!
      let nextOrganizations = s.organizations || [];
      if (orgCtx.isStaff && orgCtx.org && orgCtx.member && orgCtx.member.buildingScope === 'selected') {
        nextOrganizations = nextOrganizations.map((org) => {
          if (org.id !== orgCtx.org.id) return org;
          return {
            ...org,
            members: (org.members || []).map((m) => {
              if (m.id !== orgCtx.member.id) return m;
              const updatedIds = Array.from(new Set([...(m.buildingIds || []), enrichedBuilding.id]));
              return { ...m, buildingIds: updatedIds, updatedAt: new Date().toISOString() };
            }),
            updatedAt: new Date().toISOString(),
          };
        });
      }

      return {
        ...s,
        organizations: nextOrganizations,
        buildings: [...(s.buildings || []), enrichedBuilding],
        currentBuildingId: enrichedBuilding.id,
        flats: enrichedBuilding.flats || [],
        transactions: enrichedBuilding.transactions || [],
        expenses: enrichedBuilding.expenses || [],
        manualDebits: enrichedBuilding.manualDebits || [],
        documents: enrichedBuilding.documents || [],
        docFolders: enrichedBuilding.docFolders || [],
        loans: enrichedBuilding.loans || [],
        buildingInitialReserveCommon: enrichedBuilding.buildingInitialReserveCommon || 0,
        buildingInitialReserveRenovation: enrichedBuilding.buildingInitialReserveRenovation || 0
      };
    }, true);
    showToast(state.currentLang === 'en' ? "Condominium created!" : "Új társasház sikeresen létrehozva!");
  };

  // Delete Building — STRICTLY Organization Owner or SuperAdmin ONLY (NEVER staff!)
  const deleteBuilding = (buildingId) => {
    const targetB = (state.buildings || []).find(b => b.id === buildingId);
    if (!targetB) return false;
    if (!canUserDeleteBuilding(state.currentUser, targetB, state.organizations, state.buildings)) {
      showToast(
        t.team_delete_owner_only_error || (state.currentLang === 'en'
          ? "Only the company owner can delete a condominium."
          : "Társasházat kizárólag a fiók tulajdonosa törölhet!"),
        "error"
      );
      return false;
    }

    persistState(s => {
      const remaining = (s.buildings || []).filter(b => b.id !== buildingId);
      const nextOrgs = (s.organizations || []).map(org => ({
        ...org,
        members: (org.members || []).map(m => ({
          ...m,
          buildingIds: Array.isArray(m.buildingIds) ? m.buildingIds.filter(id => id !== buildingId) : []
        }))
      }));
      const nextActive = s.currentBuildingId === buildingId ? (remaining[0]?.id || null) : s.currentBuildingId;
      return {
        ...s,
        buildings: remaining,
        organizations: nextOrgs,
        currentBuildingId: nextActive,
        isPortfolioView: s.currentBuildingId === buildingId ? true : s.isPortfolioView,
      };
    }, true);

    showToast(state.currentLang === 'en' ? "Condominium deleted." : "Társasház törölve.");
    return true;
  };

  // Toggle Grid Edit Mode
  const toggleGridEditMode = () => {
    if (!requireAdmin()) return;
    setState(s => ({ ...s, isGridEditMode: !s.isGridEditMode }));
  };

  // Update Building Representative Contact Info
  const updateBuildingRepInfo = (buildingId, repData) => {
    if (!requireAdmin()) return;
    if (IS_FIRESTORE_MODE) {
      const targetId = buildingId || state.currentBuildingId || state.buildings?.[0]?.id;
      const curB = (state.buildings || []).find(b => b.id === targetId);
      if (targetId) {
        updateBuildingMetadata(targetId, {
          repContact: {
            name: repData.repName !== undefined ? repData.repName : (curB?.repName || ''),
            phone: repData.phone !== undefined ? repData.phone : (curB?.phone || ''),
            email: repData.email !== undefined ? repData.email : (curB?.email || ''),
            officeHours: repData.repOfficeHours !== undefined ? repData.repOfficeHours : (curB?.repOfficeHours || ''),
            address: repData.repAddress !== undefined ? repData.repAddress : (curB?.repAddress || ''),
          }
        })
          .then(() => typeof reloadCurrentBuilding === 'function' && reloadCurrentBuilding(targetId))
          .catch(err => console.warn('Firestore updateBuildingRepInfo error:', err.message));
      }
      showToast(state.currentLang === 'en' ? "Representative contact updated!" : "Közös képviseleti elérhetőségek mentve!");
      return;
    }

    persistState(s => {
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === buildingId) {
          return {
            ...b,
            repName: repData.repName !== undefined ? repData.repName : b.repName,
            phone: repData.phone !== undefined ? repData.phone : b.phone,
            email: repData.email !== undefined ? repData.email : b.email,
            repOfficeHours: repData.repOfficeHours !== undefined ? repData.repOfficeHours : b.repOfficeHours,
            repAddress: repData.repAddress !== undefined ? repData.repAddress : b.repAddress
          };
        }
        return b;
      });

      let updatedCurrentUser = s.currentUser;
      if (s.currentUser && (s.currentUser.role === 'admin' || s.currentUser.role === 'superadmin')) {
        updatedCurrentUser = {
          ...s.currentUser,
          name: repData.repName || s.currentUser.name,
          email: repData.email || s.currentUser.email
        };
      }

      return {
        ...s,
        buildings: updatedBuildings,
        currentUser: updatedCurrentUser
      };
    });
    showToast(state.currentLang === 'en' ? "Representative contact updated!" : "Közös képviseleti elérhetőségek mentve!");
  };

  // Update Building Master Data (Name, Tax Number, Default Bank, etc.)
  const updateBuildingData = (buildingId, data) => {
    if (!requireAdmin()) return;
    const sanitizedData = { ...(data || {}) };
    if (sanitizedData.bankApi && typeof sanitizedData.bankApi === 'object') {
      const { apiKey, clientSecret, secretKey, ...safeBankApi } = sanitizedData.bankApi;
      sanitizedData.bankApi = safeBankApi;
    }

    if (IS_FIRESTORE_MODE) {
      const targetId = buildingId || state.currentBuildingId || state.buildings?.[0]?.id;
      if (targetId) {
        const fsUpdate = {};
        if (sanitizedData.name !== undefined) fsUpdate.name = sanitizedData.name;
        if (sanitizedData.address !== undefined) fsUpdate.address = sanitizedData.address;
        if (sanitizedData.taxNumber !== undefined) fsUpdate.taxNumber = sanitizedData.taxNumber;
        if (sanitizedData.defaultBank !== undefined) fsUpdate.defaultBank = sanitizedData.defaultBank;
        if (sanitizedData.bankApi !== undefined) fsUpdate.bankApi = sanitizedData.bankApi;
        if (Object.keys(fsUpdate).length > 0) {
          updateBuildingMetadata(targetId, fsUpdate)
            .then(() => typeof reloadCurrentBuilding === 'function' && reloadCurrentBuilding(targetId))
            .catch(err => console.warn('Firestore updateBuildingData error:', err.message));
        }
      }
      if (sanitizedData.name !== undefined || sanitizedData.taxNumber !== undefined) {
        showToast(state.currentLang === 'en' ? "Building data updated!" : "A ház adatai sikeresen elmentve!");
      }
      return;
    }

    persistState(s => {
      const targetId = buildingId || s.currentBuildingId || (s.buildings && s.buildings[0] && s.buildings[0].id);
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === targetId) {
          return {
            ...b,
            ...sanitizedData,
            name: sanitizedData.name !== undefined ? sanitizedData.name : b.name,
            taxNumber: sanitizedData.taxNumber !== undefined ? sanitizedData.taxNumber : b.taxNumber,
            defaultBank: sanitizedData.defaultBank !== undefined ? sanitizedData.defaultBank : b.defaultBank
          };
        }
        return b;
      });

      return {
        ...s,
        buildings: updatedBuildings
      };
    });
    if (sanitizedData.name !== undefined || sanitizedData.taxNumber !== undefined) {
      showToast(state.currentLang === 'en' ? "Building data updated!" : "A ház adatai sikeresen elmentve!");
    }
  };

  // Save Info Sections for active building
  const saveInfoSections = (sections) => {
    if (!requireAdmin()) return;
    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      if (!buildingId) return;
      (async () => {
        try {
          const prevIds = new Set((state.infoSections || []).map(s => s?.id).filter(Boolean));
          const nextList = Array.isArray(sections) ? sections : [];
          const nextIds = new Set(nextList.map(s => s?.id).filter(Boolean));

          for (const sec of nextList) {
            if (!sec || !sec.id) continue;
            const cleanItems = [];
            for (const it of (Array.isArray(sec.items) ? sec.items : [])) {
              const atts = await uploadAttachmentsToStorage(
                buildingId,
                `infoAttachments/${sec.id}`,
                it.attachments || []
              );
              cleanItems.push({ ...it, attachments: atts });
            }
            const cleanDocs = await uploadAttachmentsToStorage(
              buildingId,
              `infoAttachments/${sec.id}`,
              sec.documents || []
            );
            await saveBuildingInfoSection(buildingId, sec.id, {
              ...sec,
              items: cleanItems,
              documents: cleanDocs,
            });
          }

          for (const oldId of prevIds) {
            if (!nextIds.has(oldId)) {
              await deleteBuildingInfoSection(buildingId, oldId);
            }
          }
          if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
        } catch (err) {
          console.warn('Firestore saveInfoSections error:', err.message);
        }
      })();
      return;
    }

    persistState(s => {
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === s.currentBuildingId) {
          return {
            ...b,
            infoSections: sections
          };
        }
        return b;
      });

      return {
        ...s,
        infoSections: sections,
        buildings: updatedBuildings
      };
    });
  };

  // Helper: build critical Owner notification if a staff colleague modifies bank account numbers
  const buildStaffBankChangeNotifIfNeeded = (prevBuilding, nextBankKK, nextBankFA, nextCustomAccounts) => {
    const orgCtx = resolveUserOrgContext(state.currentUser, state.organizations, state.buildings);
    if (!orgCtx.isStaff) return null;
    const changes = detectBankAccountChanges(prevBuilding, nextBankKK, nextBankFA, nextCustomAccounts);
    if (!changes.length) return null;
    const ownerOrg = orgCtx.org || findOrganizationForBuilding(prevBuilding, state.organizations);
    const ownerEmail = orgCtx.ownerEmail || ownerOrg?.ownerEmail || '';
    if (!ownerEmail) return null;
    return buildBankChangeNotification({
      actorUser: state.currentUser,
      ownerEmail,
      building: prevBuilding,
      changes,
    });
  };

  // Update building bank accounts (bankKK, bankFA, and customBankAccounts)
  const updateBuildingBankAccounts = (buildingId, { bankKK, bankFA, customBankAccounts }) => {
    if (!requireAdmin()) return;
    const targetId = buildingId || state.currentBuildingId || state.buildings?.[0]?.id;
    const curB = (state.buildings || []).find(b => b.id === targetId);
    const bankChanges = curB ? detectBankAccountChanges(curB, bankKK, bankFA, customBankAccounts) : [];
    if (bankChanges.length > 0 && !canUserEditBankAccountNumbers(state.currentUser, curB, state.organizations, state.buildings)) {
      showToast(
        t.team_bank_account_locked_error || (state.currentLang === 'en'
          ? "You do not have permission to change bank account numbers. Ask the owner to enable this permission."
          : "Nincs jogosultságod a bankszámlaszám módosítására. Ehhez a tulajdonos jóváhagyása szükséges."),
        "error"
      );
      return;
    }

    const criticalNotif = curB ? buildStaffBankChangeNotifIfNeeded(curB, bankKK, bankFA, customBankAccounts) : null;

    if (IS_FIRESTORE_MODE) {
      if (targetId) {
        updateBuildingMetadata(targetId, {
          bankAccounts: {
            KK: bankKK !== undefined ? bankKK : curB?.bankKK,
            FA: bankFA !== undefined ? bankFA : curB?.bankFA,
            custom: customBankAccounts !== undefined ? customBankAccounts : (curB?.customBankAccounts || []),
          }
        })
          .then(() => typeof reloadCurrentBuilding === 'function' && reloadCurrentBuilding(targetId))
          .catch(err => console.warn('Firestore updateBuildingBankAccounts error:', err.message));
      }
      showToast(t.account_updated_success || (state.currentLang === 'en' ? "Bank accounts updated!" : "Bankszámlák sikeresen frissítve!"));
      return;
    }

    persistState(s => {
      const resolvedId = buildingId || s.currentBuildingId || (s.buildings && s.buildings[0] && s.buildings[0].id);
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === resolvedId) {
          return {
            ...b,
            bankKK: bankKK !== undefined ? bankKK : b.bankKK,
            bankFA: bankFA !== undefined ? bankFA : b.bankFA,
            customBankAccounts: customBankAccounts !== undefined ? customBankAccounts : (b.customBankAccounts || [])
          };
        }
        return b;
      });

      return {
        ...s,
        buildings: updatedBuildings,
        notifications: criticalNotif ? [criticalNotif, ...(s.notifications || [])].slice(0, 300) : (s.notifications || []),
      };
    });
    showToast(t.account_updated_success || (state.currentLang === 'en' ? "Bank accounts updated!" : "Bankszámlák sikeresen frissítve!"));
  };

  // Add a new custom bank account to building
  const addCustomBankAccount = (buildingId, newAccount) => {
    if (!requireAdmin()) return null;
    const targetId = buildingId || state.currentBuildingId || state.buildings?.[0]?.id;
    const curB = (state.buildings || []).find(b => b.id === targetId);
    if (!canUserEditBankAccountNumbers(state.currentUser, curB, state.organizations, state.buildings)) {
      showToast(
        t.team_bank_account_locked_error || (state.currentLang === 'en'
          ? "You do not have permission to change bank account numbers. Ask the owner to enable this permission."
          : "Nincs jogosultságod a bankszámlaszám módosítására. Ehhez a tulajdonos jóváhagyása szükséges."),
        "error"
      );
      return null;
    }

    const accountWithId = {
      id: newAccount.id || `acc-${Date.now()}`,
      name: newAccount.name.trim(),
      shortName: newAccount.shortName ? newAccount.shortName.trim() : (newAccount.name.length > 5 ? newAccount.name.slice(0, 4) : newAccount.name),
      account: newAccount.account ? newAccount.account.trim() : '',
      bank: newAccount.bank ? newAccount.bank.trim() : 'OTP',
      beneficiary: newAccount.beneficiary ? newAccount.beneficiary.trim() : '',
      hasMonthlyFee: Boolean(newAccount.hasMonthlyFee),
      initialReserve: Number(newAccount.initialReserve) || 0,
      color: newAccount.color || 'emerald'
    };

    const nextCustomList = [...(curB?.customBankAccounts || []), accountWithId];
    const criticalNotif = curB ? buildStaffBankChangeNotifIfNeeded(curB, curB.bankKK, curB.bankFA, nextCustomList) : null;

    if (IS_FIRESTORE_MODE) {
      if (targetId) {
        updateBuildingMetadata(targetId, {
          bankAccounts: {
            KK: curB?.bankKK,
            FA: curB?.bankFA,
            custom: nextCustomList,
          }
        })
          .then(() => typeof reloadCurrentBuilding === 'function' && reloadCurrentBuilding(targetId))
          .catch(err => console.warn('Firestore addCustomBankAccount error:', err.message));
      }
      showToast(t.account_added_success || (state.currentLang === 'en' ? "New account added!" : "Új számla sikeresen hozzáadva!"));
      return accountWithId;
    }

    persistState(s => {
      const resolvedId = buildingId || s.currentBuildingId || (s.buildings && s.buildings[0] && s.buildings[0].id);
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === resolvedId) {
          const currentList = b.customBankAccounts || [];
          return {
            ...b,
            customBankAccounts: [...currentList, accountWithId]
          };
        }
        return b;
      });

      return {
        ...s,
        buildings: updatedBuildings,
        notifications: criticalNotif ? [criticalNotif, ...(s.notifications || [])].slice(0, 300) : (s.notifications || []),
      };
    });
    showToast(t.account_added_success || (state.currentLang === 'en' ? "New account added!" : "Új számla sikeresen hozzáadva!"));
    return accountWithId;
  };

  // Delete a custom bank account from building
  const deleteCustomBankAccount = (buildingId, accountId) => {
    if (!requireAdmin()) return;
    const targetId = buildingId || state.currentBuildingId || state.buildings?.[0]?.id;
    const curB = (state.buildings || []).find(b => b.id === targetId);
    if (!canUserEditBankAccountNumbers(state.currentUser, curB, state.organizations, state.buildings)) {
      showToast(
        t.team_bank_account_locked_error || (state.currentLang === 'en'
          ? "You do not have permission to change bank account numbers. Ask the owner to enable this permission."
          : "Nincs jogosultságod a bankszámlaszám módosítására. Ehhez a tulajdonos jóváhagyása szükséges."),
        "error"
      );
      return;
    }

    const updatedCustom = (curB?.customBankAccounts || []).filter(a => a.id !== accountId);
    const criticalNotif = curB ? buildStaffBankChangeNotifIfNeeded(curB, curB.bankKK, curB.bankFA, updatedCustom) : null;

    if (IS_FIRESTORE_MODE) {
      if (targetId) {
        updateBuildingMetadata(targetId, {
          bankAccounts: {
            KK: curB?.bankKK,
            FA: curB?.bankFA,
            custom: updatedCustom,
          }
        })
          .then(() => typeof reloadCurrentBuilding === 'function' && reloadCurrentBuilding(targetId))
          .catch(err => console.warn('Firestore deleteCustomBankAccount error:', err.message));
      }
      showToast(t.account_deleted_success || (state.currentLang === 'en' ? "Account deleted!" : "Számla törölve!"));
      return;
    }

    persistState(s => {
      const resolvedId = buildingId || s.currentBuildingId || (s.buildings && s.buildings[0] && s.buildings[0].id);
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === resolvedId) {
          return {
            ...b,
            customBankAccounts: (b.customBankAccounts || []).filter(a => a.id !== accountId)
          };
        }
        return b;
      });

      return {
        ...s,
        buildings: updatedBuildings,
        notifications: criticalNotif ? [criticalNotif, ...(s.notifications || [])].slice(0, 300) : (s.notifications || []),
      };
    });
    showToast(t.account_deleted_success || (state.currentLang === 'en' ? "Account deleted!" : "Számla törölve!"));
  };

  return {
    switchBuilding,
    addFlat,
    deleteFlat,
    saveFlatMaster,
    uploadDocument,
    uploadDocumentsBatch,
    updateDocument,
    moveDocument,
    moveExplorerItems,
    duplicateExplorerItems,
    deleteDocument,
    deleteExplorerItems,
    fetchDocumentFile,
    createDocFolder,
    updateDocFolder,
    deleteDocFolder,
    addBuilding,
    deleteBuilding,
    toggleGridEditMode,
    updateBuildingRepInfo,
    updateBuildingData,
    saveInfoSections,
    updateBuildingBankAccounts,
    addCustomBankAccount,
    deleteCustomBankAccount
  };
}
