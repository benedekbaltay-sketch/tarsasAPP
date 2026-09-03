const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// The broken function starts at "function getFlatLedgerTimeline(flatNum, targetAccount) {"
// and ends right before "// --- Financial calculations ---"

const startMarker = 'function getFlatLedgerTimeline(flatNum, targetAccount) {';
const endMarker = '// --- Financial calculations ---';

const startIndex = appJs.indexOf(startMarker);
const endIndex = appJs.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const cleanFunction = `function getFlatLedgerTimeline(flatNum, targetAccount) {
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
                const activeChanges = flat.feeChangesKK.filter(c => new Date(c.date) <= currentMonthDate);
                if (activeChanges.length > 0) {
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
    });
    
    // 2. Generate Credits from verified transactions matching the target account
    const payments = state.transactions
        .filter(tx => tx.flatNum === flatNum && tx.status === "Verified" && tx.targetAccount === targetAccount)
        .map(tx => ({
            id: tx.id,
            date: tx.date,
            type: "Credit",
            amount: tx.amount,
            comment: tx.comment || \`Befizetés (\${translateMethod(tx.method)})\`
        }));
        
    timeline.push(...payments);
    
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let currentBalance = 0;
    timeline.forEach(item => {
        currentBalance += item.amount;
        item.runningBalance = currentBalance;
    });
    
    return timeline.reverse();
}

`;

    appJs = appJs.substring(0, startIndex) + cleanFunction + appJs.substring(endIndex);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Fixed syntax error in app.js!");
}

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace('v=45', 'v=46');
fs.writeFileSync(indexPath, indexHtml, 'utf8');

