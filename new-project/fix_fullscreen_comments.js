const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Inject the edit button into renderTimelineTable for flat timelines
const targetFullTxAmounts = `                <div class="tx-amounts">
                    <div class="tx-amount" style="color: \${amountColor};">\${amountPrefix}\${formatCurrency(item.amount)}</div>
                    <div class="tx-balance" style="font-size:11px; color:var(--text-muted);">Egyenleg: \${formatCurrency(item.runningBalance)}</div>
                </div>`;

const replaceFullTxAmounts = `                <div class="tx-amounts" style="display:flex; flex-direction:column; align-items:flex-end;">
                    <div style="display:flex; align-items:center;">
                        <div class="tx-amount" style="color: \${amountColor};">\${amountPrefix}\${formatCurrency(item.amount)}</div>
                        <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:4px; margin-left: 8px; height:auto; background:transparent;" onclick="editLedgerComment('\${state.currentFlatDetailNum}', '\${item.date}', '\${item.type}', '\${item.account}', '\${item.id || ''}')" title="Megjegyzés szerkesztése">
                            <i data-lucide="message-square" style="width:14px;height:14px;color:var(--primary)"></i>
                        </button>
                    </div>
                    <div class="tx-balance" style="font-size:11px; color:var(--text-muted);">Egyenleg: \${formatCurrency(item.runningBalance)}</div>
                </div>`;

if (appJs.includes(targetFullTxAmounts)) {
    appJs = appJs.replace(targetFullTxAmounts, replaceFullTxAmounts);
} else {
    console.log("Could not find targetFullTxAmounts");
}

// Also, the comment needs to be visible in the tx-desc
const targetTxDesc = `<div class="tx-desc">\${item.reference || ""}</div>`;
const replaceTxDesc = `<div class="tx-desc">\${item.reference || ""} \${item.comment ? ' • ' + item.comment : ''}</div>`;

if (appJs.includes(targetTxDesc)) {
    appJs = appJs.replace(targetTxDesc, replaceTxDesc);
} else {
    console.log("Could not find targetTxDesc");
}

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Updated renderTimelineTable with comment buttons");
