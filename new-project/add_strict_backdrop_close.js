const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const strictBackdropLogic = `
// Strict Backdrop Click-to-Close Setup
// Modal ONLY closes if both mousedown AND mouseup happen on the backdrop outside the modal box
function setupStrictBackdropClose(modalId, closeFn) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    let mousedownOnBackdrop = false;
    
    modal.addEventListener("mousedown", function(e) {
        mousedownOnBackdrop = (e.target === modal);
    });
    
    modal.addEventListener("mouseup", function(e) {
        if (mousedownOnBackdrop && e.target === modal) {
            closeFn();
        }
        mousedownOnBackdrop = false;
    });
}

// Remove old loose click handlers and bind strict handlers
window.addEventListener("DOMContentLoaded", () => {
    setupStrictBackdropClose("flat-detail-modal", window.closeFlatDetailModal);
    setupStrictBackdropClose("edit-transaction-modal", closeModal);
    setupStrictBackdropClose("transaction-modal", window.closeTransactionModal);
    setupStrictBackdropClose("add-flat-modal", window.closeAddFlatModal);
    setupStrictBackdropClose("delete-confirm-modal", closeDeleteModal);
    setupStrictBackdropClose("delete-tx-confirm-modal", () => { document.getElementById('delete-tx-confirm-modal').style.display = 'none'; });
    setupStrictBackdropClose("global-balances-modal", closeGlobalBalancesModal);
});
`;

// Remove old loose event listeners for e.target === this
appJs = appJs.replace(/document\.getElementById\("flat-detail-modal"\)\.addEventListener\("click",\s*function\(e\)\s*\{\s*if\s*\(e\.target\s*===\s*this\)\s*\{\s*window\.closeFlatDetailModal\(\);\s*\}\s*\}\);/g, '');
appJs = appJs.replace(/document\.getElementById\("edit-transaction-modal"\)\.addEventListener\("click",\s*function\(e\)\s*\{\s*if\s*\(e\.target\s*===\s*this\)\s*\{\s*closeModal\(\);\s*\}\s*\}\);/g, '');

if (!appJs.includes("function setupStrictBackdropClose")) {
    appJs += '\n' + strictBackdropLogic;
}

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully added strict backdrop close logic to app.js");
