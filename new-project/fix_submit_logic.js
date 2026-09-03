const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// 1. Update toggleFlatEditMode to store dataset.original for balances
const targetToggleBals = `document.getElementById("flat-edit-balance-a").value = flat.balance || 0;
            document.getElementById("flat-edit-balance-b").value = flat.renovationBalance || 0;`;

const replaceToggleBals = `const balA = document.getElementById("flat-edit-balance-a");
            balA.value = flat.balance || 0;
            balA.dataset.original = flat.balance || 0;
            
            const balB = document.getElementById("flat-edit-balance-b");
            balB.value = flat.renovationBalance || 0;
            balB.dataset.original = flat.renovationBalance || 0;`;

if (appJs.includes(targetToggleBals)) {
    appJs = appJs.replace(targetToggleBals, replaceToggleBals);
}

// 2. Replace the entire submit handler body
const submitRegex = /document\.getElementById\("flat-fee-edit-form"\)\.addEventListener\("submit", function\(e\) \{[\s\S]*?renderAdminDashboard\(\);\n\}\);/;

const newSubmit = `document.getElementById("flat-fee-edit-form").addEventListener("submit", function(e) {
    e.preventDefault();
    
    const flatNum = document.getElementById("flat-detail-flatnum-hidden").value;
    const newOwnerName = document.getElementById("flat-owner-input").value.trim();
    const newPhone = document.getElementById("flat-phone-input").value.trim();
    const newEmail = document.getElementById("flat-email-input").value.trim();
    const newOwnershipShare = parseFloat(document.getElementById("flat-ownership-input").value) || 0;
    const newTenantCount = parseInt(document.getElementById("flat-tenant-input").value) || 1;
    
    const newFee = parseFloat(document.getElementById("flat-edit-fee-a").value) || 0;
    const newFeeDate = document.getElementById("flat-edit-fee-date-a").value;
    
    const newRenovationFee = parseFloat(document.getElementById("flat-edit-fee-b").value) || 0;
    const newRenovationFeeDate = document.getElementById("flat-edit-fee-date-b").value;
    
    const flatIndex = state.flats.findIndex(f => f.flatNum === flatNum);
    if (flatIndex === -1) return;
    const flat = state.flats[flatIndex];
    
    // 1. Process Fee Changes First
    if (newFeeDate) {
        if (!flat.feeChangesKK) flat.feeChangesKK = [];
        const formattedDate = newFeeDate + "-01";
        const existingIdx = flat.feeChangesKK.findIndex(c => c.date === formattedDate);
        if (existingIdx !== -1) flat.feeChangesKK[existingIdx].amount = newFee;
        else flat.feeChangesKK.push({ date: formattedDate, amount: newFee });
    } else {
        flat.monthlyFee = newFee; 
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
    
    flat.ownershipShare = newOwnershipShare;
    flat.tenantCount = newTenantCount;
    
    const user = state.users.find(u => u.flatNum === flatNum && u.role === "Owner");
    if (user) {
        if (newOwnerName) user.name = newOwnerName;
        user.phone = newPhone;
    }
    
    // 2. Recalculate natural balances after fee changes
    recalculateFlatBalances();
    
    // 3. Process Manual Balance Overrides
    const balAInput = document.getElementById("flat-edit-balance-a");
    const targetBalA = parseFloat(balAInput.value) || 0;
    const originalBalA = parseFloat(balAInput.dataset.original) || 0;
    
    const balBInput = document.getElementById("flat-edit-balance-b");
    const targetBalB = parseFloat(balBInput.value) || 0;
    const originalBalB = parseFloat(balBInput.dataset.original) || 0;
    
    const today = new Date().toISOString().split('T')[0];
    let needsSecondRecalc = false;
    
    if (targetBalA !== originalBalA) {
        const naturalBalA = flat.balance || 0;
        const diffA = targetBalA - naturalBalA;
        if (Math.abs(diffA) > 0.01) {
            state.transactions.push({
                id: 'tx-' + Date.now() + '-kk-corr',
                date: today,
                type: "Credit",
                amount: diffA,
                flatNum: flat.flatNum,
                targetAccount: "Közös Költség",
                status: "Verified",
                method: "Egyenleg korrekció",
                reference: diffA > 0 ? "Kézi jóváírás" : "Kézi terhelés"
            });
            needsSecondRecalc = true;
        }
    }
    
    if (targetBalB !== originalBalB) {
        const naturalBalB = flat.renovationBalance || 0;
        const diffB = targetBalB - naturalBalB;
        if (Math.abs(diffB) > 0.01) {
            state.transactions.push({
                id: 'tx-' + Date.now() + '-fa-corr',
                date: today,
                type: "Credit",
                amount: diffB,
                flatNum: flat.flatNum,
                targetAccount: "Felújítási Alap",
                status: "Verified",
                method: "Egyenleg korrekció",
                reference: diffB > 0 ? "Kézi jóváírás" : "Kézi terhelés"
            });
            needsSecondRecalc = true;
        }
    }
    
    if (needsSecondRecalc) {
        recalculateFlatBalances();
    }
    
    saveStateToLocalStorage();
    
    window.openFlatDetailModal(flatNum);
    renderAdminDashboard();
});`;

appJs = appJs.replace(submitRegex, newSubmit);
fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Updated submit logic successfully.");
