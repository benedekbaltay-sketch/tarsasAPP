const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Ensure state.flatViewAll exists
if (!appJs.includes('flatViewAll:')) {
    appJs = appJs.replace(/isGridEditMode: false/, 'isGridEditMode: false,\n    flatViewAll: false');
}

const jsCode = `
window.getCombinedFlatLedgerTimeline = function(flatNum) {
    const tlKk = getFlatLedgerTimeline(flatNum, "Közös Költség");
    const tlFa = getFlatLedgerTimeline(flatNum, "Felújítási Alap");
    
    tlKk.forEach(i => i.account = "Közös Költség");
    tlFa.forEach(i => i.account = "Felújítási Alap");
    
    let combined = [...tlKk, ...tlFa];
    // Sort chronologically (oldest first)
    combined.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let combinedBalance = 0;
    combined.forEach(item => {
        combinedBalance += item.amount;
        item.runningBalance = combinedBalance; // recalculate combined running balance
    });
    
    return combined;
};

window.toggleFlatViewAll = function() {
    state.flatViewAll = !state.flatViewAll;
    const flatNum = document.getElementById("flat-detail-flatnum-hidden").value;
    renderFlatModalTimeline(flatNum);
};

window.renderFlatModalTimeline = function(flatNum) {
    const tbody = document.getElementById("flat-modal-tbody");
    if (!tbody) return;
    
    const timeline = getCombinedFlatLedgerTimeline(flatNum);
    
    if (timeline.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nincsenek tranzakciók</td></tr>';
        document.getElementById("flat-view-all-container").style.display = "none";
        return;
    }
    
    // Reverse so newest is on top
    const displayTimelineFull = [...timeline].reverse();
    const displayTimeline = state.flatViewAll ? displayTimelineFull : displayTimelineFull.slice(0, 3);
    
    const viewAllBtn = document.getElementById("flat-view-all-btn");
    if (viewAllBtn) {
        if (displayTimelineFull.length <= 3) {
            document.getElementById("flat-view-all-container").style.display = "none";
        } else {
            document.getElementById("flat-view-all-container").style.display = "block";
            viewAllBtn.innerHTML = state.flatViewAll ? "Kevesebb tranzakció" : "Minden tranzakció megtekintése";
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
};
`;

// Remove the old setFlatModalTab and renderFlatModalTimeline
const regexOldLogic = /window\.setFlatModalTab = function\(accountType\) \{[\s\S]*?window\.renderFlatModalTimeline = function\(flatNum, accountType\) \{[\s\S]*?\}\.join\(""\);\s*\};/;
appJs = appJs.replace(regexOldLogic, jsCode);

// Change how it's initialized in openFlatDetailModal
const regexInit = /setTimeout\(\(\) => setFlatModalTab\('Közös Költség'\), 0\);/;
appJs = appJs.replace(regexInit, "state.flatViewAll = false; setTimeout(() => renderFlatModalTimeline(flatNum), 0);");

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Updated app.js!");
