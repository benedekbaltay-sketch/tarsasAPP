/**
 * Generic Structural Defaults for TarsasApp
 *
 * SECURITY RULE 4 (Zero-Secret / Zero-PII Bundle):
 * This file is compiled into the public unauthenticated frontend bundle.
 * NEVER place real user credentials, passwords, reset tokens, resident PII,
 * real bank account numbers, API keys, or embedded documents in this file.
 * All real condominium, resident, and financial data MUST be loaded exclusively
 * after authentication from the cloud database.
 */

export const DEFAULT_DOC_FOLDERS = [
  {
    id: "folder-legal",
    name: "Alapdokumentumok & Szabályzatok",
    color: "blue",
    createdAt: "2024-01-01"
  },
  {
    id: "folder-assemblies",
    name: "Közgyűlési Jegyzőkönyvek",
    color: "amber",
    createdAt: "2024-01-01"
  },
  {
    id: "folder-financial",
    name: "Pénzügyi & Számviteli Beszámolók",
    color: "emerald",
    createdAt: "2024-01-01"
  },
  {
    id: "folder-tech",
    name: "Műszaki & Karbantartási Iratok",
    color: "indigo",
    createdAt: "2024-01-01"
  }
];

export const DEFAULT_DOCUMENTS = [];

export const DEFAULT_INFO_SECTIONS = [];

export const DEFAULT_CATEGORIES = [
  // Incomes (type: 'income')
  { id: 'cat-inc-kk', name: 'Közös Költség befizetés', nameEn: 'Common Cost Payment', type: 'income', defaultFund: 'Közös Költség' },
  { id: 'cat-inc-fa', name: 'Felújítási Alap befizetés', nameEn: 'Renovation Fund Payment', type: 'income', defaultFund: 'Felújítási Alap' },
  { id: 'cat-inc-extra', name: 'Rendkívüli célbefizetés', nameEn: 'Special Assessment', type: 'income', defaultFund: 'Felújítási Alap' },
  { id: 'cat-inc-rent', name: 'Helyiségbérlet / Reklámbevétel', nameEn: 'Rental / Advertising Income', type: 'income', defaultFund: 'Közös Költség' },
  { id: 'cat-inc-interest', name: 'Kamatbevétel', nameEn: 'Interest Income', type: 'income', defaultFund: 'Közös Költség' },
  { id: 'cat-inc-refund', name: 'Kártérítés / Visszatérítés', nameEn: 'Refund / Insurance Claim', type: 'income', defaultFund: 'Közös Költség' },
  { id: 'cat-inc-other', name: 'Egyéb jóváírás', nameEn: 'Other Income', type: 'income', defaultFund: 'Közös Költség' },

  // Expenses (type: 'expense')
  { id: 'cat-exp-utility', name: 'Közüzemi díj (Víz, Gáz, Áram)', nameEn: 'Utilities (Water, Gas, Electricity)', type: 'expense', defaultFund: 'Közös Költség' },
  { id: 'cat-exp-garbage', name: 'Szemétszállítás', nameEn: 'Waste Management', type: 'expense', defaultFund: 'Közös Költség' },
  { id: 'cat-exp-cleaning', name: 'Takarítás & Kertgondozás', nameEn: 'Cleaning & Gardening', type: 'expense', defaultFund: 'Közös Költség' },
  { id: 'cat-exp-maintenance', name: 'Karbantartás & Kisjavítás', nameEn: 'Maintenance & Repairs', type: 'expense', defaultFund: 'Közös Költség' },
  { id: 'cat-exp-renovation', name: 'Felújítási munkálatok', nameEn: 'Renovation Works', type: 'expense', defaultFund: 'Felújítási Alap' },
  { id: 'cat-exp-insurance', name: 'Épületbiztosítás', nameEn: 'Building Insurance', type: 'expense', defaultFund: 'Közös Költség' },
  { id: 'cat-exp-bank', name: 'Bankköltség & Számlavezetés', nameEn: 'Bank Fees & Account Charges', type: 'expense', defaultFund: 'Közös Költség' },
  { id: 'cat-exp-rep', name: 'Közös képviseleti díj', nameEn: 'Condominium Management Fee', type: 'expense', defaultFund: 'Közös Költség' },
  { id: 'cat-exp-elevator', name: 'Lift üzemeltetés & Karbantartás', nameEn: 'Elevator Service & Maintenance', type: 'expense', defaultFund: 'Közös Költség' },
  { id: 'cat-exp-chimney', name: 'Kéményseprés & Érintésvédelem', nameEn: 'Chimney Sweeping & Safety Inspection', type: 'expense', defaultFund: 'Közös Költség' },
  { id: 'cat-exp-legal', name: 'Jogi & Könyvelési költség', nameEn: 'Legal & Accounting Fees', type: 'expense', defaultFund: 'Közös Költség' },
  { id: 'cat-exp-other', name: 'Egyéb kiadás', nameEn: 'Other Expense', type: 'expense', defaultFund: 'Közös Költség' }
];

// Empty by default in production bundle — fetched strictly after Firebase Authentication
export const DEFAULT_BUILDINGS = [];

export const DEFAULT_USERS = [];

export const DEFAULT_CALENDAR_EVENTS = [];

export const DEFAULT_REP_PROFILE = {
  companyName: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  officeHours: ""
};

export const DEFAULT_GLOBAL_SETTINGS = {
  soundEffectsEnabled: true,
  rememberMe: true,
  notifications: {
    bankErrors: true,
    expiringLoans: true,
    upcomingAssemblies: true
  },
  devSettings: {
    debugLogging: false
  }
};
