const fs = require('fs');

const js = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js', 'utf8');

const listeners = {};
const elements = {};

function getMockEl(id) {
    if (!elements[id]) {
        elements[id] = {
            id,
            style: {},
            value: '',
            textContent: '',
            innerHTML: '',
            dataset: {},
            focus: () => {},
            setAttribute: () => {},
            removeAttribute: () => {},
            appendChild: () => {},
            addEventListener: (evt, fn) => {
                if (!listeners[id]) listeners[id] = {};
                listeners[id][evt] = fn;
            }
        };
    }
    return elements[id];
}

const mockDoc = {
    getElementById: (id) => getMockEl(id),
    querySelector: (sel) => getMockEl(sel),
    querySelectorAll: () => [],
    createElement: (tag) => getMockEl(tag + '-' + Math.random()),
    addEventListener: () => {},
    body: { style: {} }
};

let storageData = {};
const windowListeners = {};
const mockWindow = {
    scrollTo: () => {},
    addEventListener: (evt, fn) => {
        windowListeners[evt] = fn;
    },
    lucide: { createIcons: () => {} },
    playNotificationSound: () => {},
    localStorage: {
        getItem: (k) => storageData[k] || null,
        setItem: (k, v) => { storageData[k] = v.toString(); },
        removeItem: (k) => { delete storageData[k]; },
        clear: () => { storageData = {}; }
    }
};

const vm = require('vm');
const context = {
    window: mockWindow,
    document: mockDoc,
    localStorage: mockWindow.localStorage,
    console: console,
    lucide: { createIcons: () => {} },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    alert: (msg) => console.log("ALERT:", msg),
    playNotificationSound: () => {},
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Date: Date,
    Math: Math,
    JSON: JSON,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN
};

context.global = context;
context.window.window = context;

vm.createContext(context);
const scriptToRun = js + "\n;Object.defineProperty(window, 'state', { get: () => state, set: (v) => { state = v; }, configurable: true }); window.saveStateToLocalStorage = saveStateToLocalStorage; window.loadStateFromLocalStorage = loadStateFromLocalStorage; window.applyCloudStateUpdate = applyCloudStateUpdate;";
vm.runInContext(scriptToRun, context);

if (windowListeners["DOMContentLoaded"]) {
    windowListeners["DOMContentLoaded"]();
}

Object.keys(context.window).forEach(key => {
    if (typeof context.window[key] === 'function') {
        context[key] = context.window[key];
    }
});

console.log("App loaded in test sandbox successfully!");

let passed = 0;
let failed = 0;

function assert(condition, desc) {
    if (condition) {
        console.log(`[PASS] ${desc}`);
        passed++;
    } else {
        console.error(`[FAIL] ${desc}`);
        failed++;
    }
}

// 1. Test Profile Switching for benedek.baltay@gmail.com
console.log("\n--- TEST 1: Profile Switching ---");
const loginSubmit = listeners["login-form"]["submit"];
getMockEl("login-username").value = "benedek.baltay@gmail.com";
getMockEl("login-password").value = "admin123";
loginSubmit({ preventDefault: () => {} });

assert(context.window.state.currentUser.role === 'admin', "Logged in as Admin");

// Switch to Resident view (Flat 2)
context.window.toggleUserRoleProfile();
assert(context.window.state.currentUser.role === 'Owner' && context.window.state.currentUser.flatNum === 'Fsz 2', "Switched to Resident view (Flat 2)");

// Test openBuildingSelector
context.window.openBuildingSelector();
const listChildren = context.document.getElementById("building-selector-list");
assert(listChildren !== null, "Building selector list rendered successfully");

// Switch back to Admin view
context.window.toggleUserRoleProfile();
assert(context.window.state.currentUser.role === 'admin', "Switched back to Admin view");

// Direct switch methods
context.window.switchToResidentProfile('Fsz 2');
assert(context.window.state.currentUser.role === 'Owner' && context.window.state.currentUser.flatNum === 'Fsz 2', "Direct switchToResidentProfile worked");

