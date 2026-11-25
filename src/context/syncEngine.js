import { 
  DEFAULT_BUILDINGS, 
  DEFAULT_USERS, 
  DEFAULT_DOCUMENTS, 
  DEFAULT_INFO_SECTIONS, 
  DEFAULT_CALENDAR_EVENTS,
  DEFAULT_REP_PROFILE,
  DEFAULT_GLOBAL_SETTINGS
} from '../constants/defaultData.js';
import { DEFAULT_DUNNING_RULES } from '../utils/dunningRules.js';
import { IS_FIRESTORE_MODE } from '../constants/firebaseConfig.js';
import { purgeSensitiveLocalStorage } from '../services/firestoreAdapter.js';
import { recalculateFlatBalances } from '../utils/finances.js';

export function stripSensitiveUserFields(user) {
  if (!user || typeof user !== 'object') return user;
  const { pass, password, resetToken, resetTokenExpiry, ...safeUser } = user;
  return safeUser;
}

export function stripSensitiveBuildingFields(buildings) {
  if (!Array.isArray(buildings)) return [];
  return buildings.map(b => {
    if (!b || typeof b !== 'object') return b;
    const cleanB = { ...b };
    if (cleanB.bankApi && typeof cleanB.bankApi === 'object') {
      const { apiKey, clientSecret, secretKey, ...safeBankApi } = cleanB.bankApi;
      cleanB.bankApi = safeBankApi;
    }
    if (Array.isArray(cleanB.flats)) {
      cleanB.flats = cleanB.flats.map(f => {
        if (!f || typeof f !== 'object') return f;
        const { pass, password, resetToken, resetTokenExpiry, ...safeFlat } = f;
        return safeFlat;
      });
    }
    return cleanB;
  });
}

export function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return Object.values(val);
  return [];
}

