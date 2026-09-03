const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// 1. Update `getFlatLedgerTimeline` to remove `startingBalance` and support `feeChanges`.
const regexTimeline = /function getFlatLedgerTimeline\(flatNum, targetAccount\) \{[\s\S]*?\}\);/;
const newTimelineHtml = `function getFlatLedgerTimeline(flatNum, targetAccount) {
    const flat = state.flats.find(f => f.flatNum === flatNum);
    if (!flat) return [];
    
    const timeline = [];
    
    const months = [
        { date: "2025-06-01", name: "2025 Június" },
        { date: "2025-07-01", name: "2025 Július" },
        { date: "2025-08-01", name: "2025 Augusztus" },
        { date: "2025-09-01", name: "2025 Szeptember" },
        { date: "2025-10-01", name: "2025 Október" },
        { date: "2025-11-01", name: "2025 November" },
        { date: "2025-12-01", name: "2025 December" },
        { date: "2026-01-01", name: "2026 Január" },
        { date: "2026-02-01", name: "2026 Február" },
        { date: "2026-03-01", name: "2026 Március" },
        { date: "2026-04-01", name: "2026 Április" },
        { date: "2026-05-01", name: "2026 Május" },
        { date: "2026-06-01", name: "2026 Június" }
    ];
    
    months.forEach(m => {
        let debitAmount = 0;
        const currentMonthDate = new Date(m.date);
        
        if (targetAccount === "Közös Költség") {
            debitAmount = flat.monthlyFee;
            if (flat.feeChangesKK && flat.feeChangesKK.length > 0) {
                // Find the latest fee change that is active on or before this month
                const activeChanges = flat.feeChangesKK.filter(c => new Date(c.date) <= currentMonthDate);
                if (activeChanges.length > 0) {
                    // Sort descending by date to get the most recent valid one
                    activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
                    debitAmount = activeChanges[0].amount;
                }
            }
        } else {
            debitAmount = flat.renovationFee;
            if (flat.feeChangesFA && flat.feeChangesFA.length > 0) {
                const activeChanges = flat.feeChangesFA.filter(c => new Date(c.date) <= currentMonthDate);
                if (activeChanges.length > 0) {
                    activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
                    debitAmount = activeChanges[0].amount;
                }
            }
        }
        
        timeline.push({
            id: \`d-\${flatNum}-\${targetAccount}-\${m.date}\`,
            date: m.date,
            type: "Debit",
            amount: -debitAmount,
            comment: \`Havi előírás - \${m.name}\`
        });
    });`;
appJs = appJs.replace(regexTimeline, newTimelineHtml);

// 2. Update `openFlatDetailModal` to populate inputs correctly
const openModalRegex = /document\.getElementById\("flat-start-balance-a"\)\.value = flat\.startingBalance \|\| 0;\s*document\.getElementById\("flat-start-balance-b"\)\.value = flat\.startingRenovationBalance \|\| 0;/;
const newOpenModal = `document.getElementById("flat-current-balance-a").value = flat.balance || 0;
    document.getElementById("flat-current-balance-b").value = flat.renovationBalance || 0;
    document.getElementById("flat-fee-date-input").value = ""; // Reset date field
    document.getElementById("flat-renovation-fee-date-input").value = ""; // Reset date field`;
appJs = appJs.replace(openModalRegex, newOpenModal);