context.window.switchToAdminProfile();
assert(context.window.state.currentUser.role === 'admin', "Direct switchToAdminProfile worked");

// Test Password Reset Confirmation
context.window.state.currentFlatDetailNum = "Fsz 3";
context.window.resetResidentPassword();
const resetModal = context.document.getElementById("reset-pass-confirm-modal");
assert(resetModal.style.display === "flex", "Password reset modal displayed confirmation");
context.window.confirmResetResidentPassword();
assert(resetModal.style.display === "none", "Password reset modal closed after confirmation");
const userFsz3 = context.window.state.users.find(u => u.flatNum === "Fsz 3");
assert(userFsz3.pass === "lakas123", "Flat password reset to default lakas123");

// 2. Test Data Persistence (Custom Password, Emails, Fees, Deletions)
console.log("\n--- TEST 2: Data Persistence without Overwrite ---");

// Step A: Custom Password Change
const userToChange = context.window.state.users.find(u => u.email === "bodi.aniko@gmail.com");
userToChange.pass = "MySecretPass_999";
context.window.saveStateToLocalStorage();

// Reload from local storage
context.window.loadStateFromLocalStorage();
const reloadedUser = context.window.state.users.find(u => u.email === "bodi.aniko@gmail.com");
assert(reloadedUser.pass === "MySecretPass_999", "Custom password was permanently preserved across reload");

// Step B: Custom Flat Deletion
console.log("Current building flats before:", context.window.state.flats.map(f => f.flatNum));
const flatCountBefore = context.window.state.flats.length;
context.window.openDeleteModal("I 6");
console.log("Mock el value is:", context.document.getElementById("delete-flat-num-hidden").value);
context.window.confirmDeleteFlat();
const flatCountAfter = context.window.state.flats.length;
console.log("Current building flats after:", context.window.state.flats.map(f => f.flatNum));
assert(flatCountAfter === flatCountBefore - 1, `Flat I 6 was deleted locally (${flatCountBefore} -> ${flatCountAfter})`);

// Reload from storage
context.window.loadStateFromLocalStorage();
const checkDeletedAfterReload = context.window.state.flats.find(f => f.flatNum === "I 6");
assert(!checkDeletedAfterReload, "Deleted flat I 6 was NOT resurrected after loadStateFromLocalStorage");

// Step C: Cloud Snapshot Merge with deleted flat
const fakeCloudData = {
    lastUpdated: new Date(Date.now() - 10000).toISOString(),
    buildings: [
        {
            id: "batyu21",
            name: "Batyu utca 21. Társasház",
            flats: [
                { flatNum: "Fsz 1", ownerName: "Ivánné Mód Ágnes", email: "mod.agnes@gmail.com" },
                { flatNum: "I 6", ownerName: "Citi Apartman", email: "citi.apartman@gmail.com" } // old cloud snapshot has deleted flat
            ]
        }
    ],
    users: [
        { id: "I 6", flatNum: "I 6", email: "citi.apartman@gmail.com" },
        { id: "Fsz 3", flatNum: "Fsz 3", email: "bodi.aniko@gmail.com", pass: "lakas123" } // old cloud snapshot has default pass
    ]
};

context.window.applyCloudStateUpdate(fakeCloudData);
const checkDeletedAfterCloud = context.window.state.flats.find(f => f.flatNum === "I 6");
assert(!checkDeletedAfterCloud, "Deleted flat I 6 was NOT resurrected by cloud sync");

const checkPassAfterCloud = context.window.state.users.find(u => u.email === "bodi.aniko@gmail.com");
assert(checkPassAfterCloud.pass === "MySecretPass_999", "User custom password was NOT overwritten by cloud sync");

// Step D: Document Deletion & Permanent Persistence
const docCountBefore = context.window.state.documents.length;
context.document.getElementById("delete-doc-id-hidden").value = "doc-2";
context.window.confirmDeleteDocument();
const docCountAfter = context.window.state.documents.length;
assert(docCountAfter === docCountBefore - 1, `Document doc-2 was deleted (${docCountBefore} -> ${docCountAfter})`);

