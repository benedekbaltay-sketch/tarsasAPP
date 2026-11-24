import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Calendar as CalendarIcon, 
  List, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Building2, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Pencil, 
  FolderOpen, 
  FileSpreadsheet, 
  Wrench, 
  Landmark, 
  CheckSquare, 
  Square, 
  Filter,
  ArrowLeft,
  Info,
  Repeat,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useBackdropClose } from '../../utils/useBackdropClose';
import { getBudapestCalendarDate, getBudapestTodayYMD, subscribeServerClock } from '../../utils/serverClock';
import { NavLogoButton } from '../NavLogoButton';

function formatDateYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const EVENT_COLORS = [
  { id: 'blue', labelHu: 'Kék', labelEn: 'Blue', hex: '#2563EB', bg: 'bg-blue-50 text-blue-800 border-blue-200', dotBg: 'bg-blue-600' },
  { id: 'emerald', labelHu: 'Zöld', labelEn: 'Green', hex: '#059669', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', dotBg: 'bg-emerald-600' },
  { id: 'purple', labelHu: 'Lila', labelEn: 'Purple', hex: '#7C3AED', bg: 'bg-purple-50 text-purple-800 border-purple-200', dotBg: 'bg-purple-600' },
  { id: 'amber', labelHu: 'Narancs', labelEn: 'Orange', hex: '#D97706', bg: 'bg-amber-50 text-amber-800 border-amber-200', dotBg: 'bg-amber-600' },
  { id: 'rose', labelHu: 'Piros', labelEn: 'Red', hex: '#E11D48', bg: 'bg-rose-50 text-rose-800 border-rose-200', dotBg: 'bg-rose-600' },
  { id: 'cyan', labelHu: 'Ciánkék', labelEn: 'Cyan', hex: '#0891B2', bg: 'bg-cyan-50 text-cyan-800 border-cyan-200', dotBg: 'bg-cyan-600' },
  { id: 'indigo', labelHu: 'Indigó', labelEn: 'Indigo', hex: '#4F46E5', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200', dotBg: 'bg-indigo-600' },
  { id: 'slate', labelHu: 'Szürke', labelEn: 'Gray', hex: '#475569', bg: 'bg-slate-100 text-slate-800 border-slate-300', dotBg: 'bg-slate-600' }
];

export function getEventColorInfo(colorOrCategory, isEn = false) {
  let found = EVENT_COLORS.find(c => c.id === colorOrCategory);
  if (!found) {
    if (colorOrCategory === 'assembly') found = EVENT_COLORS.find(c => c.id === 'emerald');
    else if (colorOrCategory === 'maintenance') found = EVENT_COLORS.find(c => c.id === 'amber');
    else if (colorOrCategory === 'financial') found = EVENT_COLORS.find(c => c.id === 'purple');
    else found = EVENT_COLORS[0];
  }
  return {
    ...found,
    label: isEn ? found.labelEn : found.labelHu
  };
}

function formatLongDate(dateStr, isEn) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const dateObj = new Date(y, m - 1, d);
  if (isNaN(dateObj.getTime())) return dateStr;
  
  if (isEn) {
    const daysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${daysEn[dateObj.getDay()]}, ${monthsEn[m - 1]} ${d}, ${y}`;
  } else {
    const daysHu = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
    const monthsHu = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];
    return `${y}. ${monthsHu[m - 1]} ${d}., ${daysHu[dateObj.getDay()]}`;
  }
}

function getWeekdayName(dateStr, isEn) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return '';
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return '';
  const daysHu = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
  const daysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return isEn ? daysEn[d.getDay()] : daysHu[d.getDay()];
}

function getNthWeekdayInfo(dateStr, isEn) {
  if (!dateStr) return { nth: 1, nthDesc: '1.', weekday: '', dayOfMonth: 1, monthDayDesc: '' };
  const parts = dateStr.split('-');
  if (parts.length < 3) return { nth: 1, nthDesc: '1.', weekday: '', dayOfMonth: 1, monthDayDesc: '' };
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return { nth: 1, nthDesc: '1.', weekday: '', dayOfMonth: 1, monthDayDesc: '' };
  const dayOfMonth = d.getDate();
  const m = d.getMonth();
  const nth = Math.ceil(dayOfMonth / 7);
  const nthDescHu = `${nth}.`;
  const nthDescEn = nth === 1 ? 'first' : nth === 2 ? 'second' : nth === 3 ? 'third' : nth === 4 ? 'fourth' : 'fifth';
  const monthsHu = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];
  const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthDayDesc = isEn ? `${monthsEn[m]} ${dayOfMonth}` : `${monthsHu[m]} ${dayOfMonth}.`;
  return {
    nth,
    nthDesc: isEn ? nthDescEn : nthDescHu,
    weekday: getWeekdayName(dateStr, isEn),
    monthDayDesc,
    dayOfMonth
  };
}

function countOccurrencesUpTo(ev, targetDateStr) {
  if (!ev || !ev.date || !targetDateStr || targetDateStr < ev.date) return 0;
  if (!ev.customRecurrence) return 1;
  const cr = ev.customRecurrence;
  const interval = Math.max(1, Number(cr.interval) || 1);

  const [ey, em, ed] = ev.date.split('-').map(Number);
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const evDate = new Date(ey, em - 1, ed);
  const targetDate = new Date(ty, tm - 1, td);

  const diffDays = Math.round((targetDate - evDate) / (1000 * 60 * 60 * 24));
  const diffMonths = (ty - ey) * 12 + (tm - em);

  if (cr.unit === 'day') {
    return Math.floor(diffDays / interval) + 1;
  }
  if (cr.unit === 'month') {
    return Math.floor(diffMonths / interval) + 1;
  }
  if (cr.unit === 'year') {
    return Math.floor((ty - ey) / interval) + 1;
  }
  if (cr.unit === 'week') {
    const validDays = Array.isArray(cr.daysOfWeek) && cr.daysOfWeek.length > 0 
      ? cr.daysOfWeek 
      : [evDate.getDay()];
    
    let count = 0;
    let curr = new Date(evDate);
    const day = curr.getDay();
    const diffToMon = curr.getDate() - day + (day === 0 ? -6 : 1);
    curr.setDate(diffToMon);

    while (true) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(curr);
        d.setDate(curr.getDate() + i);
        const yStr = d.getFullYear();
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const dStr = String(d.getDate()).padStart(2, '0');
        const str = `${yStr}-${mStr}-${dStr}`;
        if (str >= ev.date && str <= targetDateStr) {
          if (validDays.includes(d.getDay())) {
            count++;
          }
        }
        if (str === targetDateStr) {
          return count;
        }
      }
      curr.setDate(curr.getDate() + interval * 7);
      const currStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
      if (currStr > targetDateStr) break;
    }
    return count;
  }
  return 1;
}

function isEventOnDate(ev, dateStr) {
  if (!ev || !ev.date || !dateStr) return false;
  if (dateStr < ev.date) return false;
  if (ev.recurrenceEndDate && dateStr > ev.recurrenceEndDate) return false;
  if (dateStr === ev.date) return true;
  if (!ev.recurrence || ev.recurrence === 'none') return false;

  const [ey, em, ed] = ev.date.split('-').map(Number);
  const [ty, tm, td] = dateStr.split('-').map(Number);
  const evDate = new Date(ey, em - 1, ed);
  const targetDate = new Date(ty, tm - 1, td);

  const diffDays = Math.round((targetDate - evDate) / (1000 * 60 * 60 * 24));
  const diffMonths = (ty - ey) * 12 + (tm - em);

  if (ev.recurrence === 'custom' && ev.customRecurrence) {
    const cr = ev.customRecurrence;
    const interval = Math.max(1, Number(cr.interval) || 1);

    // End condition: on_date
    if (cr.endType === 'on_date' && cr.endDate && dateStr > cr.endDate) {
      return false;
    }

    // End condition: after_count
    if (cr.endType === 'after_count' && cr.endCount) {
      const maxCount = Number(cr.endCount) || 1;
      const currentCount = countOccurrencesUpTo(ev, dateStr);
      if (currentCount > maxCount) return false;
    }

    if (cr.unit === 'day') {
      return diffDays % interval === 0;
    }

    if (cr.unit === 'week') {
      const targetDow = targetDate.getDay();
      const validDays = Array.isArray(cr.daysOfWeek) && cr.daysOfWeek.length > 0 
        ? cr.daysOfWeek 
        : [evDate.getDay()];
      
      if (!validDays.includes(targetDow)) return false;

      const getMonday = (d) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff));
      };
      const evMon = getMonday(evDate);
      const targetMon = getMonday(targetDate);
      const diffWeeks = Math.round((targetMon - evMon) / (7 * 24 * 60 * 60 * 1000));
      return diffWeeks >= 0 && diffWeeks % interval === 0;
    }

    if (cr.unit === 'month') {
      if (diffMonths < 0 || diffMonths % interval !== 0) return false;
      return td === ed;
    }

    if (cr.unit === 'year') {
      const diffYears = ty - ey;
      if (diffYears < 0 || diffYears % interval !== 0) return false;
      return tm === em && td === ed;
    }

    return false;
  }

  switch (ev.recurrence) {
    case 'daily': {
      const interval = Number(ev.recurrenceInterval) || 1;
      return diffDays % interval === 0;
    }
    case 'weekdays': {
      const dow = targetDate.getDay();
      return dow >= 1 && dow <= 5;
    }
    case 'weekly': {
      if (targetDate.getDay() !== evDate.getDay()) return false;
      const diffWeeks = Math.floor(diffDays / 7);
      const interval = Number(ev.recurrenceInterval) || 1;
      return diffWeeks % interval === 0;
    }
    case 'biweekly': {
      if (targetDate.getDay() !== evDate.getDay()) return false;
      const diffWeeks = Math.floor(diffDays / 7);
      return diffWeeks % 2 === 0;
    }
    case 'monthly_date': {
      if (td !== ed) return false;
      const interval = Number(ev.recurrenceInterval) || 1;
      return diffMonths >= 0 && diffMonths % interval === 0;
    }
    case 'monthly_nth_day': {
      if (targetDate.getDay() !== evDate.getDay()) return false;
      const evNth = Math.ceil(ed / 7);
      const targetNth = Math.ceil(td / 7);
      if (evNth !== targetNth) return false;
      const interval = Number(ev.recurrenceInterval) || 1;
      return diffMonths >= 0 && diffMonths % interval === 0;
    }
    case 'monthly_first_sunday': {
      if (targetDate.getDay() !== 0) return false;
      return td <= 7;
    }
    case 'quarterly': {
      if (td !== ed) return false;
      return diffMonths >= 0 && diffMonths % 3 === 0;
    }
    case 'semi_annually': {
      if (td !== ed) return false;
      return diffMonths >= 0 && diffMonths % 6 === 0;
    }
    case 'yearly': {
      return tm === em && td === ed;
    }
    default:
      return false;
  }
}

function getRecurrenceLabel(ev, isEn) {
  if (!ev || !ev.recurrence || ev.recurrence === 'none') {
    return isEn ? "Does not repeat" : "Nem ismétlődik";
  }

  if (ev.recurrence === 'custom' && ev.customRecurrence) {
    const cr = ev.customRecurrence;
    const interval = Number(cr.interval) || 1;
    let label = "";

    if (cr.unit === 'day') {
      label = interval === 1 
        ? (isEn ? "Daily" : "Naponta") 
        : (isEn ? `Every ${interval} days` : `Minden ${interval}. napon`);
    } else if (cr.unit === 'week') {
      const days = Array.isArray(cr.daysOfWeek) ? cr.daysOfWeek : [];
      const dayNamesEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayNamesHu = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
      const selectedNames = days.map(d => isEn ? dayNamesEn[d] : dayNamesHu[d]).join(', ');
      
      if (interval === 1) {
        label = isEn ? `Weekly on ${selectedNames}` : `Hetente (${selectedNames})`;
      } else {
        label = isEn ? `Every ${interval} weeks on ${selectedNames}` : `Minden ${interval}. héten (${selectedNames})`;
      }
    } else if (cr.unit === 'month') {
      label = interval === 1 
        ? (isEn ? "Monthly" : "Havonta") 
        : (isEn ? `Every ${interval} months` : `Minden ${interval}. hónapban`);
    } else if (cr.unit === 'year') {
      label = interval === 1 
        ? (isEn ? "Annually" : "Évente") 
        : (isEn ? `Every ${interval} years` : `Minden ${interval}. évben`);
    }

    if (cr.endType === 'on_date' && cr.endDate) {
      label += isEn ? `, until ${cr.endDate}` : `, eddig: ${cr.endDate}`;
    } else if (cr.endType === 'after_count' && cr.endCount) {
      label += isEn ? `, ${cr.endCount} times` : `, ${cr.endCount} alkalommal`;
    }
    return label || (isEn ? "Custom recurrence" : "Egyéni ismétlődés");
  }

  const nthInfo = getNthWeekdayInfo(ev.date, isEn);
  switch (ev.recurrence) {
    case 'daily':
      return isEn ? "Daily" : "Naponta";
    case 'weekly':
      return isEn ? `Weekly on ${nthInfo.weekday}` : `Hetente (${nthInfo.weekday})`;
    case 'monthly_nth_day':
      return isEn ? `Monthly on the ${nthInfo.nthDesc} ${nthInfo.weekday}` : `Havonta a ${nthInfo.nthDesc} ${nthInfo.weekday}n`;
    case 'yearly':
      return isEn ? `Annually on ${nthInfo.monthDayDesc}` : `Évente (${nthInfo.monthDayDesc})`;
    case 'weekdays':
      return isEn ? "Every weekday (Monday to Friday)" : "Minden hétköznap (hétfő–péntek)";
    case 'biweekly':
      return isEn ? `Every 2 weeks on ${nthInfo.weekday}` : `Kéthetente (${nthInfo.weekday})`;
    case 'monthly_date':
      return isEn ? `Monthly on day ${nthInfo.dayOfMonth}` : `Havonta (${nthInfo.dayOfMonth}. napon)`;
    case 'monthly_first_sunday':
      return isEn ? "Monthly on the 1st Sunday" : "Minden hónap 1. vasárnapján";
    case 'quarterly':
      return isEn ? "Every 3 months (Quarterly)" : "Minden 3. hónapban (negyedévente)";
    case 'semi_annually':
      return isEn ? "Every 6 months" : "Félévente (6 havonta)";
    default:
      return ev.recurrence;
  }
}

export function CalendarModal({ isOpen, onClose, initialBuildingId = null, isReadOnly = false }) {
  const { 
    state, 
    t, 
    addCalendarEvent, 
    updateCalendarEvent, 
    deleteCalendarEvent, 
    toggleCalendarEventDone 
  } = useApp();

  const { buildings, currentBuildingId, calendarEvents, currentLang, currentUser, users } = state;
  const isEn = currentLang === 'en';
  const isHu = !isEn;
  const userEmail = (currentUser?.email || "").toLowerCase().trim();
  const rawAdmin = (
    currentUser?.isAdminUser === true ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'superadmin' ||
    Boolean(userEmail && (users || []).some(u => u.email && u.email.toLowerCase().trim() === userEmail && (u.role === 'admin' || u.role === 'superadmin')))
  );
  const isAdmin = rawAdmin && !isReadOnly;

  // Guarantee calendarEvents is always a valid Array
  const safeCalendarEvents = useMemo(() => {
    if (Array.isArray(calendarEvents)) return calendarEvents;
    if (calendarEvents && typeof calendarEvents === 'object') return Object.values(calendarEvents);
    return [];
  }, [calendarEvents]);

  const backdropProps = useBackdropClose(onClose);

  // Active view states (anchored to authoritative Europe/Budapest server clock)
  const [clockSyncTick, setClockSyncTick] = useState(0);
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'day'
  const [currentDate, setCurrentDate] = useState(() => getBudapestCalendarDate());
  const [selectedDayStr, setSelectedDayStr] = useState(() => getBudapestTodayYMD());
  const [filterBuildingId, setFilterBuildingId] = useState(() => {
    return (typeof initialBuildingId === 'string' && initialBuildingId.trim()) ? initialBuildingId : 'all';
  });

  // Reactively re-anchor calendar when Firebase `.info/serverTimeOffset` finishes syncing
  useEffect(() => {
    return subscribeServerClock(() => {
      setClockSyncTick((n) => n + 1);
      setCurrentDate(getBudapestCalendarDate());
      setSelectedDayStr(getBudapestTodayYMD());
      setFormDate(getBudapestTodayYMD());
    });
  }, []);

  // Synchronize initialBuildingId & authoritative Budapest today whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setViewMode('month');
      const budapestTodayDate = getBudapestCalendarDate();
      const budapestTodayStr = getBudapestTodayYMD();
      setCurrentDate(budapestTodayDate);
      setSelectedDayStr(budapestTodayStr);
      setFormDate(budapestTodayStr);
      const validId = (typeof initialBuildingId === 'string' && initialBuildingId.trim()) ? initialBuildingId : 'all';
      setFilterBuildingId(validId);
    }
  }, [isOpen, initialBuildingId]);

  // Event modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [viewingEvent, setViewingEvent] = useState(null);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formBuildingId, setFormBuildingId] = useState(() => {
    return (typeof initialBuildingId === 'string' && initialBuildingId !== 'all') ? initialBuildingId : (currentBuildingId || (buildings?.[0]?.id || 'all'));
  });
  const [formColor, setFormColor] = useState('blue');
  const [formCategory, setFormCategory] = useState('assembly');
  const [formDate, setFormDate] = useState(() => getBudapestTodayYMD());
  const [formTime, setFormTime] = useState('18:00');
  const [formDesc, setFormDesc] = useState('');
  const [formRecurrence, setFormRecurrence] = useState('none');
  const [formRecurrenceEndDate, setFormRecurrenceEndDate] = useState('');

  // Google Calendar style custom recurrence states
  const [isRecurDropdownOpen, setIsRecurDropdownOpen] = useState(false);
  const [isCustomRecurOpen, setIsCustomRecurOpen] = useState(false);
  const [formCustomRecurrence, setFormCustomRecurrence] = useState(null);
  const [customInterval, setCustomInterval] = useState(1);
  const [customUnit, setCustomUnit] = useState('week');
  const [customDaysOfWeek, setCustomDaysOfWeek] = useState([3]);
  const [customEndType, setCustomEndType] = useState('never');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customEndCount, setCustomEndCount] = useState(13);
  const recurDropdownRef = useRef(null);

  useEffect(() => {
    if (isRecurDropdownOpen && recurDropdownRef.current) {
      recurDropdownRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isRecurDropdownOpen]);

  const toggleCustomDay = (dayId) => {
    setCustomDaysOfWeek(prev => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      if (arr.includes(dayId)) {
        if (arr.length <= 1) return arr;
        return arr.filter(d => d !== dayId);
      } else {
        return [...arr, dayId];
      }
    });
  };

  const currentRecurrenceDisplay = useMemo(() => {
    if (formRecurrence === 'custom' && formCustomRecurrence) {
      return getRecurrenceLabel({ recurrence: 'custom', customRecurrence: formCustomRecurrence }, isEn);
    }
    const nthInfo = getNthWeekdayInfo(formDate, isEn);
    switch (formRecurrence) {
      case 'none':
        return t.calendar_recur_none || (isEn ? "Does not repeat" : "Nem ismétlődik");
      case 'daily':
        return t.calendar_recur_daily || (isEn ? "Daily" : "Naponta");
      case 'weekly':
        return isEn ? `Weekly on ${nthInfo.weekday}` : `Hetente (${nthInfo.weekday})`;
      case 'monthly_nth_day':
        return isEn 
          ? `Monthly on the ${nthInfo.nthDesc} ${nthInfo.weekday}` 
          : `Havonta a ${nthInfo.nthDesc} ${nthInfo.weekday}n`;
      case 'yearly':
        return isEn ? `Annually on ${nthInfo.monthDayDesc}` : `Évente ekkor: ${nthInfo.monthDayDesc}`;
      case 'weekdays':
        return t.calendar_recur_weekdays || (isEn ? "Every weekday (Monday to Friday)" : "Minden hétköznap (hétfőtől péntekig)");
      default:
        return t.calendar_recur_none || (isEn ? "Does not repeat" : "Nem ismétlődik");
    }
  }, [formRecurrence, formCustomRecurrence, formDate, isEn, t]);

  const handleApplyCustomRecurrence = () => {
    let days = customDaysOfWeek;
    if (customUnit === 'week' && (!days || days.length === 0)) {
      const [y, m, d] = formDate.split('-').map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      days = [dow];
      setCustomDaysOfWeek(days);
    }

    const customObj = {
      interval: Math.max(1, Number(customInterval) || 1),
      unit: customUnit,
      daysOfWeek: customUnit === 'week' ? days : null,
      endType: customEndType,
      endDate: customEndType === 'on_date' ? customEndDate : null,
      endCount: customEndType === 'after_count' ? Math.max(1, Number(customEndCount) || 1) : null
    };

    setFormCustomRecurrence(customObj);
    setFormRecurrence('custom');
    if (customEndType === 'on_date') {
      setFormRecurrenceEndDate(customEndDate);
    } else {
      setFormRecurrenceEndDate('');
    }
    setIsCustomRecurOpen(false);
    setIsRecurDropdownOpen(false);
  };

  // Filter events based on active building
  const filteredEvents = safeCalendarEvents.filter(ev => {
    if (!ev) return false;
    if (filterBuildingId !== 'all' && ev.buildingId !== 'all' && ev.buildingId !== filterBuildingId) {
      return false;
    }
    return true;
  });

  // Color visual styles helper
  const getCategoryInfo = (categoryOrColor) => {
    const colInfo = getEventColorInfo(categoryOrColor, isEn);
    return {
      label: colInfo.label,
      bg: colInfo.bg,
      dotBg: colInfo.dotBg,
      icon: CheckSquare
    };
  };

  // Month navigation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNamesHu = [
    "Január", "Február", "Március", "Április", "Május", "Június",
    "Július", "Augusztus", "Szeptember", "Október", "November", "December"
  ];
  const monthNamesEn = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentMonthName = isEn ? monthNamesEn[month] : monthNamesHu[month];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = getBudapestCalendarDate();
    setCurrentDate(now);
    setSelectedDayStr(getBudapestTodayYMD());
  };

  const handlePrevDay = () => {
    if (!selectedDayStr) return;
    const parts = selectedDayStr.split('-').map(Number);
    const prevDate = new Date(parts[0], parts[1] - 1, parts[2] - 1);
    const newStr = formatDateYMD(prevDate);
    setSelectedDayStr(newStr);
    if (prevDate.getMonth() !== month || prevDate.getFullYear() !== year) {
      setCurrentDate(new Date(prevDate.getFullYear(), prevDate.getMonth(), 1));
    }
  };

  const handleNextDay = () => {
    if (!selectedDayStr) return;
    const parts = selectedDayStr.split('-').map(Number);
    const nextDate = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    const newStr = formatDateYMD(nextDate);
    setSelectedDayStr(newStr);
    if (nextDate.getMonth() !== month || nextDate.getFullYear() !== year) {
      setCurrentDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
  };

  // Week view dates calculation (Monday to Sunday)
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      days.push({
        date: dayDate,
        dateStr: formatDateYMD(dayDate),
        dayNum: dayDate.getDate(),
        monthNum: dayDate.getMonth(),
        year: dayDate.getFullYear(),
        dayOfWeek: i // 0: Mon, 1: Tue, ... 6: Sun
      });
    }
    return days;
  }, [currentDate]);

  const handlePrevWeek = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const weekRangeTitle = useMemo(() => {
    if (weekDays.length < 7) return '';
    const start = weekDays[0].date;
    const end = weekDays[6].date;
    const sMonth = isEn ? monthNamesEn[start.getMonth()] : monthNamesHu[start.getMonth()];
    const eMonth = isEn ? monthNamesEn[end.getMonth()] : monthNamesHu[end.getMonth()];
    if (start.getMonth() === end.getMonth()) {
      return isEn 
        ? `${sMonth} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`
        : `${start.getFullYear()}. ${sMonth} ${start.getDate()}. – ${end.getDate()}.`;
    } else {
      return isEn
        ? `${sMonth} ${start.getDate()} – ${eMonth} ${end.getDate()}, ${end.getFullYear()}`
        : `${start.getFullYear()}. ${sMonth} ${start.getDate()}. – ${eMonth} ${end.getDate()}.`;
    }
  }, [weekDays, isEn, monthNamesEn, monthNamesHu]);

  // Generate calendar days for month grid (Monday start)
  const calendarGridDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // In JS Sunday is 0, Monday is 1... Convert to Mon=0 ... Sun=6
    let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6;

    const days = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, dayNum);
      days.push({
        dayNum,
        dateStr: formatDateYMD(prevDate),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      days.push({
        dayNum: d,
        dateStr: formatDateYMD(curDate),
        isCurrentMonth: true
      });
    }

    // Next month padding days to complete full 7-day weeks
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let n = 1; n <= remainingCells; n++) {
      const nextDate = new Date(year, month + 1, n);
      days.push({
        dayNum: n,
        dateStr: formatDateYMD(nextDate),
        isCurrentMonth: false
      });
    }

    return days;
  }, [year, month]);

  // Open Form to Add Event
  const handleOpenAddEvent = (presetDate = null) => {
    if (!isAdmin) return;
    setEditingEvent(null);
    setFormTitle('');
    const targetBId = (filterBuildingId !== 'all' && filterBuildingId) ? filterBuildingId : (currentBuildingId || (buildings?.[0]?.id || 'all'));
    setFormBuildingId(targetBId);
    setFormColor('blue');
    setFormCategory('assembly');
    const initialDate = presetDate || selectedDayStr || getBudapestTodayYMD();
    setFormDate(initialDate);
    setFormTime('18:00');
    setFormDesc('');
    setFormRecurrence('none');
    setFormRecurrenceEndDate('');
    setFormCustomRecurrence(null);
    setIsRecurDropdownOpen(false);
    setIsCustomRecurOpen(false);
    setCustomInterval(1);
    setCustomUnit('week');
    const [iy, im, id] = initialDate.split('-').map(Number);
    const iDate = new Date(iy, im - 1, id);
    setCustomDaysOfWeek([iDate.getDay()]);
    setCustomEndType('never');
    const futureD = new Date(iDate);
    futureD.setMonth(futureD.getMonth() + 3);
    setCustomEndDate(formatDateYMD(futureD));
    setCustomEndCount(13);
    setIsFormOpen(true);
  };

  // Open Form to Edit Event
  const handleOpenEditEvent = (ev) => {
    if (!isAdmin) return;
    setEditingEvent(ev);
    setFormTitle(ev.title || '');
    setFormBuildingId(ev.buildingId || currentBuildingId || (buildings?.[0]?.id || 'all'));
    setFormColor(ev.color || (ev.category === 'assembly' ? 'emerald' : ev.category === 'maintenance' ? 'amber' : ev.category === 'financial' ? 'purple' : 'blue'));
    setFormCategory(ev.category || 'task');
    const evDateStr = ev.date || getBudapestTodayYMD();
    setFormDate(evDateStr);
    setFormTime(ev.time || '');
    setFormDesc(ev.description || '');
    setFormRecurrence(ev.recurrence || 'none');
    setFormRecurrenceEndDate(ev.recurrenceEndDate || '');
    setFormCustomRecurrence(ev.customRecurrence || null);
    setIsRecurDropdownOpen(false);
    setIsCustomRecurOpen(false);
    if (ev.customRecurrence) {
      const cr = ev.customRecurrence;
      setCustomInterval(Number(cr.interval) || 1);
      setCustomUnit(cr.unit || 'week');
      setCustomDaysOfWeek(Array.isArray(cr.daysOfWeek) && cr.daysOfWeek.length > 0 ? cr.daysOfWeek : [new Date(evDateStr).getDay()]);
      setCustomEndType(cr.endType || 'never');
      setCustomEndDate(cr.endDate || getBudapestTodayYMD());
      setCustomEndCount(Number(cr.endCount) || 13);
    } else {
      setCustomInterval(1);
      setCustomUnit('week');
      const [ey, em, ed] = evDateStr.split('-').map(Number);
      const eDate = new Date(ey, em - 1, ed);
      setCustomDaysOfWeek([eDate.getDay()]);
      setCustomEndType('never');
      const futureD = new Date(eDate);
      futureD.setMonth(futureD.getMonth() + 3);
      setCustomEndDate(formatDateYMD(futureD));
      setCustomEndCount(13);
    }
    setIsFormOpen(true);
  };

  // Save Event
  const handleSaveForm = (e) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const eventPayload = {
      title: formTitle,
      buildingId: formBuildingId,
      color: formColor,
      category: formColor,
      date: formDate,
      time: formTime,
      description: formDesc,
      recurrence: formRecurrence,
      customRecurrence: formRecurrence === 'custom' ? formCustomRecurrence : null,
      recurrenceEndDate: formRecurrence === 'custom' && formCustomRecurrence?.endType === 'on_date'
        ? (formCustomRecurrence.endDate || '')
        : (formRecurrenceEndDate || '')
    };

    if (editingEvent) {
      updateCalendarEvent({
        ...editingEvent,
        ...eventPayload
      });
    } else {
      addCalendarEvent(eventPayload);
    }

    setSelectedDayStr(formDate);
    setIsFormOpen(false);
  };

  // Events on the selected day (including matching recurring events)
  const selectedDayEvents = useMemo(() => {
    return filteredEvents.filter(ev => isEventOnDate(ev, selectedDayStr));
  }, [filteredEvents, selectedDayStr]);

  // Events occurring in the active week (Monday to Sunday)
  const weekEventsCount = useMemo(() => {
    let count = 0;
    for (const day of weekDays) {
      count += filteredEvents.filter(ev => isEventOnDate(ev, day.dateStr)).length;
    }
    return count;
  }, [weekDays, filteredEvents]);

  // Events occurring in the active month (only current month dates)
  const monthEventsCount = useMemo(() => {
    let count = 0;
    const currentMonthDays = calendarGridDays.filter(c => c.isCurrentMonth);
    for (const cell of currentMonthDays) {
      count += filteredEvents.filter(ev => isEventOnDate(ev, cell.dateStr)).length;
    }
    return count;
  }, [calendarGridDays, filteredEvents]);

  const todayStr = useMemo(() => getBudapestTodayYMD(), [clockSyncTick, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#F3F4F6] flex flex-col animate-fadeIn">
      
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-20 w-full shadow-xs bg-white border-b border-gray-200 px-3 sm:px-4 md:px-6 py-2">
        <div className="flex items-center justify-between gap-3">
          
          {/* Left: Back / NavLogoButton */}
          <div className="flex items-center gap-2.5 min-w-0">
            <NavLogoButton onClick={onClose} />
          </div>

          {/* Center: Module Title */}
          <div className="flex items-center gap-2 min-w-0 text-center">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center flex-shrink-0 shadow-2xs">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0 text-left sm:text-center">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 font-display truncate">
                {t.calendar_title || (isEn ? "Calendar & Tasks" : "Naptár és Feladatok")}
              </h2>
            </div>
          </div>

          {/* Right Actions: View Switcher, Add Event & Close */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-shrink-0">
            
            {/* View Mode Toggle: Month vs Week vs Day */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200">
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'month' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
                title={isEn ? "Month View" : "Havi nézet"}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.calendar_month_view || (isEn ? "Month" : "Havi")}</span>
              </button>

              <button
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'week' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
                title={isEn ? "Week View" : "Heti nézet"}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.calendar_week_view || (isEn ? "Week" : "Heti")}</span>
              </button>

              <button
                onClick={() => setViewMode('day')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'day' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
                title={isEn ? "Day View" : "Napi nézet"}
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.calendar_day_view || (isEn ? "Day" : "Napi")}</span>
              </button>
            </div>

            {isAdmin && (
              <button
                onClick={() => handleOpenAddEvent()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden md:inline">{t.calendar_new_event || (isEn ? "New Event" : "Új esemény")}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-all cursor-pointer"
              title="Bezárás"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 max-w-7xl mx-auto w-full flex flex-col min-h-0">
        
        {viewMode === 'day' ? (
          
          /* Dedicated Day View */
          <div className="space-y-3">
            
            {/* Top Navigation Bar: Date Navigators + Back to Month View + Building Selector in SAME ROW */}
            <div className="bg-white rounded-xl border border-gray-200 px-3 py-1.5 shadow-2xs flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              
              {/* Left Column: Navigators + Back to Month View */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <button
                  onClick={handlePrevDay}
                  className="p-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer flex items-center justify-center flex-shrink-0 active:scale-95"
                  title={t.calendar_prev_day || (isEn ? "Previous day" : "Előző nap")}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={handleNextDay}
                  className="p-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer flex items-center justify-center flex-shrink-0 active:scale-95"
                  title={t.calendar_next_day || (isEn ? "Next day" : "Következő nap")}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={handleToday}
                  className={`px-2 py-0.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer flex-shrink-0 ${
                    selectedDayStr === todayStr
                      ? 'bg-blue-50 border-blue-200 text-[#1E3A8A]'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {t.calendar_today || (isEn ? "Today" : "Ma")}
                </button>

                <div className="h-4 w-px bg-gray-200 mx-0.5 flex-shrink-0" />

                <button
                  onClick={() => setViewMode('month')}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 flex-shrink-0"
                >
                  <ArrowLeft className="w-3 h-3 text-[#1E3A8A]" />
                  <span className="hidden sm:inline">{t.calendar_back_to_month || (isEn ? "Month View" : "Havi nézet")}</span>
                  <span className="sm:hidden">{isEn ? "Month" : "Hónap"}</span>
                </button>
              </div>

              {/* Center Column: Date Title */}
              <div className="flex-1 text-center px-2 min-w-0">
                <h3 className="text-xs sm:text-sm md:text-base font-black text-gray-900 font-display capitalize truncate">
                  {formatLongDate(selectedDayStr, isEn)}
                </h3>
              </div>

              {/* Right Column: Building Selector & Add Event Button in the SAME row! */}
              <div className="flex items-center justify-end gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 font-semibold uppercase text-[10px] tracking-wider whitespace-nowrap hidden sm:inline">
                    {isEn ? "Building:" : "Társasház:"}
                  </span>
                  <select
                    value={filterBuildingId}
                    onChange={(e) => setFilterBuildingId(e.target.value)}
                    className="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1E3A8A] cursor-pointer"
                  >
                    <option value="all">{isEn ? "🌐 All Buildings" : "🌐 Minden társasház"}</option>
                    {(buildings || []).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                  {selectedDayEvents.length} {isEn ? "events" : "esemény"}
                </div>

                {isAdmin && (
                  <button
                    onClick={() => handleOpenAddEvent(selectedDayStr)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 flex-shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{isEn ? "+ Add event" : "+ Új esemény"}</span>
                    <span className="md:hidden">{isEn ? "+ Add" : "+ Új"}</span>
                  </button>
                )}
              </div>

            </div>

            {/* Day Events Container */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-xs">
              {selectedDayEvents.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 mx-auto flex items-center justify-center">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold text-gray-700">
                    {t.calendar_no_events_today || (isEn ? "No events recorded for this date." : "Nincs esemény rögzítve erre a napra.")}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleOpenAddEvent(selectedDayStr)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] text-xs font-bold transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isEn ? "Add first event" : "Első esemény rögzítése"}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayEvents.map(ev => {
                    const catInfo = getCategoryInfo(ev.color || ev.category);
                    const bObj = (buildings || []).find(b => b.id === ev.buildingId);

                    return (
                      <div
                        key={ev.id}
                        onDoubleClick={() => setViewingEvent(ev)}
                        className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer select-none group ${
                          ev.isDone 
                            ? 'bg-gray-50/70 border-gray-200 opacity-75' 
                            : 'bg-white border-gray-200 shadow-2xs hover:border-blue-300 hover:shadow-xs'
                        }`}
                        title={isEn ? "Double-click to open details" : "Dupla kattintással megnyitható"}
                      >
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCalendarEventDone(ev.id);
                              }}
                              className="mt-0.5 text-gray-400 hover:text-emerald-600 transition-colors cursor-pointer"
                              title={ev.isDone ? (isEn ? "Mark as pending" : "Visszaállítás nyitottra") : (isEn ? "Mark as done" : "Késznek jelölés")}
                            >
                              {ev.isDone ? (
                                <CheckSquare className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <Square className="w-5 h-5" />
                              )}
                            </button>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${catInfo.bg}`}>
                                {catInfo.label}
                              </span>

                              {ev.time && (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                  <Clock className="w-3 h-3 text-gray-500" />
                                  {ev.time}
                                </span>
                              )}

                              {bObj && (
                                <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded truncate max-w-[200px]">
                                  {bObj.name}
                                </span>
                              )}

                              {ev.recurrence && ev.recurrence !== 'none' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title={getRecurrenceLabel(ev, isEn)}>
                                  <Repeat className="w-2.5 h-2.5" />
                                  <span>{getRecurrenceLabel(ev, isEn)}</span>
                                </span>
                              )}
                            </div>

                            <h4 className={`text-sm sm:text-base font-bold text-gray-900 group-hover:text-[#1E3A8A] transition-colors ${
                              ev.isDone ? 'line-through text-gray-500' : ''
                            }`}>
                              {ev.title}
                            </h4>

                            {ev.description && (
                              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                {ev.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons on right */}
                        <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingEvent(ev);
                            }}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
                            title={isEn ? "View details" : "Részletek megtekintése"}
                          >
                            <Info className="w-4 h-4" />
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditEvent(ev);
                                }}
                                className="p-1.5 rounded-lg border border-gray-200 hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
                                title={t.calendar_edit_action || (isEn ? "Edit" : "Szerkesztés")}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(t.calendar_delete_confirm || "Biztosan törlöd ezt az eseményt?")) {
                                    deleteCalendarEvent(ev.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg border border-gray-200 hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
                                title={t.calendar_delete_action || (isEn ? "Delete" : "Törlés")}
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
        ) : viewMode === 'week' ? (
          
          /* Week View */
          <div className="space-y-3">
            {/* Week Header / Controls */}
            <div className="bg-white rounded-xl border border-gray-200 px-3 py-1.5 shadow-2xs flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevWeek}
                    className="p-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer active:scale-95"
                    title={isEn ? "Previous week" : "Előző hét"}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextWeek}
                    className="p-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer active:scale-95"
                    title={isEn ? "Next week" : "Következő hét"}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleToday}
                    className="px-2 py-0.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
                  >
                    {t.calendar_today || (isEn ? "Today" : "Ma")}
                  </button>
                </div>

                <h3 className="text-sm sm:text-base font-black text-gray-900 font-display">
                  {weekRangeTitle}
                </h3>
              </div>

              {/* Right: Building Selector & Event count in the SAME row! */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 font-semibold uppercase text-[10px] tracking-wider whitespace-nowrap">
                    {isEn ? "Building:" : "Társasház:"}
                  </span>
                  <select
                    value={filterBuildingId}
                    onChange={(e) => setFilterBuildingId(e.target.value)}
                    className="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1E3A8A] cursor-pointer"
                  >
                    <option value="all">{isEn ? "🌐 All Buildings" : "🌐 Minden társasház"}</option>
                    {(buildings || []).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                  {weekEventsCount} {isEn ? "events" : "esemény"}
                </div>
              </div>
            </div>

            {/* 7 Columns for the week */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
              {weekDays.map((day) => {
                const dayEvents = filteredEvents.filter(ev => isEventOnDate(ev, day.dateStr));
                const isToday = day.dateStr === todayStr;
                const weekdayLabelsHu = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];
                const weekdayLabelsEn = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                const dayName = isEn ? weekdayLabelsEn[day.dayOfWeek] : weekdayLabelsHu[day.dayOfWeek];

                return (
                  <div
                    key={day.dateStr}
                    className={`bg-white rounded-2xl border p-2.5 flex flex-col min-h-[140px] md:min-h-[360px] transition-all ${
                      isToday ? 'border-[#1E3A8A] ring-1 ring-[#1E3A8A]/30 shadow-xs' : 'border-gray-200 hover:border-gray-300 shadow-2xs'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                      <div>
                        <div className={`text-xs font-bold ${day.dayOfWeek >= 5 ? 'text-blue-600' : 'text-gray-700'}`}>
                          {dayName}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {isEn ? `${monthNamesEn[day.monthNum]} ${day.dayNum}` : `${monthNamesHu[day.monthNum]} ${day.dayNum}.`}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isToday ? 'bg-[#1E3A8A] text-white shadow-2xs' : 'text-gray-700 bg-gray-50'
                        }`}>
                          {day.dayNum}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenAddEvent(day.dateStr)}
                            className="w-6 h-6 rounded-full bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] flex items-center justify-center transition-colors cursor-pointer"
                            title={isEn ? "Add event" : "Új esemény"}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Events List in Week Column */}
                    <div className="flex-1 space-y-1.5 overflow-y-auto">
                      {dayEvents.length === 0 ? (
                        <div 
                          onClick={() => isAdmin && handleOpenAddEvent(day.dateStr)}
                          className="h-full flex items-center justify-center text-center text-[11px] text-gray-300 py-6 cursor-pointer hover:text-gray-400"
                        >
                          —
                        </div>
                      ) : (
                        dayEvents.map(ev => {
                          const col = getEventColorInfo(ev.color || ev.category, isEn);
                          return (
                            <div
                              key={ev.id}
                              onClick={() => setViewingEvent(ev)}
                              className={`p-2 rounded-xl border text-xs font-medium cursor-pointer transition-all hover:shadow-xs select-none ${col.bg} ${
                                ev.isDone ? 'opacity-60 line-through' : ''
                              }`}
                              title={isEn ? "Click to view details" : "Kattints a részletekhez"}
                            >
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                {ev.time && (
                                  <span className="font-bold text-[10px] opacity-80 flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    {ev.time}
                                  </span>
                                )}
                                {ev.recurrence && ev.recurrence !== 'none' && (
                                  <Repeat className="w-2.5 h-2.5 opacity-80" />
                                )}
                              </div>
                              <div className="font-bold truncate text-[11px] leading-snug">
                                {ev.title}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        ) : (
          
          /* Month Grid View (Default) */
          <div className="flex-1 flex flex-col space-y-2 min-h-0">
            
            {/* Month Header / Controls */}
            <div className="bg-white rounded-xl border border-gray-200 px-3 py-1.5 shadow-2xs flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              
              {/* Left: Navigators & Month Year title */}
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer active:scale-95"
                    title={isEn ? "Previous month" : "Előző hónap"}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer active:scale-95"
                    title={isEn ? "Next month" : "Következő hónap"}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleToday}
                    className="px-2 py-0.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
                  >
                    {t.calendar_today || (isEn ? "Today" : "Ma")}
                  </button>
                </div>

                <h3 className="text-sm sm:text-base font-black text-gray-900 font-display">
                  {currentMonthName} {year}
                </h3>
              </div>

              {/* Right: Building Selector & Event count in the SAME row! */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 font-semibold uppercase text-[10px] tracking-wider whitespace-nowrap">
                    {isEn ? "Building:" : "Társasház:"}
                  </span>
                  <select
                    value={filterBuildingId}
                    onChange={(e) => setFilterBuildingId(e.target.value)}
                    className="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1E3A8A] cursor-pointer"
                  >
                    <option value="all">{isEn ? "🌐 All Buildings" : "🌐 Minden társasház"}</option>
                    {(buildings || []).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                  {monthEventsCount} {isEn ? "events" : "esemény"}
                </div>
              </div>
            </div>

            {/* Days of Week Header & Day Cells Grid */}
            <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden min-h-0">
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/70 text-center text-[10px] sm:text-[11px] font-bold text-gray-500 py-1.5 uppercase tracking-wider shrink-0">
                <div>{isEn ? "Mon" : "Hét"}</div>
                <div>{isEn ? "Tue" : "Kedd"}</div>
                <div>{isEn ? "Wed" : "Sze"}</div>
                <div>{isEn ? "Thu" : "Csüt"}</div>
                <div>{isEn ? "Fri" : "Pén"}</div>
                <div className="text-blue-600">{isEn ? "Sat" : "Szo"}</div>
                <div className="text-red-600">{isEn ? "Sun" : "Vas"}</div>
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-gray-100 bg-gray-50 flex-1 min-h-0">
                {calendarGridDays.map((cell, idx) => {
                  const dayEvents = filteredEvents.filter(ev => isEventOnDate(ev, cell.dateStr));
                  const isToday = cell.dateStr === todayStr;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDayStr(cell.dateStr);
                        if (!cell.isCurrentMonth) {
                          const parts = cell.dateStr.split('-');
                          setCurrentDate(new Date(Number(parts[0]), Number(parts[1]) - 1, 1));
                        }
                        if (isAdmin) {
                          handleOpenAddEvent(cell.dateStr);
                        } else {
                          setViewMode('day');
                        }
                      }}
                      className={`min-h-[44px] sm:min-h-[50px] md:min-h-[56px] lg:min-h-[62px] p-1 sm:p-1.5 transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
                        cell.isCurrentMonth ? 'bg-white' : 'bg-gray-50/60 text-gray-400'
                      } hover:bg-blue-50/30 group`}
                      title={isAdmin ? (isEn ? "Click to record event" : "Kattints esemény rögzítéséhez") : (isEn ? "Click to view day events" : "Kattints a napi események megtekintéséhez")}
                    >
                      {/* Day Number Header */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center ${
                          isToday 
                            ? 'bg-[#1E3A8A] text-white shadow-2xs' 
                            : (cell.isCurrentMonth ? 'text-gray-900' : 'text-gray-400')
                        }`}>
                          {cell.dayNum}
                        </span>

                        {dayEvents.length > 0 && (
                          <span className="hidden sm:inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-[#1E3A8A] text-[10px] font-bold">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      {/* Event Pill Preview on Date */}
                      <div className="space-y-0.5 mt-0.5 overflow-hidden">
                        {dayEvents.slice(0, 2).map(ev => {
                          const col = getEventColorInfo(ev.color || ev.category, isEn);
                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingEvent(ev);
                              }}
                              className={`text-[9px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded truncate border ${col.bg} ${
                                ev.isDone ? 'line-through opacity-60' : ''
                              } cursor-pointer hover:shadow-xs transition-shadow`}
                              title={`${ev.time ? ev.time + ' ' : ''}${ev.title}`}
                            >
                              {ev.time && <span className="font-bold mr-0.5">{ev.time}</span>}
                              {ev.recurrence && ev.recurrence !== 'none' && (
                                <Repeat className="w-2.5 h-2.5 inline mr-0.5 text-current" />
                              )}
                              <span>{ev.title}</span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 block text-right pr-0.5">
                            +{dayEvents.length - 2} {isEn ? "more" : "további"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        )}

      </div>

      {/* Event Details View Overlay (Double-Click Action) */}
      {viewingEvent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn">
            
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl border ${getCategoryInfo(viewingEvent.color || viewingEvent.category).bg}`}>
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    {t.calendar_event_details || (isEn ? "Event Details" : "Esemény részletei")}
                  </span>
                  <div className="text-xs font-semibold text-gray-700">
                    {viewingEvent.date} {viewingEvent.time ? `• ${viewingEvent.time}` : ''}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setViewingEvent(null)}
                className="w-8 h-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
                title={t.calendar_close || (isEn ? "Close" : "Bezárás")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-4">
              
              {/* Title & Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getCategoryInfo(viewingEvent.color || viewingEvent.category).bg}`}>
                    {getCategoryInfo(viewingEvent.color || viewingEvent.category).label}
                  </span>

                  {/* Status badge & toggle */}
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      viewingEvent.isDone 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {viewingEvent.isDone ? (t.calendar_status_done || "Kész") : (t.calendar_status_pending || "Nyitott")}
                    </span>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          toggleCalendarEventDone(viewingEvent.id);
                          setViewingEvent(prev => prev ? { ...prev, isDone: !prev.isDone } : null);
                        }}
                        className="text-xs font-bold text-gray-500 hover:text-gray-900 underline cursor-pointer"
                      >
                        {viewingEvent.isDone ? (isEn ? "Reopen" : "Újranyitás") : (isEn ? "Mark Done" : "Készre állítás")}
                      </button>
                    )}
                  </div>
                </div>

                <h3 className={`text-lg sm:text-xl font-black text-gray-900 font-display ${
                  viewingEvent.isDone ? 'line-through text-gray-500' : ''
                }`}>
                  {viewingEvent.title}
                </h3>
              </div>

              {/* Info Cards Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                    {t.calendar_event_date || (isEn ? "Date" : "Dátum")}
                  </span>
                  <span className="font-bold text-gray-800">
                    {viewingEvent.date}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                    {t.calendar_event_time || (isEn ? "Time" : "Időpont")}
                  </span>
                  <span className="font-bold text-gray-800">
                    {viewingEvent.time || (isEn ? "All day" : "Egész nap")}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                    {t.calendar_event_building || (isEn ? "Building" : "Társasház")}
                  </span>
                  <span className="font-bold text-gray-800 truncate block">
                    {viewingEvent.buildingId === 'all'
                      ? (isEn ? "All buildings" : "Minden társasház")
                      : ((buildings || []).find(b => b.id === viewingEvent.buildingId)?.name || viewingEvent.buildingId)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5 flex items-center gap-1">
                    <Repeat className="w-3 h-3 text-[#1E3A8A]" />
                    <span>{t.calendar_recurrence_label || (isEn ? "Repeat" : "Ismétlődés")}</span>
                  </span>
                  <span className="font-bold text-gray-800 block truncate" title={getRecurrenceLabel(viewingEvent, isEn)}>
                    {getRecurrenceLabel(viewingEvent, isEn)}
                  </span>
                  {viewingEvent.recurrenceEndDate && (
                    <span className="text-[10px] text-gray-500 block mt-0.5">
                      {isEn ? `Until: ${viewingEvent.recurrenceEndDate}` : `Eddig: ${viewingEvent.recurrenceEndDate}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <span className="text-xs font-bold text-gray-700 block mb-1">
                  {t.calendar_event_desc || (isEn ? "Description & Details" : "Leírás és részletek")}
                </span>
                <div className="p-3 bg-gray-50/70 rounded-xl border border-gray-100 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                  {viewingEvent.description ? viewingEvent.description : (
                    <span className="text-gray-400 italic">
                      {isEn ? "No additional notes or description provided." : "Nincs további leírás vagy megjegyzés rögzítve."}
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between gap-2">
              <div>
                {isAdmin && (
                  <button
                    onClick={() => {
                      if (window.confirm(t.calendar_delete_confirm || "Biztosan törlöd ezt az eseményt?")) {
                        deleteCalendarEvent(viewingEvent.id);
                        setViewingEvent(null);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.calendar_delete_action || (isEn ? "Delete" : "Törlés")}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => {
                      const evToEdit = viewingEvent;
                      setViewingEvent(null);
                      handleOpenEditEvent(evToEdit);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{t.calendar_edit_action || (isEn ? "Edit" : "Szerkesztés")}</span>
                  </button>
                )}

                <button
                  onClick={() => setViewingEvent(null)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all cursor-pointer"
                >
                  {t.calendar_close || (isEn ? "Close" : "Bezárás")}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Add / Edit Event Dialog Overlay */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80 flex-shrink-0">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#1E3A8A]" />
                <h4 className="text-sm font-bold text-gray-900 font-display">
                  {editingEvent 
                    ? (t.calendar_edit_event || (isEn ? "Edit Event" : "Esemény szerkesztése"))
                    : (t.calendar_new_event || (isEn ? "Record New Event" : "Új esemény rögzítése"))}
                </h4>
              </div>
              <button 
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveForm} className="p-5 space-y-3.5 text-xs overflow-y-auto flex-1 overscroll-contain pb-8">
              
              {/* Title */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  {t.calendar_event_title || (isEn ? "Event Title" : "Esemény / feladat címe")} *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="pl. 2026. Évi rendes közgyűlés"
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
                  required
                />
              </div>

              {/* Building Selection */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  {t.calendar_event_building || (isEn ? "Target Building" : "Érintett társasház")}
                </label>
                <select
                  value={formBuildingId}
                  onChange={(e) => setFormBuildingId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A]"
                >
                  <option value="all">{t.calendar_all_buildings || (isEn ? "🌐 All Buildings (Global)" : "🌐 Minden társasházra érvényes")}</option>
                  {(buildings || []).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Event Color Selection */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                  <span>{t.calendar_event_color || (isEn ? "Event Color" : "Esemény színe")}</span>
                  <span className="text-[11px] font-semibold text-gray-500">
                    {getEventColorInfo(formColor, isEn).label}
                  </span>
                </label>
                <div className="flex items-center gap-2 flex-wrap p-2 bg-gray-50 border border-gray-200 rounded-xl">
                  {EVENT_COLORS.map(c => {
                    const isSelected = formColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setFormColor(c.id)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                          isSelected ? 'ring-2 ring-offset-2 ring-[#1E3A8A] scale-110 shadow-xs' : 'hover:scale-105 opacity-85 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={isEn ? c.labelEn : c.labelHu}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    {t.calendar_event_date || (isEn ? "Date" : "Dátum")} *
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    {t.calendar_event_time || (isEn ? "Time" : "Időpont")}
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A]"
                  />
                </div>
              </div>

              {/* Recurrence Selection */}
              <div ref={recurDropdownRef} className="space-y-1.5">
                <label className="block font-semibold text-gray-700 flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>{t.calendar_recurrence_label || (isEn ? "Repeat" : "Ismétlődés")}</span>
                </label>

                {/* Dropdown trigger button */}
                <button
                  type="button"
                  onClick={() => setIsRecurDropdownOpen(!isRecurDropdownOpen)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-900 border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer focus:outline-none focus:border-[#1E3A8A] focus:bg-white focus:ring-2 focus:ring-blue-100"
                >
                  <span className="truncate text-gray-800">{currentRecurrenceDisplay}</span>
                  {isRecurDropdownOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#1E3A8A] flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                </button>

                {/* In-flow Options List (NO absolute, NO clipping, NO max-h-56 truncation!) */}
                {isRecurDropdownOpen && (
                  <div className="mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xs p-1 space-y-0.5 font-sans animate-fadeIn">
                    {[
                      { key: 'none', label: t.calendar_recur_none || (isEn ? "Does not repeat" : "Nem ismétlődik") },
                      { key: 'daily', label: t.calendar_recur_daily || (isEn ? "Daily" : "Naponta") },
                      { key: 'weekly', label: isEn ? `Weekly on ${getNthWeekdayInfo(formDate, true).weekday}` : `Hetente (${getNthWeekdayInfo(formDate, false).weekday})` },
                      { key: 'monthly_nth_day', label: isEn ? `Monthly on the ${getNthWeekdayInfo(formDate, true).nthDesc} ${getNthWeekdayInfo(formDate, true).weekday}` : `Havonta a ${getNthWeekdayInfo(formDate, false).nthDesc} ${getNthWeekdayInfo(formDate, false).weekday}n` },
                      { key: 'yearly', label: isEn ? `Annually on ${getNthWeekdayInfo(formDate, true).monthDayDesc}` : `Évente ekkor: ${getNthWeekdayInfo(formDate, false).monthDayDesc}` },
                      { key: 'weekdays', label: t.calendar_recur_weekdays || (isEn ? "Every weekday (Monday to Friday)" : "Minden hétköznap (hétfőtől péntekig)") },
                      { key: 'custom', label: t.calendar_recur_custom || (isEn ? "Custom..." : "Egyéni...") }
                    ].map(opt => {
                      const isSelected = formRecurrence === opt.key;
                      return (
                        <div
                          key={opt.key}
                          onClick={() => {
                            setIsRecurDropdownOpen(false);
                            if (opt.key === 'custom') {
                              if (formCustomRecurrence) {
                                setCustomInterval(Number(formCustomRecurrence.interval) || 1);
                                setCustomUnit(formCustomRecurrence.unit || 'week');
                                setCustomDaysOfWeek(Array.isArray(formCustomRecurrence.daysOfWeek) ? formCustomRecurrence.daysOfWeek : [new Date(formDate).getDay()]);
                                setCustomEndType(formCustomRecurrence.endType || 'never');
                                setCustomEndDate(formCustomRecurrence.endDate || '');
                                setCustomEndCount(Number(formCustomRecurrence.endCount) || 13);
                              } else {
                                setCustomInterval(1);
                                setCustomUnit('week');
                                const [y, m, d] = formDate.split('-').map(Number);
                                setCustomDaysOfWeek([new Date(y, m - 1, d).getDay()]);
                                setCustomEndType('never');
                                const futureD = new Date(y, m - 1, d);
                                futureD.setMonth(futureD.getMonth() + 3);
                                setCustomEndDate(formatDateYMD(futureD));
                                setCustomEndCount(13);
                              }
                              setIsCustomRecurOpen(true);
                            } else {
                              setFormRecurrence(opt.key);
                              setFormCustomRecurrence(null);
                              setFormRecurrenceEndDate('');
                            }
                          }}
                          className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center justify-between ${
                            isSelected
                              ? 'bg-blue-50 text-[#1E3A8A] font-bold border border-blue-200'
                              : opt.key === 'custom'
                                ? 'text-[#1E3A8A] hover:bg-blue-50/70 font-semibold'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#1E3A8A]" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recurrence End Date (Conditional for standard Daily/Weekly etc.) */}
              {formRecurrence !== 'none' && formRecurrence !== 'custom' && (
                <div className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-100 text-xs">
                  <label className="block font-semibold text-gray-700 mb-1">
                    {t.calendar_recur_end_label || (isEn ? "End Repeat (Optional)" : "Ismétlődés vége (opcionális)")}
                  </label>
                  <input
                    type="date"
                    min={formDate}
                    value={formRecurrenceEndDate}
                    onChange={(e) => setFormRecurrenceEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A]"
                  />
                  <span className="text-[10px] text-gray-500 block mt-1">
                    {formRecurrenceEndDate 
                      ? (isEn ? `Repeats until ${formRecurrenceEndDate}` : `Ismétlődik eddig: ${formRecurrenceEndDate}`)
                      : (isEn ? "Leave empty to repeat indefinitely." : "Hagyd üresen, ha folyamatosan, korlátlanul ismétlődik.")}
                  </span>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  {t.calendar_event_desc || (isEn ? "Description / Agenda" : "Leírás / részletek")}
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                  placeholder={isEn ? "Enter notes, agenda points, or details..." : "Írj leírást, napirendi pontokat vagy megjegyzéseket..."}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A] focus:bg-white resize-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold cursor-pointer"
                >
                  {isEn ? "Cancel" : "Mégse"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {isEn ? "Save Event" : "Esemény mentése"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Custom Recurrence Dialog (Theme-consistent light design) */}
      {isCustomRecurOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div 
            className="w-full max-w-sm bg-white text-gray-900 rounded-2xl p-6 shadow-2xl border border-gray-200 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-[#1E3A8A]" />
                <h3 className="text-base font-bold text-gray-900 font-display">
                  {t.calendar_recur_custom_title || (isEn ? "Custom recurrence" : "Egyéni ismétlődés")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomRecurOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Row 1: Repeat every [ 1 ] [ week ▾ ] */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                {t.calendar_recur_every || (isEn ? "Repeat every" : "Ismétlés minden")}
              </span>
              <input
                type="number"
                min="1"
                max="99"
                value={customInterval}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setCustomInterval('');
                  } else {
                    const num = parseInt(val, 10);
                    if (!isNaN(num)) {
                      setCustomInterval(Math.min(99, Math.max(1, num)));
                    }
                  }
                }}
                onBlur={() => {
                  if (!customInterval || customInterval < 1) {
                    setCustomInterval(1);
                  }
                }}
                className="w-14 h-9 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold text-xs text-gray-900 focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all shadow-2xs"
              />
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                className="h-9 bg-gray-50 border border-gray-200 rounded-lg px-3 text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#1E3A8A] focus:bg-white cursor-pointer flex-1 transition-all shadow-2xs"
              >
                <option value="day">{t.calendar_recur_unit_day || (isEn ? "day" : "nap")}</option>
                <option value="week">{t.calendar_recur_unit_week || (isEn ? "week" : "hét")}</option>
                <option value="month">{t.calendar_recur_unit_month || (isEn ? "month" : "hónap")}</option>
                <option value="year">{t.calendar_recur_unit_year || (isEn ? "year" : "év")}</option>
              </select>
            </div>

            {/* Section 2: Repeat on (when unit is 'week') */}
            {customUnit === 'week' && (
              <div className="mb-5 p-3 rounded-xl bg-blue-50/50 border border-blue-100/70">
                <span className="text-xs font-bold text-[#1E3A8A] mb-2.5 block">
                  {t.calendar_recur_on_days || (isEn ? "Repeat on" : "Ismétlés napjai")}
                </span>
                <div className="flex items-center justify-between gap-1">
                  {[
                    { id: 1, labelEn: 'M', labelHu: 'H' },
                    { id: 2, labelEn: 'T', labelHu: 'K' },
                    { id: 3, labelEn: 'W', labelHu: 'Sze' },
                    { id: 4, labelEn: 'T', labelHu: 'Cs' },
                    { id: 5, labelEn: 'F', labelHu: 'P' },
                    { id: 6, labelEn: 'S', labelHu: 'Szo' },
                    { id: 0, labelEn: 'S', labelHu: 'V' }
                  ].map(d => {
                    const isSelected = customDaysOfWeek.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleCustomDay(d.id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-all shadow-2xs ${
                          isSelected 
                            ? 'bg-[#1E3A8A] text-white shadow-xs scale-105' 
                            : 'bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900 border border-gray-200'
                        }`}
                      >
                        {isEn ? d.labelEn : d.labelHu}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 3: Ends */}
            <div className="mb-6">
              <span className="text-xs font-bold text-gray-700 mb-2.5 block">
                {t.calendar_recur_ends || (isEn ? "Ends" : "Befejezés")}
              </span>
              <div className="space-y-3">
                {/* 1. Never */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-gray-800 font-medium">
                  <input
                    type="radio"
                    name="customEndType"
                    checked={customEndType === 'never'}
                    onChange={() => setCustomEndType('never')}
                    className="w-4 h-4 text-[#1E3A8A] accent-[#1E3A8A] cursor-pointer"
                  />
                  <span>{t.calendar_recur_ends_never || (isEn ? "Never" : "Soha")}</span>
                </label>

                {/* 2. On [ Date ] */}
                <div className="flex items-center gap-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-gray-800 font-medium">
                    <input
                      type="radio"
                      name="customEndType"
                      checked={customEndType === 'on_date'}
                      onChange={() => setCustomEndType('on_date')}
                      className="w-4 h-4 text-[#1E3A8A] accent-[#1E3A8A] cursor-pointer"
                    />
                    <span>{t.calendar_recur_ends_on || (isEn ? "On" : "Ekkor:")}</span>
                  </label>
                  <input
                    type="date"
                    min={formDate}
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setCustomEndType('on_date');
                    }}
                    onFocus={() => setCustomEndType('on_date')}
                    disabled={customEndType !== 'on_date'}
                    className="bg-gray-50 border border-gray-200 text-gray-800 px-2.5 py-1 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A] focus:bg-white disabled:opacity-40 cursor-pointer shadow-2xs"
                  />
                </div>

                {/* 3. After [ count ] occurrences */}
                <div className="flex items-center gap-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-gray-800 font-medium">
                    <input
                      type="radio"
                      name="customEndType"
                      checked={customEndType === 'after_count'}
                      onChange={() => setCustomEndType('after_count')}
                      className="w-4 h-4 text-[#1E3A8A] accent-[#1E3A8A] cursor-pointer"
                    />
                    <span>{t.calendar_recur_ends_after || (isEn ? "After" : "Ennyi")}</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={customEndCount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setCustomEndCount('');
                      } else {
                        const num = parseInt(val, 10);
                        if (!isNaN(num)) {
                          setCustomEndCount(Math.min(999, Math.max(1, num)));
                        }
                      }
                      setCustomEndType('after_count');
                    }}
                    onBlur={() => {
                      if (!customEndCount || customEndCount < 1) {
                        setCustomEndCount(13);
                      }
                    }}
                    onFocus={() => setCustomEndType('after_count')}
                    disabled={customEndType !== 'after_count'}
                    className="w-14 h-8 bg-gray-50 border border-gray-200 text-center font-bold text-xs text-gray-900 rounded-lg focus:outline-none focus:border-[#1E3A8A] focus:bg-white disabled:opacity-40 shadow-2xs"
                  />
                  <span className="text-xs text-gray-600">
                    {t.calendar_recur_occurrences || (isEn ? "occurrences" : "alkalom után")}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsCustomRecurOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 text-xs font-semibold cursor-pointer transition-colors"
              >
                {t.calendar_recur_cancel || (isEn ? "Cancel" : "Mégse")}
              </button>
              <button
                type="button"
                onClick={handleApplyCustomRecurrence}
                className="px-5 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold shadow-xs cursor-pointer active:scale-98 transition-all"
              >
                {t.calendar_recur_done || (isEn ? "Done" : "Kész")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
