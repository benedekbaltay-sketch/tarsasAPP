const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';

let indexHtml = fs.readFileSync(indexPath, 'utf8');
let appJs = fs.readFileSync(appPath, 'utf8');

// 1. Update index.html to call openFullscreenTx('flat')
indexHtml = indexHtml.replace(
    /onclick="toggleFlatViewAll\(\)"/g, 
    'onclick="openFullscreenTx(\'flat\')"'
);
indexHtml = indexHtml.replace('v=38', 'v=39');
fs.writeFileSync(indexPath, indexHtml, 'utf8');


// 2. Update app.js
// Remove toggleFlatViewAll
appJs = appJs.replace(/window\.toggleFlatViewAll = function\(\) \{[\s\S]*?renderFlatDetailTimeline\(\);\s*\};\s*/, '');

// Update renderFlatDetailTimeline to NEVER expand, always slice 3
const renderDetailRegex = /function renderFlatDetailTimeline\(\) \{[\s\S]*?\}\.join\(""\);\s*\}/;
const newRenderDetail = `function renderFlatDetailTimeline() {
    const flatNum = state.currentFlatDetailNum;
    const tbody = document.getElementById("flat-detail-ledger-tbody");
    if (!tbody) return;
    
    const timeline = getCombinedFlatLedgerTimeline(flatNum);
    
    if (timeline.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nincsenek tranzakciók</td></tr>';
        document.getElementById("flat-view-all-container").style.display = "none";
        return;
    }
    
    const displayTimelineFull = [...timeline].reverse();
    const displayTimeline = displayTimelineFull.slice(0, 3);
    
    if (displayTimelineFull.length <= 3) {
        document.getElementById("flat-view-all-container").style.display = "none";
    } else {
        document.getElementById("flat-view-all-container").style.display = "block";
    }
    
    tbody.innerHTML = displayTimeline.map(item => {
        const isDemand = item.type === "Debit";
        const color = isDemand ? "var(--danger)" : "var(--success)";
        const amountPrefix = isDemand ? "-" : "+";
        
        return \`
            <tr>
                <td>\${item.date}</td>
                <td>
                    <div style="font-weight:500;">\${item.method || (isDemand ? 'Havi Előírás' : 'Befizetés')}</div>
                    <div style="font-size:11px; color:var(--text-muted);">\${item.account} \${item.reference ? '- ' + item.reference : ''}</div>
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
}`;
appJs = appJs.replace(renderDetailRegex, newRenderDetail);

// Update openFullscreenTx
const fullscreenFlatRegex = /if \(type === 'flat'\) \{[\s\S]*?\} else if \(type === 'global'\)/;
const newFullscreenFlat = `if (type === 'flat') {
        title.textContent = \`\${state.currentFlatDetailNum}. Lakás teljes tranzakció előzménye\`;
        
        const timeline = getCombinedFlatLedgerTimeline(state.currentFlatDetailNum);
        const sortedTimeline = [...timeline].reverse();
        
        sortedTimeline.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "tx-item";
            
            let iconHtml = "";
            let iconClass = "";
            
            if (item.type === "Debit") {
                iconClass = "expense";
                iconHtml = \`<div class="tx-icon \${iconClass}"><i data-lucide="minus" style="width:14px;height:14px;"></i></div>\`;
            } else {
                iconClass = "income";
                iconHtml = \`<div class="tx-icon \${iconClass}"><i data-lucide="plus" style="width:14px;height:14px;"></i></div>\`;
            }
            
            const isDemand = item.type === "Debit";
            const amountPrefix = isDemand ? "-" : "+";
            const amountColor = isDemand ? "var(--danger)" : "var(--success)";
            
            itemEl.innerHTML = \`
                \${iconHtml}
                <div class="tx-details">
                    <div class="tx-date">\${item.date} \${item.account ? '• ' + item.account : ''}</div>
                    <div class="tx-method">\${item.method || (isDemand ? 'Havi Előírás' : 'Befizetés')}</div>
                    <div class="tx-desc">\${item.reference || ""}</div>
                </div>
                <div class="tx-amounts">
                    <div class="tx-amount" style="color: \${amountColor};">\${amountPrefix}\${formatCurrency(item.amount)}</div>
                    <div class="tx-balance" style="font-size:11px; color:var(--text-muted);">Egyenleg: \${formatCurrency(item.runningBalance)}</div>
                </div>
            \`;
            tbody.appendChild(itemEl);
        });
    } else if (type === 'global')`;
appJs = appJs.replace(fullscreenFlatRegex, newFullscreenFlat);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Updated both files!");