export function getPermanentVault() {
  try {
    const raw = localStorage.getItem("tarsashaz_permanent_vault");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { deletedIds: [], deletedFlatNums: [], lastUpdated: 0 };
}

export function savePermanentVault(vault) {
  try {
    vault.lastUpdated = Date.now();
    localStorage.setItem("tarsashaz_permanent_vault", JSON.stringify(vault));
  } catch (e) {}
}

export function mergeStateWithCloud(local, cloud) {
  if (!cloud) return local;

  // Clean slate client (e.g. freshly opened incognito or new device with zero edits)
  const isLocalCleanSlate = !local || !local.buildings || local.buildings.length === 0 || 
    ((Number(local.revision) || 0) === 0 && (Number(local.lastUpdated) || 0) === 0);

  if (isLocalCleanSlate) {
    const res = JSON.parse(JSON.stringify(cloud));
    res.users = (res.users || []).map(stripSensitiveUserFields);
    res.buildings = stripSensitiveBuildingFields(res.buildings || []);
    const curB = (res.buildings || []).find(b => b.id === (res.currentBuildingId || local?.currentBuildingId)) || res.buildings?.[0];
    if (curB) {
      res.currentBuildingId = curB.id;
      res.flats = curB.flats || [];
      res.transactions = curB.transactions || cloud.transactions || [];
      res.expenses = curB.expenses || cloud.expenses || [];
      res.manualDebits = curB.manualDebits || cloud.manualDebits || [];
      res.documents = curB.documents || cloud.documents || [];
      res.docFolders = curB.docFolders || cloud.docFolders || [];
      res.loans = curB.loans || cloud.loans || [];
      res.infoSections = curB.infoSections || cloud.infoSections || [];
      res.buildingInitialReserveCommon = curB.buildingInitialReserveCommon !== undefined ? curB.buildingInitialReserveCommon : (cloud.buildingInitialReserveCommon || 0);
      res.buildingInitialReserveRenovation = curB.buildingInitialReserveRenovation !== undefined ? curB.buildingInitialReserveRenovation : (cloud.buildingInitialReserveRenovation || 0);

      curB.flats = res.flats;
      curB.transactions = res.transactions;
      curB.expenses = res.expenses;
      curB.manualDebits = res.manualDebits;
      curB.documents = res.documents;
      curB.docFolders = res.docFolders;
      curB.loans = res.loans;
      curB.infoSections = res.infoSections;
      curB.buildingInitialReserveCommon = res.buildingInitialReserveCommon;
      curB.buildingInitialReserveRenovation = res.buildingInitialReserveRenovation;
      recalculateFlatBalances(res);
    }
    res.calendarEvents = ensureArray(cloud.calendarEvents).length > 0
      ? ensureArray(cloud.calendarEvents)
      : JSON.parse(JSON.stringify(DEFAULT_CALENDAR_EVENTS || []));
    res.organizations = ensureArray(cloud.organizations);
    res.notifications = ensureArray(cloud.notifications);
    res.currentLang = local?.currentLang || 'hu';
    res.currentUser = local?.currentUser ? stripSensitiveUserFields(local.currentUser) : null;
    res.isGridEditMode = local?.isGridEditMode || false;
    return res;
  }

  // Bidirectional lossless entity union (CRDT-style)
  // Guarantees NO item added locally or in cloud is EVER lost during concurrent usage!
  const localRev = Number(local.revision) || 0;
  const cloudRev = Number(cloud.revision) || 0;
  const localTime = Number(local.lastUpdated) || 0;
  const cloudTime = cloud.lastUpdated ? (new Date(cloud.lastUpdated).getTime() || 0) : 0;

  // Primary authoritative rule:
  // If cloudRev >= localRev: Cloud revision is newer or equal (authoritative)
  // If localRev > cloudRev: Local machine has uncommitted offline user edits
  const isCloudAuthoritative = cloudRev >= localRev;

  // 1. Permanent Vault (Tombstones for deletions)
  const localVault = getPermanentVault();
  const cloudVault = cloud.vault || {};
  const mergedVault = {
    deletedIds: Array.from(new Set([...(localVault.deletedIds || []), ...(cloudVault.deletedIds || [])])),
    deletedFlatNums: Array.from(new Set([...(localVault.deletedFlatNums || []), ...(cloudVault.deletedFlatNums || [])])),
    lastUpdated: Math.max(localVault.lastUpdated || 0, cloudVault.lastUpdated ? (new Date(cloudVault.lastUpdated).getTime() || 0) : 0)
  };
  savePermanentVault(mergedVault);

  const deletedTxIds = new Set(mergedVault.deletedIds || []);
  const deletedFlatNums = new Set(mergedVault.deletedFlatNums || []);

  const merged = JSON.parse(JSON.stringify(local));

  // Helper to merge an array of items by unique ID without losing any additions
  const mergeItemArray = (rawLocal = [], rawCloud = [], idKey = 'id') => {
    const localArr = ensureArray(rawLocal);
    const cloudArr = ensureArray(rawCloud);
    const resultMap = new Map();

    // 1. Add all valid local items
    localArr.forEach(lItem => {
      if (!lItem || !lItem[idKey]) return;
      const idVal = String(lItem[idKey]).trim();
      if (deletedTxIds.has(idVal)) return;
      resultMap.set(idVal, { ...lItem });
    });

    // 2. Merge cloud items
    cloudArr.forEach(cItem => {
      if (!cItem || !cItem[idKey]) return;
      const idVal = String(cItem[idKey]).trim();
      if (deletedTxIds.has(idVal)) return;

      if (!resultMap.has(idVal)) {
        // New item from cloud (added by another user/device) -> keep it!
        resultMap.set(idVal, { ...cItem });
      } else {
        // Item exists in both! Authoritative version wins
        const lItem = resultMap.get(idVal);
        if (isCloudAuthoritative) {
          resultMap.set(idVal, { ...lItem, ...cItem });
        } else {
          resultMap.set(idVal, { ...cItem, ...lItem });
        }
      }
    });

    return Array.from(resultMap.values());
  };

  // Helper to merge flats
  const mergeFlatsArray = (localFlats = [], cloudFlats = []) => {
    const flatMap = new Map();

    (localFlats || []).forEach(lf => {
      if (!lf || !lf.flatNum) return;
      const fNum = String(lf.flatNum).trim();
      if (deletedFlatNums.has(fNum)) return;
      flatMap.set(fNum, { ...lf });
    });

    (cloudFlats || []).forEach(cf => {
      if (!cf || !cf.flatNum) return;
      const fNum = String(cf.flatNum).trim();
      if (deletedFlatNums.has(fNum)) return;

      if (!flatMap.has(fNum)) {
        flatMap.set(fNum, { ...cf });
      } else {
        const lf = flatMap.get(fNum);
        const mergedCancelled = Array.from(new Set([
          ...(lf.cancelledDebits || []),
          ...(cf.cancelledDebits || [])
        ]));

        if (isCloudAuthoritative) {
          flatMap.set(fNum, { ...lf, ...cf, cancelledDebits: mergedCancelled });
        } else {
          flatMap.set(fNum, { ...cf, ...lf, cancelledDebits: mergedCancelled });
        }
      }
    });

    return Array.from(flatMap.values());
  };

  // 2. Merge users (strictly stripping any legacy plaintext passwords or reset tokens)
  if (cloud.users && Array.isArray(cloud.users)) {
    const userMap = new Map();
    (merged.users || []).forEach(lu => {
      if (!lu) return;
      const key = lu.id || (lu.email ? `${lu.email.toLowerCase().trim()}_${lu.role}` : null);
      if (key) userMap.set(key, stripSensitiveUserFields({ ...lu }));
    });

    cloud.users.forEach(cu => {
      if (!cu) return;
      const key = cu.id || (cu.email ? `${cu.email.toLowerCase().trim()}_${cu.role}` : null);
      if (!key) return;
      const safeCu = stripSensitiveUserFields({ ...cu });
      if (!userMap.has(key)) {
        userMap.set(key, safeCu);
      } else {
        const lu = userMap.get(key);
        userMap.set(key, isCloudAuthoritative ? { ...lu, ...safeCu } : { ...safeCu, ...lu });
      }
    });

    merged.users = Array.from(userMap.values());
  }

  // 3. Merge buildings
  if (cloud.buildings && Array.isArray(cloud.buildings)) {
    const mergedBuildings = [...(merged.buildings || [])];

    cloud.buildings.forEach(cb => {
      if (!cb) return;
      const bIndex = mergedBuildings.findIndex(b => b && b.id === cb.id);
      if (bIndex >= 0) {
        const mb = { ...mergedBuildings[bIndex] };

        // Entity collections: merge without dropping ANY items
        mb.flats = mergeFlatsArray(mb.flats || [], cb.flats || []);
        mb.transactions = mergeItemArray(mb.transactions || [], cb.transactions || []);
        mb.expenses = mergeItemArray(mb.expenses || [], cb.expenses || []);
        mb.manualDebits = mergeItemArray(mb.manualDebits || [], cb.manualDebits || []);
        mb.documents = mergeItemArray(mb.documents || [], cb.documents || []);
        mb.docFolders = mergeItemArray(mb.docFolders || [], cb.docFolders || []);
        mb.loans = mergeItemArray(mb.loans || [], cb.loans || []);

        if (isCloudAuthoritative) {
          // Cloud is strictly newer or equal: adopt cloud reserves and metadata!
          if (cb.buildingInitialReserveCommon !== undefined) {
            mb.buildingInitialReserveCommon = cb.buildingInitialReserveCommon;
          }
          if (cb.buildingInitialReserveRenovation !== undefined) {
            mb.buildingInitialReserveRenovation = cb.buildingInitialReserveRenovation;
          }
          if (cb.name !== undefined) mb.name = cb.name;
          if (cb.address !== undefined) mb.address = cb.address;
          if (cb.taxNumber !== undefined) mb.taxNumber = cb.taxNumber;
          if (cb.repName !== undefined) mb.repName = cb.repName;
          if (cb.phone !== undefined) mb.phone = cb.phone;
          if (cb.email !== undefined) mb.email = cb.email;
          if (cb.repOfficeHours !== undefined) mb.repOfficeHours = cb.repOfficeHours;
          if (cb.repAddress !== undefined) mb.repAddress = cb.repAddress;
          if (cb.organizationId !== undefined) mb.organizationId = cb.organizationId;
          if (cb.contactDisplayMode !== undefined) mb.contactDisplayMode = cb.contactDisplayMode;
          if (cb.managerContact !== undefined) mb.managerContact = cb.managerContact;
          if (cb.bankKK !== undefined) mb.bankKK = cb.bankKK;
          if (cb.bankFA !== undefined) mb.bankFA = cb.bankFA;
          if (cb.customBankAccounts !== undefined) mb.customBankAccounts = cb.customBankAccounts;
          if (cb.bankApi !== undefined) mb.bankApi = cb.bankApi;
          if (cb.infoSections !== undefined) mb.infoSections = cb.infoSections;
          mb.lastUpdated = cb.lastUpdated || cloudTime;
        } else {
          // Local is strictly newer (localRev > cloudRev): preserve local reserves!
          if ((mb.buildingInitialReserveCommon === undefined || mb.buildingInitialReserveCommon === 0) && cb.buildingInitialReserveCommon) {
            mb.buildingInitialReserveCommon = cb.buildingInitialReserveCommon;
          }
          if ((mb.buildingInitialReserveRenovation === undefined || mb.buildingInitialReserveRenovation === 0) && cb.buildingInitialReserveRenovation) {
            mb.buildingInitialReserveRenovation = cb.buildingInitialReserveRenovation;
          }
        }

        mergedBuildings[bIndex] = mb;
      } else {
        mergedBuildings.push(cb);
      }
    });

    merged.buildings = stripSensitiveBuildingFields(mergedBuildings);
  }

  // 4. Update active building shortcut pointers
  const curB = (merged.buildings || []).find(b => b.id === (merged.currentBuildingId || local.currentBuildingId)) || merged.buildings?.[0];
  if (curB) {
    merged.currentBuildingId = curB.id;
    merged.flats = curB.flats || [];
    merged.transactions = curB.transactions || [];
    merged.expenses = curB.expenses || [];
    merged.manualDebits = curB.manualDebits || [];
    merged.documents = curB.documents || [];
    merged.docFolders = curB.docFolders || [];
    merged.loans = curB.loans || [];
    merged.infoSections = curB.infoSections || [];
    merged.buildingInitialReserveCommon = curB.buildingInitialReserveCommon !== undefined ? curB.buildingInitialReserveCommon : (cloud.buildingInitialReserveCommon || 0);
    merged.buildingInitialReserveRenovation = curB.buildingInitialReserveRenovation !== undefined ? curB.buildingInitialReserveRenovation : (cloud.buildingInitialReserveRenovation || 0);
    recalculateFlatBalances(merged);
  }

  // 5. Merge calendar events across buildings
  const localCalEvents = ensureArray(local.calendarEvents);
  const cloudCalEvents = ensureArray(cloud.calendarEvents);
  merged.calendarEvents = mergeItemArray(
    localCalEvents.length > 0 ? localCalEvents : JSON.parse(JSON.stringify(DEFAULT_CALENDAR_EVENTS || [])), 
    cloudCalEvents
  );

  // 6. Merge organizations (authoritative version wins per org to prevent resurrecting offboarded staff)
  merged.organizations = mergeItemArray(
    ensureArray(local.organizations),
    ensureArray(cloud.organizations)
  );

  // 7. Merge notifications (monotonic read/dismissed flags so read alerts never flicker back)
  const rawMergedNotifs = mergeItemArray(
    ensureArray(local.notifications),
    ensureArray(cloud.notifications)
  );
  const localNotifMap = new Map(ensureArray(local.notifications).filter(n => n?.id).map(n => [String(n.id), n]));
  const cloudNotifMap = new Map(ensureArray(cloud.notifications).filter(n => n?.id).map(n => [String(n.id), n]));
  const seenNotifDedupeKeys = new Set();
  merged.notifications = rawMergedNotifs
    .map(n => {
      const ln = localNotifMap.get(String(n.id));
      const cn = cloudNotifMap.get(String(n.id));
      return {
        ...n,
        read: Boolean(n.read || ln?.read || cn?.read),
        dismissed: Boolean(n.dismissed || ln?.dismissed || cn?.dismissed),
      };
    })
    .filter(n => {
      if (!n) return false;
      // Do NOT deduplicate manual team permission updates or bank changes across the day
      if (n.type === 'team_updated' || n.type === 'bank_account_changed') {
        return true;
      }
      // Deduplicate identical alerts for the same recipient, building, title and date
      const dayStr = (n.createdAt || '').slice(0, 10);
      const key = `${n.type || 'info'}_${n.buildingId || ''}_${n.titleHu || n.titleEn || ''}_${n.recipientEmail || ''}_${dayStr}`;
      if (seenNotifDedupeKeys.has(key)) return false;
      seenNotifDedupeKeys.add(key);
      return true;
    });

  // 8. Merge email dunning rules (authoritative cloud wins when cloud is authoritative; deletedIds tombstone enforced)
  const cloudRules = Array.isArray(cloud.emailRules) ? cloud.emailRules : null;
  const localRules = Array.isArray(local.emailRules) ? local.emailRules : null;

  if (cloudRules && localRules) {
    // Preserve local lastAutoDispatchedDate only if both have a date and local is strictly newer
    cloudRules.forEach(cr => {
      const lr = localRules.find(r => r && r.id === cr.id);
      if (lr && lr.lastAutoDispatchedDate && cr.lastAutoDispatchedDate && lr.lastAutoDispatchedDate > cr.lastAutoDispatchedDate) {
        cr.lastAutoDispatchedDate = lr.lastAutoDispatchedDate;
        cr.lastAutoDispatchedAt = lr.lastAutoDispatchedAt || cr.lastAutoDispatchedAt;
        cr.lastAutoDispatchedCount = lr.lastAutoDispatchedCount !== undefined ? lr.lastAutoDispatchedCount : cr.lastAutoDispatchedCount;
      }
    });
  }

  let mergedRules;
  if (isCloudAuthoritative && cloudRules !== null) {
    // Cloud is authoritative: respect cloud state directly (including deletions)
    mergedRules = cloudRules;
  } else if (!isCloudAuthoritative && localRules !== null) {
    // Local has pending uncommitted offline edits
    mergedRules = localRules;
  } else {
    // Fallback union
    mergedRules = mergeItemArray(
      ensureArray(localRules || DEFAULT_DUNNING_RULES),
      ensureArray(cloudRules || DEFAULT_DUNNING_RULES)
    );
  }

  // Strictly filter out any deleted rule IDs present in tombstones
  merged.emailRules = (mergedRules || []).filter(r => r && r.id && !deletedTxIds.has(String(r.id)));

  // 9. Merge email outbox / logs
  merged.emailOutbox = mergeItemArray(
    ensureArray(local.emailOutbox),
    ensureArray(cloud.emailOutbox)
  ).slice(0, 500);

  merged.buildings = stripSensitiveBuildingFields(merged.buildings || []);
  merged.users = (merged.users || []).map(stripSensitiveUserFields);

  merged.currentLang = local.currentLang || 'hu';
  merged.currentUser = local.currentUser ? stripSensitiveUserFields(local.currentUser) : null;
  merged.isGridEditMode = local.isGridEditMode || false;
  merged.lastUpdated = isCloudAuthoritative ? (cloudTime || localTime) : Math.max(localTime, cloudTime);
  merged.revision = Math.max(localRev, cloudRev);
  merged.repProfile = {
    ...DEFAULT_REP_PROFILE,
    ...(cloud.repProfile || {}),
    ...(local.repProfile || {})
  };
  merged.globalSettings = {
    ...DEFAULT_GLOBAL_SETTINGS,
    ...(cloud.globalSettings || {}),
    ...(local.globalSettings || {})
  };

  return merged;
}

export function loadInitialState() {
  const defaultState = {
    currentLang: 'hu',
    currentUser: null,
    currentBuildingId: null,
    buildings: JSON.parse(JSON.stringify(DEFAULT_BUILDINGS)),
    users: JSON.parse(JSON.stringify(DEFAULT_USERS)),
    flats: [],
    transactions: [],
    expenses: [],
    manualDebits: [],
    documents: [],
    docFolders: [],
    loans: [],
    infoSections: [],
    buildingInitialReserveCommon: 0,
    buildingInitialReserveRenovation: 0,
    calendarEvents: JSON.parse(JSON.stringify(DEFAULT_CALENDAR_EVENTS || [])),
    organizations: [],
    notifications: [],
    emailRules: JSON.parse(JSON.stringify(DEFAULT_DUNNING_RULES)),
    emailOutbox: [],
    repProfile: JSON.parse(JSON.stringify(DEFAULT_REP_PROFILE)),
    globalSettings: JSON.parse(JSON.stringify(DEFAULT_GLOBAL_SETTINGS)),
    activeRoleMode: null,
    isPortfolioView: false,
    revision: 0,
    lastUpdated: 0,
    isGridEditMode: false,
    impersonatedFrom: null
  };

  // In Cloud Firestore mode: NEVER cache or load financial/PII state from localStorage.
  // Firebase Auth manages session persistence; React hydrates scoped data directly from Firestore.
  if (IS_FIRESTORE_MODE) {
    purgeSensitiveLocalStorage();
    try {
      const savedLang = localStorage.getItem('tarsashaz_lang');
      if (savedLang === 'en' || savedLang === 'hu') {
        defaultState.currentLang = savedLang;
      }
      const soundPref = localStorage.getItem('tarsashaz_sound_effects');
      if (soundPref === 'false') {
        defaultState.globalSettings.soundEffectsEnabled = false;
      }
    } catch (e) {}
    return defaultState;
  }

  try {
    const raw = localStorage.getItem("tarsashaz_state");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.buildings && parsed.buildings.length > 0) {
        defaultState.currentLang = parsed.currentLang || 'hu';
        defaultState.currentBuildingId = parsed.currentBuildingId || null;
        defaultState.buildings = stripSensitiveBuildingFields(parsed.buildings);
        defaultState.users = parsed.users && parsed.users.length > 0
          ? parsed.users.map(stripSensitiveUserFields)
          : defaultState.users;
        if (parsed.calendarEvents) {
          const parsedCal = ensureArray(parsed.calendarEvents);
          if (parsedCal.length > 0) {
            defaultState.calendarEvents = parsedCal;
          }
        }
        if (parsed.organizations) {
          defaultState.organizations = ensureArray(parsed.organizations);
        }
        if (parsed.notifications) {
          defaultState.notifications = ensureArray(parsed.notifications);
        }
        if (parsed.emailRules && Array.isArray(parsed.emailRules) && parsed.emailRules.length > 0) {
          defaultState.emailRules = parsed.emailRules;
        }
        if (parsed.emailOutbox && Array.isArray(parsed.emailOutbox)) {
          defaultState.emailOutbox = parsed.emailOutbox;
        }
        defaultState.activeRoleMode = parsed.activeRoleMode || localStorage.getItem("tarsashaz_role_mode") || null;
        defaultState.isPortfolioView = parsed.isPortfolioView !== undefined ? parsed.isPortfolioView : (localStorage.getItem("tarsashaz_is_portfolio") === "true");
        defaultState.revision = parsed.revision || 0;
        defaultState.lastUpdated = parsed.lastUpdated || 0;
        if (parsed.repProfile) {
          defaultState.repProfile = {
            ...DEFAULT_REP_PROFILE,
            ...parsed.repProfile
          };
        }
        if (parsed.globalSettings) {
          defaultState.globalSettings = {
            ...DEFAULT_GLOBAL_SETTINGS,
            ...parsed.globalSettings
          };
        }
      }
    }
  } catch (e) {
    console.warn("Could not load from LocalStorage:", e);
  }

  // Restore session user from current tab first (tab-isolated multi-account support), then fallback to remember-me user
  try {
    const sessionUserRaw = sessionStorage.getItem("tarsashaz_session_user");
    const isTabSession = sessionStorage.getItem("tarsashaz_is_tab_session") === "true";
    if (sessionUserRaw) {
      defaultState.currentUser = stripSensitiveUserFields(JSON.parse(sessionUserRaw));
    } else if (!isTabSession) {
      const rememberMe = localStorage.getItem("tarsashaz_remember_me") === "true";
      const loggedInUserRaw = localStorage.getItem("tarsashaz_logged_in_user");
      if (rememberMe && loggedInUserRaw) {
        defaultState.currentUser = stripSensitiveUserFields(JSON.parse(loggedInUserRaw));
      }
    }
  } catch (e) {}

  // Sync active building shortcut pointers
  const curB = defaultState.buildings.find(b => b.id === defaultState.currentBuildingId) || defaultState.buildings[0];
  if (curB) {
    defaultState.currentBuildingId = curB.id;
    defaultState.flats = curB.flats || [];
    defaultState.transactions = curB.transactions || [];
    defaultState.expenses = curB.expenses || [];
    defaultState.manualDebits = curB.manualDebits || [];
    defaultState.documents = curB.documents || [];
    defaultState.docFolders = curB.docFolders || [];
    defaultState.loans = curB.loans || [];
    defaultState.infoSections = curB.infoSections || [];
    defaultState.buildingInitialReserveCommon = curB.buildingInitialReserveCommon || 0;
    defaultState.buildingInitialReserveRenovation = curB.buildingInitialReserveRenovation || 0;
    recalculateFlatBalances(defaultState);
  }

  return defaultState;
}

