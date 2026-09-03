const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// 1. Replace deleteTransaction to use custom modal
const startDT = 'window.deleteTransaction = function(id, type) {';
const endDT = 'window.deleteTransaction';
const si = appJs.indexOf(startDT);
// find the end: next window. function after si
let ei = appJs.indexOf('\nwindow.', si + startDT.length);

if (si === -1) { console.log("deleteTransaction not found"); process.exit(1); }

const newDeleteTx = `window.deleteTransaction = function(id, type) {
    document.getElementById('delete-tx-id-hidden').value = id;
    document.getElementById('delete-tx-type-hidden').value = type;
    document.getElementById('delete-tx-confirm-modal').style.display = 'flex';
    lucide.createIcons();
};

window.confirmDeleteTx = function() {
    const id = document.getElementById('delete-tx-id-hidden').value;
    const type = document.getElementById('delete-tx-type-hidden').value;
    document.getElementById('delete-tx-confirm-modal').style.display = 'none';
    
    if (type === "Befizetés" || type === "Credit" || type === "Correction") {
        const idx = state.transactions.findIndex(t => t.id === id);
        if (idx !== -1) {
            state.transactions.splice(idx, 1);
            saveStateToLocalStorage();
            recalculateFlatBalances();
        }
    } else if (type === "Kiadás") {
        const idx = state.expenses.findIndex(e => e.id === id);
        if (idx !== -1) {
            state.expenses.splice(idx, 1);
            saveStateToLocalStorage();
        }
    }
    
    if (document.getElementById('fullscreen-tx-modal').style.display === 'flex') {
        renderFullscreenList();
    }
    renderAdminDashboard();
};

`;

appJs = appJs.substring(0, si) + newDeleteTx + appJs.substring(ei);

// 2. Replace deleteFlatLedgerTx to use custom modal
const startDFL = 'window.deleteFlatLedgerTx = function(txId) {';
const siDFL = appJs.indexOf(startDFL);
const eiDFL = appJs.indexOf('\nwindow.', siDFL + startDFL.length);

if (siDFL === -1) { console.log("deleteFlatLedgerTx not found"); process.exit(1); }

const newDeleteFlat = `window.deleteFlatLedgerTx = function(txId) {
    document.getElementById('delete-tx-id-hidden').value = txId;
    document.getElementById('delete-tx-type-hidden').value = 'Befizetés';
    document.getElementById('delete-tx-confirm-modal').style.display = 'flex';
    lucide.createIcons();
};

`;

appJs = appJs.substring(0, siDFL) + newDeleteFlat + appJs.substring(eiDFL);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log('✓ deleteTransaction and deleteFlatLedgerTx updated to use custom modal');
