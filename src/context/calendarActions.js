import { getPermanentVault, savePermanentVault } from './syncEngine';
import { IS_FIRESTORE_MODE } from '../constants/firebaseConfig';
import { saveBuildingCalendarEvent, deleteBuildingCalendarEvent } from '../services/firestoreService';

function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return Object.values(val);
  return [];
}

export function createCalendarActions({ state, persistState, showToast, t }) {
  const requireAdmin = () => {
    if (state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'superadmin')) {
      return true;
    }
    showToast(
      t.error_unauthorized || (state.currentLang === 'en' ? "Unauthorized action." : "Nincs jogosultságod ehhez a művelethez."),
      "error"
    );
    return false;
  };

  const resolveEventBuildingId = (evBuildingId) => {
    if (evBuildingId && evBuildingId !== 'all') return evBuildingId;
    return state.currentBuildingId || state.buildings?.[0]?.id || null;
  };

  // Add new calendar event or task
  const addCalendarEvent = (eventData) => {
    if (!requireAdmin()) return null;
    const isEn = state.currentLang === 'en';
    const newEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      buildingId: eventData.buildingId || state.currentBuildingId || 'all',
      title: (eventData.title || '').trim(),
      description: (eventData.description || '').trim(),
      date: eventData.date || new Date().toISOString().slice(0, 10),
      time: eventData.time || '',
      category: eventData.category || 'task', // 'assembly' | 'maintenance' | 'financial' | 'task'
      priority: eventData.priority || 'normal', // 'normal' | 'high'
      isDone: false,
      visibility: eventData.visibility === 'admin' ? 'admin' : 'building',
      createdAt: new Date().toISOString()
    };

    if (IS_FIRESTORE_MODE) {
      const targetBId = resolveEventBuildingId(newEvent.buildingId);
      if (targetBId) {
        saveBuildingCalendarEvent(targetBId, newEvent.id, { ...newEvent, buildingId: targetBId }).catch((err) => {
          console.warn('Firestore saveBuildingCalendarEvent error:', err.message);
        });
      }
    }

    persistState(s => {
      const current = ensureArray(s.calendarEvents);
      return {
        ...s,
        calendarEvents: [...current, newEvent]
      };
    }, true);

    showToast(t.calendar_save_success || (isEn ? "Event saved successfully!" : "Esemény sikeresen elmentve!"));
    return newEvent;
  };

  // Update existing calendar event
  const updateCalendarEvent = (eventData) => {
    if (!requireAdmin()) return;
    const isEn = state.currentLang === 'en';
    if (!eventData || !eventData.id) return;

    const existing = ensureArray(state.calendarEvents).find(ev => ev && ev.id === eventData.id);
    const mergedEvent = existing
      ? {
          ...existing,
          ...eventData,
          title: (eventData.title !== undefined ? eventData.title : existing.title).trim(),
          description: (eventData.description !== undefined ? eventData.description : existing.description).trim(),
          lastModified: new Date().toISOString()
        }
      : null;

    if (IS_FIRESTORE_MODE && mergedEvent) {
      const targetBId = resolveEventBuildingId(mergedEvent.buildingId);
      if (targetBId) {
        saveBuildingCalendarEvent(targetBId, mergedEvent.id, { ...mergedEvent, buildingId: targetBId }).catch((err) => {
          console.warn('Firestore updateCalendarEvent error:', err.message);
        });
      }
    }

    persistState(s => {
      const current = ensureArray(s.calendarEvents);
      return {
        ...s,
        calendarEvents: current.map(ev => (ev && ev.id === eventData.id && mergedEvent ? mergedEvent : ev))
      };
    }, true);

    showToast(t.calendar_save_success || (isEn ? "Event updated!" : "Esemény frissítve!"));
  };

  // Delete calendar event
  const deleteCalendarEvent = (eventId) => {
    if (!requireAdmin()) return;
    const isEn = state.currentLang === 'en';
    if (!eventId) return;

    if (IS_FIRESTORE_MODE) {
      const existing = ensureArray(state.calendarEvents).find(ev => ev && ev.id === eventId);
      const targetBId = resolveEventBuildingId(existing?.buildingId);
      if (targetBId) {
        deleteBuildingCalendarEvent(targetBId, eventId).catch((err) => {
          console.warn('Firestore deleteCalendarEvent error:', err.message);
        });
      }
    } else {
      // Legacy RTDB: add to permanent vault tombstones to prevent resurrecting from cloud
      try {
        const vault = getPermanentVault();
        vault.deletedIds = Array.from(new Set([...(vault.deletedIds || []), eventId]));
        savePermanentVault(vault);
      } catch (e) {}
    }

    persistState(s => {
      const current = ensureArray(s.calendarEvents);
      return {
        ...s,
        calendarEvents: current.filter(ev => ev && ev.id !== eventId)
      };
    }, true);

    showToast(t.calendar_delete_success || (isEn ? "Event deleted!" : "Esemény törölve!"));
  };

  // Toggle isDone status
  const toggleCalendarEventDone = (eventId) => {
    if (!requireAdmin()) return;
    if (!eventId) return;

    if (IS_FIRESTORE_MODE) {
      const existing = ensureArray(state.calendarEvents).find(ev => ev && ev.id === eventId);
      if (existing) {
        const targetBId = resolveEventBuildingId(existing.buildingId);
        if (targetBId) {
          saveBuildingCalendarEvent(targetBId, eventId, { ...existing, isDone: !existing.isDone, buildingId: targetBId }).catch((err) => {
            console.warn('Firestore toggleCalendarEventDone error:', err.message);
          });
        }
      }
    }

    persistState(s => {
      const current = ensureArray(s.calendarEvents);
      return {
        ...s,
        calendarEvents: current.map(ev => {
          if (ev && ev.id === eventId) {
            return { ...ev, isDone: !ev.isDone };
          }
          return ev;
        })
      };
    }, true);
  };

  return {
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    toggleCalendarEventDone
  };
}
