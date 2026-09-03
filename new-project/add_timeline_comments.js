const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// 1. Add editLedgerComment function
const editLedgerFunction = `
window.editLedgerComment = function(flatNum, date, type, account, txId) {
    let currentComment = "";
    let txIndex = -1;
    let flatIndex = state.flats.findIndex(f => f.flatNum === flatNum);
    if (flatIndex === -1) return;
    
    if (type === "Debit") {
        if (state.flats[flatIndex].debitComments) {
            currentComment = state.flats[flatIndex].debitComments[\`\${date}_\${account}\`] || "";
        }
    } else {
        txIndex = state.transactions.findIndex(t => t.id === txId);
        if (txIndex !== -1) {
            currentComment = state.transactions[txIndex].comment || "";
        }
    }
    
    const newComment = prompt("Írja be a megjegyzést ehhez a tételhez (üresen hagyva törli):", currentComment);
    if (newComment === null) return;
    
    if (type === "Debit") {
        if (!state.flats[flatIndex].debitComments) state.flats[flatIndex].debitComments = {};
        state.flats[flatIndex].debitComments[\`\${date}_\${account}\`] = newComment.trim();
    } else if (txIndex !== -1) {
        state.transactions[txIndex].comment = newComment.trim();
    }
    
    saveStateToLocalStorage();
    
    // Refresh UI
    if (document.getElementById("flat-detail-modal").style.display === "flex") {
        // Just calling openFlatDetailModal again re-renders the detail view
        openFlatDetailModal(flatNum);
        
        // If the timeline fullscreen modal is also open, refresh it too
        if (document.getElementById("timeline-modal").style.display === "flex") {
            // Re-render the big list
            const timeline = getCombinedFlatLedgerTimeline(flatNum);
            const tbody = document.getElementById("timeline-tbody");
            // Find render logic... it's easier to just call renderFlatModalTimeline
            renderFlatModalTimeline(flatNum);
            lucide.createIcons();
        }
    }
    renderAdminDashboard();
};
`;
if (!appJs.includes('window.editLedgerComment')) {
    appJs += '\n' + editLedgerFunction;
}

// 2. Modify getFlatLedgerTimeline debit creation
const targetDebit = `        timeline.push({
            id: \`d-\${flatNum}-\${targetAccount}-\${m.date}\`,
            date: m.date,
            type: "Debit",
            amount: -debitAmount,
            comment: \`Havi el\\u0151\\u00edr\\u00e1s - \${m.name}\`
        });`;

const replaceDebit = `        let userComment = flat.debitComments && flat.debitComments[\`\${m.date}_\${targetAccount}\`];
        timeline.push({
            id: \`d-\${flatNum}-\${targetAccount}-\${m.date}\`,
            date: m.date,
            type: "Debit",
            amount: -debitAmount,
            comment: userComment ? userComment : \`Havi el\\u0151\\u00edr\\u00e1s - \${m.name}\`
        });`;
// Using regex to replace since encoding of "el'rs" might be tricky in pure string replacement
appJs = appJs.replace(/timeline\.push\(\{\s*id:\s*`d-\${flatNum}-\${targetAccount}-\${m\.date}`,\s*date:\s*m\.date,\s*type:\s*"Debit",\s*amount:\s*-debitAmount,\s*comment:.*?\}\);/s, replaceDebit);

// 3. Modify renderFlatDetailTimeline
const targetSmallTitle = `<div style="font-weight:500;">\${item.method || (isDemand ? 'Havi El\\u0151\\u00edr\\u00e1s' : 'Befizet\\u00e9s')}</div>`;
const replaceSmallTitle = `<div style="font-weight:500;">
                        \${item.method || (isDemand ? 'Havi El\\u0151\\u00edr\\u00e1s' : 'Befizet\\u00e9s')}
                        <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:2px; margin-left:5px; height:auto; background:transparent;" onclick="editLedgerComment('\${flatNum}', '\${item.date}', '\${item.type}', '\${item.account}', '\${item.id || ''}')" title="Megjegyzés szerkesztése">
                            <i data-lucide="message-square" style="width:14px;height:14px;color:var(--primary)"></i>
                        </button>
                    </div>`;
// regex replace
appJs = appJs.replace(/<div style="font-weight:500;">\$\{item\.method \|\| \(isDemand \? 'Havi El.*?' : 'Befizet.*?'\)\}<\/div>/s, replaceSmallTitle);

// 4. Modify renderTimelineTable (which actually is inside renderFlatModalTimeline in fix_fullscreen_tx.js replacement!)
// Let's find the large timeline mapping. Wait, renderFlatModalTimeline has a `forEach` creating `tx-item` divs!
const targetLargeTxItem = `<div class="tx-amount-group">
                    <div class="tx-amount \${amountColor}">\${amountPrefix}\${formatCurrency(item.amount)}</div>
                </div>`;
const replaceLargeTxItem = `<div class="tx-amount-group" style="display:flex; align-items:center;">
                    <div class="tx-amount \${amountColor}">\${amountPrefix}\${formatCurrency(item.amount)}</div>
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:4px; margin-left: 8px;" onclick="editLedgerComment('\${state.currentFlatDetailNum}', '\${item.date}', '\${item.type}', '\${item.account}', '\${item.id || ''}')" title="Megjegyzés szerkesztése">
                        <i data-lucide="message-square" style="width:16px;height:16px;color:var(--primary)"></i>
                    </button>
                </div>`;
appJs = appJs.replace(targetLargeTxItem, replaceLargeTxItem);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Added comment editing capabilities to flat timeline!");
