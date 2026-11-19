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
import { sanitizeFileName } from '../utils/fileSecurity';

export function createBuildingActions({ state, setState, persistState, showToast, t, reloadCurrentBuilding, hydrateAndSwitchBuilding }) {
  const isAdmin = () => Boolean(
    state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'superadmin')
  );

  const requireAdmin = () => {
    if (isAdmin()) return true;
    showToast(
      t.error_unauthorized || (state.currentLang === 'en' ? "Unauthorized action." : "Nincs jogosultságod ehhez a művelethez."),
      "error"
    );
    return false;
  };

  // Switch Building
  const switchBuilding = (buildingId) => {
    const curB = (state.buildings || []).find(b => b.id === buildingId);
    if (!curB) return;
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
      if (buildingId && docId) {
        Promise.all([
          deleteBuildingDocument(buildingId, docId),
          existing?.storagePath ? deleteFromStorage(existing.storagePath) : Promise.resolve(),
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

  // Folder management: Delete Folder (Moves contained documents safely to root!)
  const deleteDocFolder = (folderId) => {
    if (!requireAdmin()) return;
    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      const updatedFolders = (state.docFolders || []).filter(f => f.id !== folderId);
      const affectedDocs = (state.documents || []).filter(d => d.folderId === folderId);
      if (buildingId) {
        Promise.all([
          updateBuildingMetadata(buildingId, { docFolders: updatedFolders }),
          ...affectedDocs.map(d => saveBuildingDocument(buildingId, d.id, { ...d, folderId: null })),
        ])
          .then(() => typeof reloadCurrentBuilding === 'function' && reloadCurrentBuilding(buildingId))
          .catch(err => console.warn('Firestore deleteDocFolder error:', err.message));
      }
      showToast(state.currentLang === 'en' ? "Folder deleted! Contained files moved to root." : "Mappa törölve! A dokumentumok a főkönyvtárba kerültek.");
      return;
    }

    persistState(s => {
      const targetBId = s.currentBuildingId;
      const updatedFolders = (s.docFolders || []).filter(f => f.id !== folderId);
      const updatedDocs = (s.documents || []).map(d => {
        if (d.folderId === folderId) {
          return { ...d, folderId: null };
        }
        return d;
      });
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === targetBId) {
          return {
            ...b,
            docFolders: updatedFolders,
            documents: updatedDocs
          };
        }
        return b;
      });
      return {
        ...s,
        buildings: updatedBuildings,
        docFolders: updatedFolders,
        documents: updatedDocs
      };
    });
    showToast(state.currentLang === 'en' ? "Folder deleted! Contained files moved to root." : "Mappa törölve! A dokumentumok a főkönyvtárba kerültek.");
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

  // Add Building
  const addBuilding = (newBuilding) => {
    if (!requireAdmin()) return;
    if (IS_FIRESTORE_MODE) {
      callProvisionBuilding({
        id: newBuilding?.id,
        name: newBuilding?.name,
        address: newBuilding?.address,
        taxNumber: newBuilding?.taxNumber,
        defaultBank: newBuilding?.defaultBank,
        repName: newBuilding?.repName,
        phone: newBuilding?.phone,
        email: newBuilding?.email,
        bankKK: newBuilding?.bankKK,
        bankFA: newBuilding?.bankFA,
        initialReserveKK: newBuilding?.buildingInitialReserveCommon || 0,
        initialReserveFA: newBuilding?.buildingInitialReserveRenovation || 0,
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

    persistState(s => ({
      ...s,
      buildings: [...(s.buildings || []), newBuilding],
      currentBuildingId: newBuilding.id,
      flats: newBuilding.flats || [],
      transactions: newBuilding.transactions || [],
      expenses: newBuilding.expenses || [],
      manualDebits: newBuilding.manualDebits || [],
      documents: newBuilding.documents || [],
      buildingInitialReserveCommon: newBuilding.buildingInitialReserveCommon || 0,
      buildingInitialReserveRenovation: newBuilding.buildingInitialReserveRenovation || 0
    }), true);
    showToast(state.currentLang === 'en' ? "Condominium created!" : "Új társasház sikeresen létrehozva!");
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

  // Update building bank accounts (bankKK, bankFA, and customBankAccounts)
  const updateBuildingBankAccounts = (buildingId, { bankKK, bankFA, customBankAccounts }) => {
    if (!requireAdmin()) return;
    if (IS_FIRESTORE_MODE) {
      const targetId = buildingId || state.currentBuildingId || state.buildings?.[0]?.id;
      const curB = (state.buildings || []).find(b => b.id === targetId);
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
      const targetId = buildingId || s.currentBuildingId || (s.buildings && s.buildings[0] && s.buildings[0].id);
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === targetId) {
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
        buildings: updatedBuildings
      };
    });
    showToast(t.account_updated_success || (state.currentLang === 'en' ? "Bank accounts updated!" : "Bankszámlák sikeresen frissítve!"));
  };

  // Add a new custom bank account to building
  const addCustomBankAccount = (buildingId, newAccount) => {
    if (!requireAdmin()) return null;
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

    if (IS_FIRESTORE_MODE) {
      const targetId = buildingId || state.currentBuildingId || state.buildings?.[0]?.id;
      const curB = (state.buildings || []).find(b => b.id === targetId);
      const updatedCustom = [...(curB?.customBankAccounts || []), accountWithId];
      if (targetId) {
        updateBuildingMetadata(targetId, {
          bankAccounts: {
            KK: curB?.bankKK,
            FA: curB?.bankFA,
            custom: updatedCustom,
          }
        })
          .then(() => typeof reloadCurrentBuilding === 'function' && reloadCurrentBuilding(targetId))
          .catch(err => console.warn('Firestore addCustomBankAccount error:', err.message));
      }
      showToast(t.account_added_success || (state.currentLang === 'en' ? "New account added!" : "Új számla sikeresen hozzáadva!"));
      return accountWithId;
    }

    persistState(s => {
      const targetId = buildingId || s.currentBuildingId || (s.buildings && s.buildings[0] && s.buildings[0].id);
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === targetId) {
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
        buildings: updatedBuildings
      };
    });
    showToast(t.account_added_success || (state.currentLang === 'en' ? "New account added!" : "Új számla sikeresen hozzáadva!"));
    return accountWithId;
  };

  // Delete a custom bank account from building
  const deleteCustomBankAccount = (buildingId, accountId) => {
    if (!requireAdmin()) return;
    if (IS_FIRESTORE_MODE) {
      const targetId = buildingId || state.currentBuildingId || state.buildings?.[0]?.id;
      const curB = (state.buildings || []).find(b => b.id === targetId);
      const updatedCustom = (curB?.customBankAccounts || []).filter(a => a.id !== accountId);
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
      const targetId = buildingId || s.currentBuildingId || (s.buildings && s.buildings[0] && s.buildings[0].id);
      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === targetId) {
          return {
            ...b,
            customBankAccounts: (b.customBankAccounts || []).filter(a => a.id !== accountId)
          };
        }
        return b;
      });

      return {
        ...s,
        buildings: updatedBuildings
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
    updateDocument,
    moveDocument,
    deleteDocument,
    fetchDocumentFile,
    createDocFolder,
    updateDocFolder,
    deleteDocFolder,
    addBuilding,
    toggleGridEditMode,
    updateBuildingRepInfo,
    updateBuildingData,
    saveInfoSections,
    updateBuildingBankAccounts,
    addCustomBankAccount,
    deleteCustomBankAccount
  };
}
