const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// 1. Add checkFeeChange function
if (!appJs.includes('window.checkFeeChange = function')) {
    const fn = `
window.checkFeeChange = function(type) {
    const input = document.getElementById(type === 'KK' ? 'flat-edit-fee-a' : 'flat-edit-fee-b');
    const container = document.getElementById(type === 'KK' ? 'flat-edit-fee-date-container-a' : 'flat-edit-fee-date-container-b');
    const original = parseFloat(input.dataset.original) || 0;
    const current = parseFloat(input.value) || 0;
    if (current !== original) {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
};
`;
    // Insert before toggleFlatEditMode
    appJs = appJs.replace('window.toggleFlatEditMode = function(showEdit) {', fn + '\nwindow.toggleFlatEditMode = function(showEdit) {');
}

// 2. Update toggleFlatEditMode
const targetToggle1 = `    if (showEdit) {
        roView.style.display = "none";
        editForm.style.display = "flex";
        editBtn.style.display = "none";
    } else {
        roView.style.display = "block";
        editForm.style.display = "none";
        editBtn.style.display = "flex";
    }`;
const replaceToggle1 = `    if (showEdit) {
        roView.style.display = "none";
        editForm.style.display = "flex";
        editBtn.style.display = "none";
        document.querySelectorAll('.ro-stat-item').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.edit-stat-item').forEach(el => el.style.display = el.tagName === 'INPUT' ? 'block' : 'flex');
        
        // Populate inputs
        const flatNum = document.getElementById("flat-detail-flatnum-hidden").value;
        const flat = state.flats.find(f => f.flatNum === flatNum);
        if (flat) {
            document.getElementById("flat-edit-balance-a").value = flat.balance || 0;
            document.getElementById("flat-edit-balance-b").value = flat.renovationBalance || 0;
            
            const feeA = document.getElementById("flat-edit-fee-a");
            feeA.value = flat.monthlyFee || 0;
            feeA.dataset.original = flat.monthlyFee || 0;
            document.getElementById("flat-edit-fee-date-a").value = "";
            document.getElementById("flat-edit-fee-date-container-a").style.display = "none";
            
            const feeB = document.getElementById("flat-edit-fee-b");
            feeB.value = flat.renovationFee || 0;
            feeB.dataset.original = flat.renovationFee || 0;
            document.getElementById("flat-edit-fee-date-b").value = "";
            document.getElementById("flat-edit-fee-date-container-b").style.display = "none";
        }
    } else {
        roView.style.display = "block";
        editForm.style.display = "none";
        editBtn.style.display = "flex";
        document.querySelectorAll('.ro-stat-item').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.edit-stat-item').forEach(el => el.style.display = 'none');
    }`;
appJs = appJs.replace(targetToggle1, replaceToggle1);

// Remove the old assignments in openFlatDetailModal that crash
appJs = appJs.replace('document.getElementById("flat-fee-input").value = flat.monthlyFee;', '');
appJs = appJs.replace('document.getElementById("flat-renovation-fee-input").value = flat.renovationFee;', '');
appJs = appJs.replace('document.getElementById("flat-fee-date-input").value = ""; // Reset date field', '');
appJs = appJs.replace('document.getElementById("flat-renovation-fee-date-input").value = ""; // Reset date field', '');

// 3. Update form submit handler
const targetSubmit1 = `    const newFee = parseInt(document.getElementById("flat-fee-input").value, 10);
    const newFeeDate = document.getElementById("flat-fee-date-input").value;
    
    const newRenovationFee = parseFloat(document.getElementById("flat-renovation-fee-input").value) || 0;
    const newRenovationFeeDate = document.getElementById("flat-renovation-fee-date-input").value;
    
    const flatIndex = state.flats.findIndex(f => f.flatNum === flatNum);
    if (flatIndex === -1) return;
    const flat = state.flats[flatIndex];
    
    const today = new Date().toISOString().split('T')[0];`;

const replaceSubmit1 = `    const newFee = parseInt(document.getElementById("flat-edit-fee-a").value, 10);
    const newFeeDate = document.getElementById("flat-edit-fee-date-a").value;
    
    const newRenovationFee = parseFloat(document.getElementById("flat-edit-fee-b").value) || 0;
    const newRenovationFeeDate = document.getElementById("flat-edit-fee-date-b").value;
    
    const targetBalA = parseFloat(document.getElementById("flat-edit-balance-a").value) || 0;
    const targetBalB = parseFloat(document.getElementById("flat-edit-balance-b").value) || 0;
    
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
    }`;

appJs = appJs.replace(targetSubmit1, replaceSubmit1);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Updated app.js");
