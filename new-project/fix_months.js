const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const targetMonths = `    const months = [
        { date: "2025-06-01", name: "2025 Jƭnius" },
        { date: "2025-07-01", name: "2025 Jƭlius" },
        { date: "2025-08-01", name: "2025 Augusztus" },
        { date: "2025-09-01", name: "2025 Szeptember" },
        { date: "2025-10-01", name: "2025 Oktƈber" },
        { date: "2025-11-01", name: "2025 November" },
        { date: "2025-12-01", name: "2025 December" },
        { date: "2026-01-01", name: "2026 Janur" },
        { date: "2026-02-01", name: "2026 Februr" },
        { date: "2026-03-01", name: "2026 Mrcius" },
        { date: "2026-04-01", name: "2026 ?prilis" },
        { date: "2026-05-01", name: "2026 Mjus" },
        { date: "2026-06-01", name: "2026 Jƭnius" }
    ];`;

const replaceMonths = `    const months = [];
    const startDate = new Date("2025-06-01");
    const endDate = new Date();
    endDate.setDate(1);
    endDate.setHours(0, 0, 0, 0);

    const monthNames = ["Január", "Február", "Március", "Április", "Május", "Június", "Július", "Augusztus", "Szeptember", "Október", "November", "December"];
    
    let currentD = new Date(startDate);
    while (currentD <= endDate) {
        const y = currentD.getFullYear();
        const m = currentD.getMonth();
        const padM = (m + 1).toString().padStart(2, '0');
        months.push({
            date: \`\${y}-\${padM}-01\`,
            name: \`\${y} \${monthNames[m]}\`
        });
        currentD.setMonth(currentD.getMonth() + 1);
    }`;

// Since the file has some encoding mangling in the JS string (like "Jƭnius"), we'll use a regex
const monthsRegex = /const months = \[\s*\{\s*date: "2025-06-01"[\s\S]*?\{ date: "2026-06-01"[^\n]*\n\s*\];/;

if (monthsRegex.test(appJs)) {
    appJs = appJs.replace(monthsRegex, replaceMonths);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Replaced hardcoded months array with dynamic generator.");
} else {
    console.log("Failed to find months array via regex.");
}