export function sanitizeForFirebase(data) {
  if (data === undefined) return null;
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirebase(item));
  }
  const result = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      result[key] = sanitizeForFirebase(val);
    }
  }
  return result;
}

export function stripLargeBinaries(buildings, options = {}) {
  const { stripInlineAttachments = false } = options;
  if (!Array.isArray(buildings)) return [];
  const stripAttList = (list) =>
    Array.isArray(list)
      ? list.map(item => {
          if (!item || !Array.isArray(item.attachments)) return item;
          return {
            ...item,
            attachments: item.attachments.map(att => {
              if (!att || typeof att !== 'object') return att;
              if (att.data || att.fileData) {
                const { data, fileData, ...rest } = att;
                return { ...rest, hasFile: true };
              }
              return att;
            }),
          };
        })
      : list;

  return buildings.map(b => {
    if (!b) return b;
    const cleanB = { ...b };
    if (Array.isArray(cleanB.documents)) {
      cleanB.documents = cleanB.documents.map(d => {
        if (!d) return d;
        if (d.fileData) {
          const { fileData, ...rest } = d;
          return { ...rest, hasFile: true };
        }
        return d;
      });
    }
    if (Array.isArray(cleanB.infoSections)) {
      cleanB.infoSections = cleanB.infoSections.map(sec => {
        if (!sec) return sec;
        const cleanSec = { ...sec };
        if (stripInlineAttachments && Array.isArray(cleanSec.documents)) {
          cleanSec.documents = cleanSec.documents.map(d => {
            if (!d) return d;
            if (d.fileData) {
              const { fileData, ...rest } = d;
              return { ...rest, hasFile: true };
            }
            return d;
          });
        }
        if (Array.isArray(cleanSec.items)) {
          cleanSec.items = cleanSec.items.map(item => {
            if (!item) return item;
            const cleanItem = { ...item };
            if (Array.isArray(cleanItem.attachments)) {
              cleanItem.attachments = cleanItem.attachments.map(att => {
                if (!att) return att;
                if (att.fileData) {
                  const { fileData, ...rest } = att;
                  return { ...rest, hasFile: true };
                }
                return att;
              });
            }
            return cleanItem;
          });
        }
        return cleanSec;
      });
    }
    if (stripInlineAttachments) {
      cleanB.transactions = stripAttList(cleanB.transactions);
      cleanB.expenses = stripAttList(cleanB.expenses);
      cleanB.manualDebits = stripAttList(cleanB.manualDebits);
    }
    return cleanB;
  });
}

