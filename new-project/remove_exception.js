const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const targetException = `            if (flat.flatNum === "Fsz 1") {
                // Flat 1 Exception: Displayed balance is strictly limited to Apr, May, Jun 2026 missing payments
                const last3MonthsTimeline = timelineA.filter(item => new Date(item.date) >= new Date("2026-04-01"));
                flat.balance = last3MonthsTimeline.reduce((sum, item) => sum + item.amount, 0);
            } else {
                flat.balance = timelineA[0].runningBalance;
            }`;

const replaceException = `            flat.balance = timelineA[0].runningBalance;`;

if (appJs.includes(targetException)) {
    appJs = appJs.replace(targetException, replaceException);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Removed hardcoded Fsz 1 exception from recalculateFlatBalances.");
} else {
    console.log("Failed to find Fsz 1 exception.");
}
