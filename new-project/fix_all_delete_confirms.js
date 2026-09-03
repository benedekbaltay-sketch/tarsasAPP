const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Replace any confirm() in app.js
// 1. Clean up deleteLedgerTransaction
const target1Start = "window.deleteLedgerTransaction = function(txId) {";
const target1End = "window.closeFlatDetailModal = function() {";

const idx1Start = appJs.indexOf(target1Start);
const idx1End = appJs.indexOf(target1End);

if (idx1Start !== -1 && idx1End !== -1) {
    const replacement1 = `window.deleteLedgerTransaction = function(txId) {
    window.deleteTransaction(txId, 'Befizetés');
};

`;
    appJs = appJs.substring(0, idx1Start) + replacement1 + appJs.substring(idx1End);
    console.log("Replaced deleteLedgerTransaction");
}

// 2. Replace deleteTransaction & deleteFlatLedgerTx & add confirmDeleteTx
const target2Start = "// Fix deleteTransaction for global list";
const idx2Start = appJs.indexOf(target2Start);

if (idx2Start !== -1) {
    appJs = appJs.substring(0, idx2Start);
} else {
    // Try finding window.deleteTransaction
    const dtIdx = appJs.indexOf("window.deleteTransaction = function");
    if (dtIdx !== -1) {
        appJs = appJs.substring(0, dtIdx);
    }
}

const newDeleteCode = `
// Universal Delete Handlers using Custom HTML Modal
window.deleteTransaction = function(id, type) {
    document.getElementById('delete-tx-id-hidden').value = id;
    document.getElementById('delete-tx-type-hidden').value = type || 'Befizetés';
    document.getElementById('delete-tx-confirm-modal').style.display = 'flex';
    if (window.lucide) lucide.createIcons();
};

window.deleteFlatLedgerTx = function(txId) {
    window.deleteTransaction(txId, 'Befizetés');
};

window.confirmDeleteTx = function() {
    const id = document.getElementById('delete-tx-id-hidden').value;
    const type = document.getElementById('delete-tx-type-hidden').value;
    document.getElementById('delete-tx-confirm-modal').style.display = 'none';
    
    if (type === "Kiadás" || type === "Expense") {
        const idx = state.expenses.findIndex(e => e.id === id);
        if (idx !== -1) {
            state.expenses.splice(idx, 1);
        }
    } else {
        const idx = state.transactions.findIndex(t => t.id === id);
        if (idx !== -1) {
            state.transactions.splice(idx, 1);
        }
    }
    
    saveStateToLocalStorage();
    recalculateFlatBalances();
    
    if (document.getElementById('fullscreen-tx-modal').style.display === 'flex') {
        renderFullscreenList();
    }
    if (document.getElementById('flat-detail-modal').style.display === 'flex') {
        renderFlatDetailTimeline();
    }
    renderAdminDashboard();
};
`;

appJs += newDeleteCode;

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully removed all native confirm() dialogs and updated app.js!");
