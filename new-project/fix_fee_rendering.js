const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// 1. Add getCurrentFee function
if (!appJs.includes('function getCurrentFee')) {
    const getCurrentFeeFn = `
function getCurrentFee(flat, type) {
    const today = new Date();
    let currentFee = type === 'KK' ? (flat.monthlyFee || 0) : (flat.renovationFee || 0);
    const changes = type === 'KK' ? flat.feeChangesKK : flat.feeChangesFA;
    
    if (changes && changes.length > 0) {
        const activeChanges = changes.filter(c => new Date(c.date) <= today);
        if (activeChanges.length > 0) {
            activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
            currentFee = activeChanges[0].amount;
        }
    }
    return currentFee;
}
`;
    appJs = appJs.replace('function getFlatLedgerTimeline', getCurrentFeeFn + '\nfunction getFlatLedgerTimeline');
}

// 2. Update openFlatDetailModal
const targetReadOnlyFeeA = `document.getElementById("flat-detail-fee-a").textContent = formatCurrency(flat.monthlyFee);`;
const replaceReadOnlyFeeA = `document.getElementById("flat-detail-fee-a").textContent = formatCurrency(getCurrentFee(flat, 'KK'));`;
if (appJs.includes(targetReadOnlyFeeA)) {
    appJs = appJs.replace(targetReadOnlyFeeA, replaceReadOnlyFeeA);
}

const targetReadOnlyFeeB = `document.getElementById("flat-detail-fee-b").textContent = formatCurrency(flat.renovationFee);`;
const replaceReadOnlyFeeB = `document.getElementById("flat-detail-fee-b").textContent = formatCurrency(getCurrentFee(flat, 'FA'));`;
if (appJs.includes(targetReadOnlyFeeB)) {
    appJs = appJs.replace(targetReadOnlyFeeB, replaceReadOnlyFeeB);
}

// 3. Update toggleFlatEditMode
const targetToggleFeeA = `const feeA = document.getElementById("flat-edit-fee-a");
            feeA.value = flat.monthlyFee || 0;
            feeA.dataset.original = flat.monthlyFee || 0;`;
const replaceToggleFeeA = `const feeA = document.getElementById("flat-edit-fee-a");
            const currentKK = getCurrentFee(flat, 'KK');
            feeA.value = currentKK;
            feeA.dataset.original = currentKK;`;
if (appJs.includes(targetToggleFeeA)) {
    appJs = appJs.replace(targetToggleFeeA, replaceToggleFeeA);
}

const targetToggleFeeB = `const feeB = document.getElementById("flat-edit-fee-b");
            feeB.value = flat.renovationFee || 0;
            feeB.dataset.original = flat.renovationFee || 0;`;
const replaceToggleFeeB = `const feeB = document.getElementById("flat-edit-fee-b");
            const currentFA = getCurrentFee(flat, 'FA');
            feeB.value = currentFA;
            feeB.dataset.original = currentFA;`;
if (appJs.includes(targetToggleFeeB)) {
    appJs = appJs.replace(targetToggleFeeB, replaceToggleFeeB);
}

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Fixed read-only and edit fee rendering logic.");
