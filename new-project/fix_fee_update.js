const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const targetFeeUpdate = `    // 1. Process Fee Changes First
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
    }`;

const replaceFeeUpdate = `    // 1. Process Fee Changes First
    const todayDateObj = new Date();
    
    if (newFeeDate) {
        if (!flat.feeChangesKK) flat.feeChangesKK = [];
        const formattedDate = newFeeDate + "-01";
        const existingIdx = flat.feeChangesKK.findIndex(c => c.date === formattedDate);
        if (existingIdx !== -1) flat.feeChangesKK[existingIdx].amount = newFee;
        else flat.feeChangesKK.push({ date: formattedDate, amount: newFee });
    } else {
        if (flat.feeChangesKK && flat.feeChangesKK.length > 0) {
            const activeChanges = flat.feeChangesKK.filter(c => new Date(c.date) <= todayDateObj);
            if (activeChanges.length > 0) {
                activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
                activeChanges[0].amount = newFee;
            } else {
                flat.monthlyFee = newFee;
            }
        } else {
            flat.monthlyFee = newFee; 
        }
    }
    
    if (newRenovationFeeDate) {
        if (!flat.feeChangesFA) flat.feeChangesFA = [];
        const formattedDate = newRenovationFeeDate + "-01";
        const existingIdx = flat.feeChangesFA.findIndex(c => c.date === formattedDate);
        if (existingIdx !== -1) flat.feeChangesFA[existingIdx].amount = newRenovationFee;
        else flat.feeChangesFA.push({ date: formattedDate, amount: newRenovationFee });
    } else {
        if (flat.feeChangesFA && flat.feeChangesFA.length > 0) {
            const activeChanges = flat.feeChangesFA.filter(c => new Date(c.date) <= todayDateObj);
            if (activeChanges.length > 0) {
                activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
                activeChanges[0].amount = newRenovationFee;
            } else {
                flat.renovationFee = newRenovationFee;
            }
        } else {
            flat.renovationFee = newRenovationFee;
        }
    }`;

if (appJs.includes(targetFeeUpdate)) {
    appJs = appJs.replace(targetFeeUpdate, replaceFeeUpdate);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Updated fee update logic to handle masked base fees.");
} else {
    console.log("Failed to find targetFeeUpdate.");
}
