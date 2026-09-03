const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// 1. Add saveInlineLedgerComment function
const saveInlineLedgerCommentFunc = `
window.saveInlineLedgerComment = function(flatNum, date, type, account, txId, inputEl) {
    const newComment = inputEl.value.trim();
    let flatIndex = state.flats.findIndex(f => f.flatNum === flatNum);
    if (flatIndex === -1) return;
    
    if (type === "Debit") {
        if (!state.flats[flatIndex].debitComments) state.flats[flatIndex].debitComments = {};
        state.flats[flatIndex].debitComments[\`\${date}_\${account}\`] = newComment;
    } else {
        let txIndex = state.transactions.findIndex(t => t.id === txId);
        if (txIndex !== -1) {
            state.transactions[txIndex].comment = newComment;
        }
    }
    
    saveStateToLocalStorage();
    
    // Visual feedback
    const origBg = inputEl.style.backgroundColor;
    const origTrans = inputEl.style.transition;
    inputEl.style.transition = "background-color 0.2s";
    inputEl.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
    setTimeout(() => {
        inputEl.style.backgroundColor = origBg;
        setTimeout(() => inputEl.style.transition = origTrans, 200);
    }, 400);
};
`;

if (!appJs.includes('window.saveInlineLedgerComment')) {
    appJs += '\n' + saveInlineLedgerCommentFunc;
}

// 2. Update renderFlatDetailTimeline
// We will replace the entire function again.
const startStr = "function renderFlatDetailTimeline() {";
const endStr = "window.deleteLedgerTransaction = function(txId) {";

const startIndex = appJs.indexOf(startStr);
const endIndex = appJs.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const newFunction = `function renderFlatDetailTimeline() {
    const flatNum = state.currentFlatDetailNum;
    const tbody = document.getElementById("flat-detail-ledger-tbody");
    if (!tbody) return;
    
    const timeline = getCombinedFlatLedgerTimeline(flatNum);
    
    if (timeline.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nincsenek tranzakcik</td></tr>';
        document.getElementById("flat-view-all-container").style.display = "none";
        return;
    }
    
    const displayTimelineFull = [...timeline].reverse();
    const displayTimeline = state.flatViewAll ? displayTimelineFull : displayTimelineFull.slice(0, 3);
    
    const viewAllBtn = document.getElementById("flat-view-all-btn");
    if (viewAllBtn) {
        if (displayTimelineFull.length <= 3) {
            document.getElementById("flat-view-all-container").style.display = "none";
        } else {
            document.getElementById("flat-view-all-container").style.display = "";
            viewAllBtn.innerHTML = state.flatViewAll ? "Kevesebb tranzakci" : "Minden tranzakci megtekintse";
        }
    }
    
    tbody.innerHTML = displayTimeline.map(item => {
        const isDemand = item.type === "Debit";
        const color = isDemand ? "var(--danger)" : "var(--success)";
        const amountPrefix = isDemand ? "-" : "+";
        const safeComment = (item.comment || '').replace(/"/g, '&quot;');
        
        return \`
            <tr>
                <td style="vertical-align: top; padding-top: 12px;">\${item.date}</td>
                <td style="padding-top: 10px; padding-bottom: 10px;">
                    <div style="font-weight:500;">
                        \${item.method || (isDemand ? 'Havi El\\u0151\\u00edr\\u00e1s' : 'Befizet\\u00e9s')}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); margin-bottom: 4px;">\${item.account} \${item.reference ? '- ' + item.reference : ''}</div>
                    <div>
                        <input type="text" 
                               value="\${safeComment}" 
                               placeholder="Ide rhatsz megjegyzst..." 
                               class="form-control" 
                               style="height: 24px; font-size: 11px; padding: 2px 6px; width: 100%; border: 1px dashed var(--border-color); background: transparent;"
                               onchange="saveInlineLedgerComment('\${flatNum}', '\${item.date}', '\${item.type}', '\${item.account}', '\${item.id || ''}', this)"
                        >
                    </div>
                </td>
                <td style="color:\${color}; font-weight:600; text-align:right; vertical-align: top; padding-top: 12px;">
                    \${amountPrefix}\${formatCurrency(item.amount)}
                </td>
                <td style="text-align:right; font-weight:500; vertical-align: top; padding-top: 12px;">
                    \${formatCurrency(item.runningBalance)}
                </td>
            </tr>
        \`;
    }).join("");
    if (window.lucide) lucide.createIcons();
}

`;
    appJs = appJs.substring(0, startIndex) + newFunction + appJs.substring(endIndex);
}

// 3. Update renderTimelineTable
// We need to find the tx-desc and tx-amount blocks inside renderTimelineTable.
// Let's replace the whole itemEl.innerHTML assignment in renderTimelineTable.
// Finding: itemEl.innerHTML = ` ... `; tbody.appendChild(itemEl);
const targetInner = /itemEl\.innerHTML\s*=\s*`[\s\S]*?`;\s*tbody\.appendChild\(itemEl\);/g;

// Wait, I need to be careful to only replace the one in renderTimelineTable(type === 'flat').
// Let's use string manipulation based on context.

const flatTypeBlock = appJs.substring(appJs.indexOf("if (type === 'flat') {"), appJs.indexOf("} else if (type === 'global') {"));

if (flatTypeBlock) {
    const replaceBlock = flatTypeBlock.replace(/itemEl\.innerHTML\s*=\s*`[\s\S]*?`;/, `
            const safeComment = (item.comment || '').replace(/"/g, '&quot;');
            itemEl.innerHTML = \`
                \${iconHtml}
                <div class="tx-details" style="flex: 1;">
                    <div class="tx-date">\${item.date} \${item.account ? ' \\u2022 ' + item.account : ''}</div>
                    <div class="tx-method">\${item.method || (isDemand ? 'Havi El\\u0151\\u00edr\\u00e1s' : 'Befizet\\u00e9s')}</div>
                    <div class="tx-desc">\${item.reference || ""}</div>
                    <div style="margin-top: 6px;">
                        <input type="text" 
                               value="\${safeComment}" 
                               placeholder="Ide rhatsz megjegyzst..." 
                               class="form-control" 
                               style="height: 28px; font-size: 12px; padding: 4px 8px; width: 100%; max-width: 400px; border: 1px dashed var(--border-color); background: transparent;"
                               onchange="saveInlineLedgerComment('\${state.currentFlatDetailNum}', '\${item.date}', '\${item.type}', '\${item.account}', '\${item.id || ''}', this)"
                        >
                    </div>
                </div>
                <div class="tx-amounts">
                    <div class="tx-amount" style="color: \${amountColor};">\${amountPrefix}\${formatCurrency(item.amount)}</div>
                    <div class="tx-balance" style="font-size:11px; color:var(--text-muted);">Egyenleg: \${formatCurrency(item.runningBalance)}</div>
                </div>
            \`;`);
    
    appJs = appJs.replace(flatTypeBlock, replaceBlock);
}

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Updated app.js for inline comments");