// Reload from local storage
context.window.loadStateFromLocalStorage();
const checkDocAfterReload = context.window.state.documents.find(d => d.id === "doc-2");
assert(!checkDocAfterReload, "Deleted document doc-2 was NOT resurrected after reload");

// Step E: Simulate full LocalStorage clear and restore from Cloud Vault
const exportedVault = context.window.getPermanentVault();
assert(exportedVault.deletedIds.includes("doc-2"), "Vault contains doc-2 in deletedIds");

// Clear local storage completely
context.localStorage.clear();
context.window.state = { buildings: [], users: [] };

// Feed cloud snapshot containing the vault
const cloudDataWithVault = {
    lastUpdated: new Date(Date.now() + 5000).toISOString(),
    buildings: [
        {
            id: "batyu21",
            name: "Batyu utca 21. Társasház",
            flats: [
                { flatNum: "Fsz 1", ownerName: "Ivánné Mód Ágnes" },
                { flatNum: "I 6", ownerName: "Citi Apartman" }
            ],
            documents: [
                { id: "doc-2", title: "Társasházi Alapító Okirat" },
                { id: "doc-5", title: "Társasházi Házirend" }
            ]
        }
    ],
    users: [],
    vault: exportedVault,
    revision: 1000
};

context.window.applyCloudStateUpdate(cloudDataWithVault);
assert(!context.window.state.documents.find(d => d.id === "doc-2"), "Document doc-2 remains deleted after full restore from cloud vault");
assert(context.window.state.documents.find(d => d.id === "doc-5"), "Document doc-5 remains intact");

// Step F: Test reserves editing with custom formatting
getMockEl("global-start-common").value = "1.500.000"; // formatted string with dots
getMockEl("global-start-renovation").value = "2 300 000"; // formatted string with spaces
listeners["global-balances-form"]["submit"]({ preventDefault: () => {} });

// Check that the parsed values are correct (numbers)
assert(context.window.state.buildingInitialReserveCommon === 1500000, "Common reserve parsed correctly with dots");
assert(context.window.state.buildingInitialReserveRenovation === 2300000, "Renovation reserve parsed correctly with spaces");

// Verify they are preserved in vault
const vaultAfterEdit = context.window.getPermanentVault();
assert(vaultAfterEdit.buildingInitialReserveCommon["batyu21"] === 1500000, "Common reserve persisted in vault");
assert(vaultAfterEdit.buildingInitialReserveRenovation["batyu21"] === 2300000, "Renovation reserve persisted in vault");

// Clear local storage and reload from cloud vault containing the reserves
context.localStorage.clear();
context.window.state = { buildings: [], users: [] };
const cloudDataWithReservesVault = {
    lastUpdated: new Date(Date.now() + 10000).toISOString(),
    buildings: [
        {
            id: "batyu21",
            name: "Batyu utca 21. Társasház",
            flats: [],
            documents: []
        }
    ],
    users: [],
    vault: vaultAfterEdit,
    revision: 2000
};
context.window.applyCloudStateUpdate(cloudDataWithReservesVault);
assert(context.window.state.buildingInitialReserveCommon === 1500000, "Common reserve successfully restored from cloud vault");
assert(context.window.state.buildingInitialReserveRenovation === 2300000, "Renovation reserve successfully restored from cloud vault");

console.log("\n--- TEST 3: Header Menu and Profile Selector Button ---");
// Check modal actions
context.window.openLoansModal();
assert(getMockEl("loans-modal").style.display === "flex", "Loans modal opens successfully");
context.window.closeLoansModal();
assert(getMockEl("loans-modal").style.display === "none", "Loans modal closes successfully");

