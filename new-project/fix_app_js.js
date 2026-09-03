const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const jsCode = `
window.setFlatModalTab = function(accountType) {
    const flatNum = document.getElementById("flat-detail-flatnum-hidden").value;
    
    // Update button styles
    const btnKk = document.getElementById("flat-tab-kk");
    const btnFa = document.getElementById("flat-tab-fa");
    
    if (accountType === "Közös Költség") {
        btnKk.className = "btn btn-primary btn-sm";
        btnFa.className = "btn btn-outline btn-sm";
    } else {
        btnKk.className = "btn btn-outline btn-sm";
        btnFa.className = "btn btn-primary btn-sm";
    }
    
    renderFlatModalTimeline(flatNum, accountType);
};

window.renderFlatModalTimeline = function(flatNum, accountType) {
    const tbody = document.getElementById("flat-modal-tbody");
    if (!tbody) return;
    
    const timeline = getFlatLedgerTimeline(flatNum, accountType);
    
    if (timeline.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nincsenek tranzakciók</td></tr>';
        return;
    }
    
    // Sort descending for display (newest first)
    // Wait, getFlatLedgerTimeline returns sorted ascending. We want to show descending so newest is on top.
    const displayTimeline = [...timeline].reverse();
    
    tbody.innerHTML = displayTimeline.map(item => {
        const isDemand = item.type === "Debit";
        const color = isDemand ? "var(--danger)" : "var(--success)";
        const amountPrefix = isDemand ? "-" : "+";
        
        return \`
            <tr>
                <td>\${item.date}</td>
                <td>
                    <div style="font-weight:500;">\${item.method || (isDemand ? 'Havi Előírás' : 'Befizetés')}</div>
                    <div style="font-size:11px; color:var(--text-muted);">\${item.reference || ''}</div>
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

// Insert the new functions before openFlatDetailModal
appJs = appJs.replace('window.openFlatDetailModal = function(flatNum) {', jsCode + '\nwindow.openFlatDetailModal = function(flatNum) {');

// Inside openFlatDetailModal, we need to initialize the tab to Közös Költség
const regexOpenModal = /(document\.getElementById\("flat-fee-edit-form"\)\.style\.display = "none";\s*document\.getElementById\("flat-info-readonly"\)\.style\.display = "block";)/;
appJs = appJs.replace(regexOpenModal, `$1\n    setTimeout(() => setFlatModalTab('Közös Költség'), 0);`);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("app.js updated successfully!");
