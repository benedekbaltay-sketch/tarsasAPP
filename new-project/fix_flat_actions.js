const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Replace the actionsHtml check in renderFullscreenList for flat type
const oldActionsStr = `const actionsHtml = fullscreenEditMode && !isDemand ? \`
                <div class="tx-actions">
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:4px;" onclick="openEditModal('\${item.id}', 'Befizet\u00e9s')" title="M\u00f3dos\u00edt\u00e1s">
                        <i data-lucide="edit-3" style="width:16px;height:16px;"></i>
                    </button>
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; color:var(--danger); padding:4px;" onclick="deleteFlatLedgerTx('\${item.id}')" title="T\u00f6rl\u00e9s">
                        <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                    </button>
                </div>
            \` : '';`;

const newActionsStr = `const actionsHtml = fullscreenEditMode ? \`
                <div class="tx-actions">
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:4px;" onclick="\${item.id ? \`openEditModal('\${item.id}', 'Befizetés')\` : \`openFullscreenCommentEdit('\${flatNum}', '\${item.date}', '\${item.type}', '\${item.account}', '')\`}" title="Módosítás">
                        <i data-lucide="edit-3" style="width:16px;height:16px;"></i>
                    </button>
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; color:var(--danger); padding:4px;" onclick="deleteFlatLedgerTx('\${item.id || ''}', '\${flatNum}', '\${item.date}', '\${item.account}')" title="Törlés">
                        <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                    </button>
                </div>
            \` : '';`;

if (appJs.includes('const actionsHtml = fullscreenEditMode && !isDemand ?')) {
    appJs = appJs.replace(/const actionsHtml = fullscreenEditMode && !isDemand \?[\s\S]*?` : '';/, newActionsStr);
    console.log("Successfully removed !isDemand restriction!");
} else {
    console.log("Regex pattern for actionsHtml not found - trying string replace");
}

// Update deleteFlatLedgerTx to handle generated debits
const oldDeleteFlatFunc = `window.deleteFlatLedgerTx = function(txId) {
    window.deleteTransaction(txId, 'Befizetés');
};`;

const newDeleteFlatFunc = `window.deleteFlatLedgerTx = function(txId, flatNum, date, account) {
    if (txId) {
        window.deleteTransaction(txId, 'Befizetés');
    } else if (flatNum && date) {
        document.getElementById('delete-tx-id-hidden').value = \`DEBIT_\${flatNum}_\${date}_\${account}\`;
        document.getElementById('delete-tx-type-hidden').value = 'Debit';
        document.getElementById('delete-tx-confirm-modal').style.display = 'flex';
        if (window.lucide) lucide.createIcons();
    }
};`;

if (appJs.includes('window.deleteFlatLedgerTx = function(txId)')) {
    appJs = appJs.replace(oldDeleteFlatFunc, newDeleteFlatFunc);
    console.log("Successfully updated deleteFlatLedgerTx");
}

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("app.js updated successfully");
