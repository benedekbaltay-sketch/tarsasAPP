const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const targetSubmit = `    const newFee = parseFloat(document.getElementById("flat-fee-input").value) || 0;
    const newFeeDate = document.getElementById("flat-fee-date-input").value;
    
    const newRenovationFee = parseFloat(document.getElementById("flat-renovation-fee-input").value) || 0;
    const newRenovationFeeDate = document.getElementById("flat-renovation-fee-date-input").value;
    
    const flatIndex = state.flats.findIndex(f => f.flatNum === flatNum);
    if (flatIndex === -1) return;
    const flat = state.flats[flatIndex];
    
    const today = new Date().toISOString().split('T')[0];`;

const replaceSubmit = `    const newFee = parseFloat(document.getElementById("flat-edit-fee-a").value) || 0;
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

if (appJs.includes(targetSubmit)) {
    appJs = appJs.replace(targetSubmit, replaceSubmit);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Updated submit handler successfully.");
} else {
    console.log("Failed to find targetSubmit.");
}