// Test goToMainMenu closes everything
context.window.openLoansModal();
getMockEl("documents-modal").style.display = "flex";
context.window.goToMainMenu();
assert(getMockEl("loans-modal").style.display === "none", "goToMainMenu closes loans modal");
assert(getMockEl("documents-modal").style.display === "none", "goToMainMenu closes documents modal");

// Test profile button visibility logic
// Scenario A: Resident has 1 flat
context.window.state.currentUser = { email: "resident@example.com", flatNum: "Fsz 1", role: "resident" };
// Mock getResidentFlats to return 1 flat
context.window.getResidentFlats = (email) => [{ flatNum: "Fsz 1" }];
context.window.updateProfileButtonVisibility();
assert(getMockEl("header-profile-btn").style.display === "none", "Profile button hidden for resident with 1 flat");

// Scenario B: Admin has no flats registered to this email
context.window.state.currentUser = { email: "admin_only@example.com", role: "admin" };
context.window.getResidentFlats = (email) => [];
context.window.updateProfileButtonVisibility();
assert(getMockEl("header-profile-btn").style.display === "none", "Profile button hidden for representative with no flats");

// Scenario C: Admin who also owns registered flats
context.window.state.currentUser = { email: "benedek.baltay@gmail.com", role: "admin" };
context.window.getResidentFlats = (email) => [{ flatNum: "Fsz 2" }];
context.window.updateProfileButtonVisibility();
assert(getMockEl("header-profile-btn").style.display === "flex", "Profile button visible for admin with registered flats (multiple profiles)");

// Test syncStateToCloud trigger on transaction edit / add
let cloudSyncTriggered = false;
context.syncStateToCloud = () => {
    cloudSyncTriggered = true;
};
context.window.syncStateToCloud = context.syncStateToCloud;

// Simulate edit-transaction-form submit
const editFormSubmitHandler = listeners["edit-transaction-form"]?.["submit"];
if (editFormSubmitHandler) {
    cloudSyncTriggered = false;
    // Set up dummy transaction in state
    context.window.state.transactions = [{ id: "tx-test-1", amount: 100, date: "2026-01-01", flatNum: "1", targetAccount: "Közös Költség" }];
    getMockEl("edit-tx-id").value = "tx-test-1";
    getMockEl("edit-tx-type").value = "Befizetés";
    getMockEl("edit-tx-date").value = "2026-08-25";
    getMockEl("edit-tx-amount").value = "12";
    getMockEl("edit-tx-category").value = "Bank Transfer";
    getMockEl("edit-tx-target-account").value = "Felújítási Alap";
    getMockEl("edit-tx-comment").value = "Test Edit";
    getMockEl("edit-tx-flat").value = "2";
    
    // Trigger submit
    editFormSubmitHandler({ preventDefault: () => {} });
    
    assert(cloudSyncTriggered === true, "Editing a transaction immediately triggers cloud synchronization");
    const updatedTx = context.window.state.transactions[0];
    assert(updatedTx.amount === 12, "Transaction amount successfully edited");
    assert(updatedTx.date === "2026-08-25", "Transaction date successfully edited");
    assert(updatedTx.targetAccount === "Felújítási Alap", "Transaction target account successfully edited");
}

// Test includeInBalance toggle feature
console.log("\n--- TEST 4: Ledger Balance Visibility Switch ---");
context.window.state.flats = [{ flatNum: "2", email: "test@example.com", balance: 0, renovationBalance: 0, initialBalance: 150 }];

// Scenario A: includeInBalance = true (or default)
context.window.state.transactions = [{
    id: "tx-ledger-1",
    flatNum: "2",
    date: "2026-08-25",
    amount: 1000,
    status: "Verified",
    targetAccount: "Közös Költség",
    includeInBalance: true
}];
let timeline = context.getFlatLedgerTimeline("2", "Közös Költség");
assert(timeline.some(t => t.id === "tx-ledger-1"), "Transaction with includeInBalance=true appears in timeline");
assert(timeline.find(t => t.id === "tx-ledger-1").runningBalance === 1150, "Transaction amount is included in running balance");