// 3. Update the form submit handler
const submitFormRegex = /document\.getElementById\("flat-fee-edit-form"\)\.addEventListener\("submit", function\(e\) \{[\s\S]*?renderAdminDashboard\(\);\s*\}\);/;
const newSubmitForm = `document.getElementById("flat-fee-edit-form").addEventListener("submit", function(e) {
    e.preventDefault();
    
    const flatNum = document.getElementById("flat-detail-flatnum-hidden").value;
    const newOwnerName = document.getElementById("flat-owner-input").value.trim();
    const newPhone = document.getElementById("flat-phone-input").value.trim();
    const newTenantCount = parseInt(document.getElementById("flat-tenant-input").value) || 1;
    
    const newFee = parseFloat(document.getElementById("flat-fee-input").value) || 0;
    const newFeeDate = document.getElementById("flat-fee-date-input").value;
    
    const newRenovationFee = parseFloat(document.getElementById("flat-renovation-fee-input").value) || 0;
    const newRenovationFeeDate = document.getElementById("flat-renovation-fee-date-input").value;
    
    const targetBalA = parseFloat(document.getElementById("flat-current-balance-a").value) || 0;
    const targetBalB = parseFloat(document.getElementById("flat-current-balance-b").value) || 0;
    
    const flatIndex = state.flats.findIndex(f => f.flatNum === flatNum);
    if (flatIndex === -1) return;
    const flat = state.flats[flatIndex];
    
    // Process Balance Corrections
    const diffA = targetBalA - (flat.balance || 0);
    const diffB = targetBalB - (flat.renovationBalance || 0);
    
    const today = new Date().toISOString().split('T')[0];
    
    if (Math.abs(diffA) > 0.01) {
        state.transactions.push({
            id: 'tx-' + Date.now() + '-kk-corr',
            date: today,
            type: "Credit",
            amount: diffA,
            flatNum: flat.flatNum,
            account: "Közös Költség",
            method: "Egyenleg korrekció",
            reference: diffA > 0 ? "Kézi jóváírás" : "Kézi terhelés"
        });
    }
    
    if (Math.abs(diffB) > 0.01) {
        state.transactions.push({
            id: 'tx-' + Date.now() + '-fa-corr',
            date: today,
            type: "Credit",
            amount: diffB,
            flatNum: flat.flatNum,
            account: "Felújítási Alap",
            method: "Egyenleg korrekció",
            reference: diffB > 0 ? "Kézi jóváírás" : "Kézi terhelés"
        });
    }
    
    // Process Fee Changes
    if (newFeeDate) {
        if (!flat.feeChangesKK) flat.feeChangesKK = [];
        const formattedDate = newFeeDate + "-01"; // month inputs return YYYY-MM
        const existingIdx = flat.feeChangesKK.findIndex(c => c.date === formattedDate);
        if (existingIdx !== -1) flat.feeChangesKK[existingIdx].amount = newFee;
        else flat.feeChangesKK.push({ date: formattedDate, amount: newFee });
    } else {
        flat.monthlyFee = newFee; // fallback base change if no date given
    }
    
    if (newRenovationFeeDate) {
        if (!flat.feeChangesFA) flat.feeChangesFA = [];
        const formattedDate = newRenovationFeeDate + "-01";
        const existingIdx = flat.feeChangesFA.findIndex(c => c.date === formattedDate);
        if (existingIdx !== -1) flat.feeChangesFA[existingIdx].amount = newRenovationFee;
        else flat.feeChangesFA.push({ date: formattedDate, amount: newRenovationFee });
    } else {
        flat.renovationFee = newRenovationFee;
    }
    
    flat.tenantCount = newTenantCount;
    delete flat.startingBalance; // wipe out old legacy fields if any
    delete flat.startingRenovationBalance;
    
    // Update owner user name and phone if they exist
    const user = state.users.find(u => u.flatNum === flatNum && u.role === "Owner");
    if (user) {
        if (newOwnerName) user.name = newOwnerName;
        user.phone = newPhone;
    }
    
    saveStateToLocalStorage();
    recalculateFlatBalances();
    
    window.openFlatDetailModal(flatNum);
    renderAdminDashboard();
});`;
appJs = appJs.replace(submitFormRegex, newSubmitForm);

// Ensure recalculateFlatBalances does not rely on startBal logic anywhere
const recalcRegex = /flat\.startingBalance/g;
appJs = appJs.replace(recalcRegex, '0');
const recalcRegex2 = /flat\.startingRenovationBalance/g;
appJs = appJs.replace(recalcRegex2, '0');

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Replaced logic in app.js!");
