const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// We will find the entire renderFlatDetailTimeline function and replace it.
// To avoid regex unicode matching issues, we match from 'function renderFlatDetailTimeline() {'
// to 'window.deleteLedgerTransaction = function(txId) {'

const startStr = "function renderFlatDetailTimeline() {";
const endStr = "window.deleteLedgerTransaction = function(txId) {";

const startIndex = appJs.indexOf(startStr);
const endIndex = appJs.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const newFunction = `function renderFlatDetailTimeline() {
    const flatNum = state.currentFlatDetailNum;
    const tbody = document.getElementById("flat-detail-ledger-tbody");
    if (!tbody) return;
    
    // We expect getCombinedFlatLedgerTimeline to exist because it was added in fix_app_js_3.js
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
            viewAllBtn.innerHTML = state.flatViewAll ? "Kevesebb tranzakci" : "Minden tranzakci megjelentse";
        }
    }
    
    tbody.innerHTML = displayTimeline.map(item => {
        const isDemand = item.type === "Debit";
        const color = isDemand ? "var(--danger)" : "var(--success)";
        const amountPrefix = isDemand ? "-" : "+";
        
        return \`
            <tr>
                <td>\${item.date}</td>
                <td>
                    <div style="font-weight:500;">
                        \${item.method || (isDemand ? 'Havi El\\u0151\\u00edr\\u00e1s' : 'Befizet\\u00e9s')}
                        <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:2px; margin-left:5px; height:auto; background:transparent;" onclick="editLedgerComment('\${flatNum}', '\${item.date}', '\${item.type}', '\${item.account}', '\${item.id || ''}')" title="Megjegyzés szerkesztése">
                            <i data-lucide="message-square" style="width:12px;height:12px;color:var(--primary)"></i>
                        </button>
                    </div>
                    <div style="font-size:11px; color:var(--text-muted);">\${item.account} \${item.reference ? '- ' + item.reference : ''} \${item.comment ? '   ' + item.comment : ''}</div>
                </td>
                <td style="color:\${color}; font-weight:600; text-align:right;">
                    \${amountPrefix}\${formatCurrency(item.amount)}
                </td>
                <td style="text-align:right; font-weight:500;">
                    \${formatCurrency(item.runningBalance)}
                </td>
            </tr>
        \`;
    }).join("");
    if (window.lucide) lucide.createIcons();
}

`;

    appJs = appJs.substring(0, startIndex) + newFunction + appJs.substring(endIndex);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Successfully replaced renderFlatDetailTimeline");
} else {
    console.log("Could not find start or end bounds.");
}