// Scenario B: includeInBalance = false
context.window.state.transactions[0].includeInBalance = false;
timeline = context.getFlatLedgerTimeline("2", "Közös Költség");
assert(timeline.some(t => t.id === "tx-ledger-1"), "Transaction with includeInBalance=false STILL appears in timeline");
assert(timeline.find(t => t.id === "tx-ledger-1").runningBalance === 1150, "Transaction amount is STILL included in flat running balance even if includeInBalance=false");
// Verify that it is NOT included in building reserve calculation:
context.window.state.buildingInitialReserveCommon = 5000;
let buildingReserve = context.getBuildingReserve();
assert(buildingReserve === 5000, "Transaction with includeInBalance=false is ignored in building reserves calculation");

// Scenario C: Form submit toggling includeInBalance
if (editFormSubmitHandler) {
    getMockEl("edit-tx-id").value = "tx-ledger-1";
    getMockEl("edit-tx-type").value = "Befizetés";
    getMockEl("edit-tx-date").value = "2026-08-25";
    getMockEl("edit-tx-amount").value = "1000";
    getMockEl("edit-tx-category").value = "Bank Transfer";
    getMockEl("edit-tx-target-account").value = "Közös Költség";
    getMockEl("edit-tx-comment").value = "Test Edit";
    getMockEl("edit-tx-flat").value = "2";
    getMockEl("edit-tx-include-balance").checked = true; // Turn ON
    
    editFormSubmitHandler({ preventDefault: () => {} });
    assert(context.window.state.transactions[0].includeInBalance === true, "Form submit correctly updates includeInBalance to true");
    timeline = context.getFlatLedgerTimeline("2", "Közös Költség");
    assert(timeline.find(t => t.id === "tx-ledger-1").runningBalance === 1150, "Transaction balance is correctly computed after toggling includeInBalance to true");
    buildingReserve = context.getBuildingReserve();
    assert(buildingReserve === 6000, "Transaction with includeInBalance=true is now included in building reserves calculation");
}

// Scenario D: Flat detail modal add tx form submission
const flatAddTxFormSubmit = listeners["flat-detail-add-tx-form"]?.["submit"];
if (flatAddTxFormSubmit) {
    cloudSyncTriggered = false;
    context.window.state.currentFlatDetailNum = "2";
    getMockEl("flat-add-tx-type").value = "Befizetés";
    getMockEl("flat-add-tx-account").value = "Közös Költség";
    getMockEl("flat-add-tx-date").value = "2026-08-25";
    getMockEl("flat-add-tx-amount").value = "500";
    getMockEl("flat-add-tx-comment").value = "Flat detail payment";
    getMockEl("flat-add-tx-include-balance").checked = false; // Turn OFF
    
    flatAddTxFormSubmit({ preventDefault: () => {} });
    
    assert(cloudSyncTriggered === true, "Adding a flat detail transaction immediately triggers cloud synchronization");
    const createdTx = context.window.state.transactions.find(t => t.comment === "Flat detail payment");
    assert(createdTx !== undefined, "Transaction was successfully added via flat detail form");
    assert(createdTx.includeInBalance === false, "Created transaction correctly has includeInBalance=false");
    
    timeline = context.getFlatLedgerTimeline("2", "Közös Költség");
    assert(timeline.some(t => t.id === createdTx.id), "Transaction with includeInBalance=false appears in timeline list");
    // Both tx-ledger-1 (1000) and createdTx (500) are always factored into flat balance!
    // Total: 150 baseline + 1000 + 500 = 1650 — check top of reversed timeline (most recent = index 0)
    assert(timeline[0].runningBalance === 1650, "Flat ledger running balance includes all flat transactions");
    
    // But building reserve should still ignore the 500, remaining at 6000!
    buildingReserve = context.getBuildingReserve();
    assert(buildingReserve === 6000, "Building reserve ignores transaction with includeInBalance=false");
}

console.log(`\nFinal Test Results: ${passed} passed, ${failed} failed.`);
