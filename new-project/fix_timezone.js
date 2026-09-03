const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const targetMonths = `    const startDate = new Date("2025-06-01");
    const endDate = new Date();
    endDate.setDate(1);
    endDate.setHours(0, 0, 0, 0);`;

const replaceMonths = `    // Use local time for both to avoid UTC offset bugs at month boundaries
    const startDate = new Date(2025, 5, 1); // 2025 June 1
    const endDate = new Date();
    endDate.setDate(1);
    endDate.setHours(0, 0, 0, 0);`;

if (appJs.includes(targetMonths)) {
    appJs = appJs.replace(targetMonths, replaceMonths);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Fixed timezone bug in months generator.");
} else {
    console.log("Failed to find targetMonths logic.");
}
