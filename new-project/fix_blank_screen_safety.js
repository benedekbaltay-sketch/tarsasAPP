const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// 1. Upgrade loadStateFromLocalStorage for 100% fail-safe robustness
const oldLoadState = `function loadStateFromLocalStorage() {
    const raw = localStorage.getItem("tarsashaz_state");
    if (raw) {
        try {
            state = JSON.parse(raw);
            
            if (!state.currentLang) {
                state.currentLang = "hu";
            }
            state.isGridEditMode = false; // Never persist edit mode across reloads
            
            
            if (typeof state.buildingInitialReserveCommon === 'undefined') {
                state.buildingInitialReserveCommon = 624487;
            }
            if (typeof state.buildingInitialReserveRenovation === 'undefined') {
                state.buildingInitialReserveRenovation = 989359;
            }
            
            // Check for new schema elements (e.g. renovationBalance)
            const hasNewSchema = state.flats && state.flats.length > 0 && ('renovationBalance' in state.flats[0]);
            const hasTransactions = state.transactions && state.transactions.length > 0;
            if (!hasNewSchema || !hasTransactions) {
                console.log("Empty or old database schema detected. Performing automatic reset...");
                resetStateToDefaults();
            }
        } catch (e) {
            console.error("Hiba a localStorage betöltésekor:", e);
            resetStateToDefaults();
        }
    } else {
        resetStateToDefaults();
    }
}`;

const newLoadState = `function loadStateFromLocalStorage() {
    const raw = localStorage.getItem("tarsashaz_state");
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                // Safely merge with default initial state so no required keys are lost
                state = Object.assign({}, defaultStateTemplate(), parsed);
            }
        } catch (e) {
            console.error("Corrupted state in localStorage, performing auto reset...", e);
            resetStateToDefaults();
        }
    } else {
        resetStateToDefaults();
    }
    
    // Safety check: Ensure critical data arrays exist
    if (!state.flats || !Array.isArray(state.flats) || state.flats.length === 0 ||
        !state.transactions || !Array.isArray(state.transactions) ||
        !state.expenses || !Array.isArray(state.expenses) ||
        !state.users || !Array.isArray(state.users)) {
        console.warn("Incomplete or missing database arrays detected. Resetting to defaults...");
        resetStateToDefaults();
    }
    
    if (!state.currentLang) state.currentLang = "hu";
    state.isGridEditMode = false;
}`;

// Provide defaultStateTemplate helper
const defaultStateTemplateFunc = `
function defaultStateTemplate() {
    return {
        currentLang: 'hu',
        currentUser: null,
        buildingInitialReserveCommon: 624487,
        buildingInitialReserveRenovation: 989359,
        flats: [
            { flatNum: "Fsz 1", ownerName: "Mód Ágnes", balance: 0, renovationBalance: 0, monthlyFee: 26950, renovationFee: 14700, email: "", phone: "" },
            { flatNum: "Fsz 2", ownerName: "Baltay Zsombor", balance: 0, renovationBalance: 0, monthlyFee: 18865, renovationFee: 10290, email: "", phone: "" },
            { flatNum: "Fsz 3", ownerName: "Bódi Anikó", balance: -45000, renovationBalance: 0, monthlyFee: 20405, renovationFee: 11130, email: "", phone: "" },
            { flatNum: "I 4", ownerName: "Hóman Józsefné", balance: 12500, renovationBalance: 0, monthlyFee: 47740, renovationFee: 26040, email: "", phone: "" },
            { flatNum: "I 5", ownerName: "Iván Noémi", balance: 0, renovationBalance: 0, monthlyFee: 47740, renovationFee: 26040, email: "", phone: "" },
            { flatNum: "I 6", ownerName: "Citi Apartman", balance: -120000, renovationBalance: 0, monthlyFee: 49280, renovationFee: 26880, email: "", phone: "" },
            { flatNum: "II 7-8", ownerName: "Dr. Cser László", balance: 0, renovationBalance: 0, monthlyFee: 66990, renovationFee: 36540, email: "", phone: "" },
            { flatNum: "II 9", ownerName: "Dr. Forrai Anna", balance: 5000, renovationBalance: 0, monthlyFee: 30030, renovationFee: 16380, email: "", phone: "" }
        ],
        transactions: [],
        expenses: [],
        users: [
            { email: "admin", password: "123", role: "admin", flatNum: null },
            { email: "Fsz 1", password: "123", role: "tenant", flatNum: "Fsz 1" },
            { email: "Fsz 2", password: "123", role: "tenant", flatNum: "Fsz 2" },
            { email: "Fsz 3", password: "123", role: "tenant", flatNum: "Fsz 3" },
            { email: "I 4", password: "123", role: "tenant", flatNum: "I 4" },
            { email: "I 5", password: "123", role: "tenant", flatNum: "I 5" },
            { email: "I 6", password: "123", role: "tenant", flatNum: "I 6" },
            { email: "II 7-8", password: "123", role: "tenant", flatNum: "II 7-8" },
            { email: "II 9", password: "123", role: "tenant", flatNum: "II 9" }
        ],
        adminTxEditMode: false,
        isGridEditMode: false
    };
}
`;

appJs = appJs.replace(oldLoadState, defaultStateTemplateFunc + "\n" + newLoadState);

// 2. Wrap updateAppView in try...catch so screen never goes blank
const oldUpdateAppViewStart = `function updateAppView() {\n    window.scrollTo(0, 0);`;
const newUpdateAppViewStart = `function updateAppView() {
    try {
        window.scrollTo(0, 0);`;

appJs = appJs.replace(oldUpdateAppViewStart, newUpdateAppViewStart);

// Add catch block to end of updateAppView
const oldUpdateAppViewEnd = `    applyTranslations();\n}`;
const newUpdateAppViewEnd = `    applyTranslations();
    } catch (err) {
        console.error("Error rendering view, resetting state safely...", err);
        state.currentUser = null;
        const loginView = document.getElementById("login-view");
        if (loginView) loginView.style.display = "flex";
    }
}`;

appJs = appJs.replace(oldUpdateAppViewEnd, newUpdateAppViewEnd);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully added fail-safe protection to loadStateFromLocalStorage and updateAppView!");
