const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const targetFeeUpdate = `    if (newFeeDate) {
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
    }`;

const replaceFeeUpdate = `    if (newFeeDate) {
        if (!flat.feeChangesKK) flat.feeChangesKK = [];
        const formattedDate = newFeeDate + "-01";
        // Visszamenőleges módosítás: Törlünk minden olyan szabályt, ami az új dátummal azonos vagy annál későbbi, 
        // így garantáltan ez lesz az új végleges díj a megadott hónaptól kezdve (a jelenre is kihatva).
        flat.feeChangesKK = flat.feeChangesKK.filter(c => new Date(c.date) < new Date(formattedDate));
        flat.feeChangesKK.push({ date: formattedDate, amount: newFee });
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
        flat.feeChangesFA = flat.feeChangesFA.filter(c => new Date(c.date) < new Date(formattedDate));
        flat.feeChangesFA.push({ date: formattedDate, amount: newRenovationFee });
    }`;

if (appJs.includes(targetFeeUpdate)) {
    appJs = appJs.replace(targetFeeUpdate, replaceFeeUpdate);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Updated date logic to wipe future fee changes.");
} else {
    console.log("Failed to find targetFeeUpdate.");
}