export function createCloudPayload(targetState) {
  if (!targetState) return null;
  const activeB = (targetState.buildings || []).find(b => b.id === targetState.currentBuildingId) || (targetState.buildings && targetState.buildings[0]);
  const cleanBuildings = stripSensitiveBuildingFields(stripLargeBinaries(targetState.buildings || []));
  const safeUsers = (targetState.users || []).map(stripSensitiveUserFields);

  const reserveCommon = targetState.buildingInitialReserveCommon !== undefined 
    ? targetState.buildingInitialReserveCommon 
    : (activeB?.buildingInitialReserveCommon || 0);
  const reserveRenov = targetState.buildingInitialReserveRenovation !== undefined 
    ? targetState.buildingInitialReserveRenovation 
    : (activeB?.buildingInitialReserveRenovation || 0);

  if (cleanBuildings && cleanBuildings.length > 0) {
    const cleanActiveB = cleanBuildings.find(b => b.id === (targetState.currentBuildingId || activeB?.id)) || cleanBuildings[0];
    if (cleanActiveB) {
      cleanActiveB.buildingInitialReserveCommon = reserveCommon;
      cleanActiveB.buildingInitialReserveRenovation = reserveRenov;
      cleanActiveB.lastUpdated = targetState.lastUpdated || Date.now();
    }
  }

  return sanitizeForFirebase({
    buildings: cleanBuildings,
    users: safeUsers,
    calendarEvents: targetState.calendarEvents || [],
    organizations: targetState.organizations || [],
    notifications: (targetState.notifications || []).slice(0, 300),
    emailRules: targetState.emailRules || DEFAULT_DUNNING_RULES,
    emailOutbox: (targetState.emailOutbox || []).slice(0, 300),
    repProfile: targetState.repProfile || DEFAULT_REP_PROFILE,
    globalSettings: targetState.globalSettings || DEFAULT_GLOBAL_SETTINGS,
    vault: getPermanentVault(),
    currentBuildingId: targetState.currentBuildingId || (activeB ? activeB.id : null),
    buildingInitialReserveCommon: reserveCommon,
    buildingInitialReserveRenovation: reserveRenov,
    revision: Number(targetState.revision) || 0,
    lastUpdated: new Date().toISOString()
  });
}
