import { getPermanentVault, savePermanentVault } from './syncEngine';

function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return Object.values(val);
  return [];
}

export function createCalendarActions({ state, persistState, showToast, t }) {
  // Add new calendar event or task
  const addCalendarEvent = (eventData) => {
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
      createdAt: new Date().toISOString()
    };

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
    const isEn = state.currentLang === 'en';
    if (!eventData || !eventData.id) return;

    persistState(s => {
      const current = ensureArray(s.calendarEvents);
      return {
        ...s,
        calendarEvents: current.map(ev => {
          if (ev && ev.id === eventData.id) {
            return {
              ...ev,
              ...eventData,
              title: (eventData.title !== undefined ? eventData.title : ev.title).trim(),
              description: (eventData.description !== undefined ? eventData.description : ev.description).trim(),
              lastModified: new Date().toISOString()
            };
          }
          return ev;
        })
      };
    }, true);

    showToast(t.calendar_save_success || (isEn ? "Event updated!" : "Esemény frissítve!"));
  };

  // Delete calendar event
  const deleteCalendarEvent = (eventId) => {
    const isEn = state.currentLang === 'en';
    if (!eventId) return;

    // Add to permanent vault tombstones to prevent resurrecting from cloud
    try {
      const vault = getPermanentVault();
      vault.deletedIds = Array.from(new Set([...(vault.deletedIds || []), eventId]));
      savePermanentVault(vault);
    } catch (e) {}

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
    if (!eventId) return;

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
