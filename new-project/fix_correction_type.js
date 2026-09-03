const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// 1. Change type to "Correction" in manual balance adjustments
appJs = appJs.replace(/type: "Credit",(\s+)amount: diffA,/g, 'type: "Correction",$1amount: diffA,');
appJs = appJs.replace(/type: "Credit",(\s+)amount: diffB,/g, 'type: "Correction",$1amount: diffB,');

// 2. Pass "Correction" through in getFlatLedgerTimeline
const targetLedgerTimelineMap = `        .map(tx => ({
            id: tx.id,
            date: tx.date,
            type: "Credit",
            amount: tx.amount,
            comment: tx.comment || \`Befizetcs (\${translateMethod(tx.method)})\`
        }));`;
const replaceLedgerTimelineMap = `        .map(tx => ({
            id: tx.id,
            date: tx.date,
            type: tx.type === "Correction" ? "Correction" : "Credit",
            amount: tx.amount,
            comment: tx.comment || (tx.type === "Correction" ? "Egyenleg korrekció" : \`Befizetés (\${translateMethod(tx.method)})\`)
        }));`;
if (appJs.includes(targetLedgerTimelineMap)) {
    appJs = appJs.replace(targetLedgerTimelineMap, replaceLedgerTimelineMap);
}

// 3. Update getBuildingReserve, getBuildingRenovationFund, getMonthlyStats to explicitly require tx.type !== "Correction"
appJs = appJs.replace(/tx => tx\.status === "Verified" && tx\.targetAccount === "K\ufffd z\ufffd s K\ufffd lts\ufffdcg"/g, 
                      'tx => tx.status === "Verified" && tx.type !== "Correction" && tx.targetAccount === "Közös Költség"');
appJs = appJs.replace(/tx => tx\.status === "Verified" && tx\.targetAccount === "Fel\u01b3j\ufffdt\ufffdsi Alap"/g, 
                      'tx => tx.status === "Verified" && tx.type !== "Correction" && tx.targetAccount === "Felújítási Alap"');
appJs = appJs.replace(/tx => tx\.date\.startsWith\(monthStr\) && tx\.status === "Verified"/g, 
                      'tx => tx.date.startsWith(monthStr) && tx.type !== "Correction" && tx.status === "Verified"');

// Fix global balances form total logic as well (line ~1754, 1761)
appJs = appJs.replace(/tx => tx\.status === "Verified" && tx\.targetAccount === "K\ufffdz\ufffds K\ufffdlts\ufffdg"/g, 
                      'tx => tx.status === "Verified" && tx.type !== "Correction" && tx.targetAccount === "Közös Költség"');
appJs = appJs.replace(/tx => tx\.status === "Verified" && tx\.targetAccount === "Fel\ufffdj\ufffdt\ufffdsi Alap"/g, 
                      'tx => tx.status === "Verified" && tx.type !== "Correction" && tx.targetAccount === "Felújítási Alap"');

// 4. Update renderTimelineTable
const targetRenderTimeline = `        const isDemand = item.type === "Debit";
        const color = isDemand ? "var(--danger)" : "var(--success)";
        const amountPrefix = isDemand ? "-" : "+";
        
        return \`
            <tr>
                <td>\${item.date}</td>
                <td>
                    <div style="font-weight:500;">\${item.method || (isDemand ? 'Havi El'rs' : 'Befizetcs')}</div>`;

const replaceRenderTimeline = `        const isDemand = item.type === "Debit";
        const isCorrection = item.type === "Correction";
        const color = isCorrection ? "var(--text-muted)" : (isDemand ? "var(--danger)" : "var(--success)");
        const amountPrefix = isCorrection ? (item.amount > 0 ? "+" : "") : (isDemand ? "-" : "+");
        const titleStr = isCorrection ? "Egyenleg korrekció" : (item.method || (isDemand ? 'Havi Előírás' : 'Befizetés'));
        
        return \`
            <tr>
                <td>\${item.date}</td>
                <td>
                    <div style="font-weight:500;">\${titleStr}</div>`;

if (appJs.includes(targetRenderTimeline)) {
    appJs = appJs.replace(targetRenderTimeline, replaceRenderTimeline);
}

// 5. Update renderFlatDetailTimeline (fullscreen)
const targetFullscreenTimeline = `            const isDebit = item.type === "Debit";
            const icon = isDebit ? "minus-circle" : "plus-circle";
            const iconColor = isDebit ? "var(--danger)" : "var(--success)";
            const amountPrefix = isDebit ? "-" : "+";`;

const replaceFullscreenTimeline = `            const isDebit = item.type === "Debit";
            const isCorrection = item.type === "Correction";
            const icon = isCorrection ? "edit-2" : (isDebit ? "minus-circle" : "plus-circle");
            const iconColor = isCorrection ? "var(--text-muted)" : (isDebit ? "var(--danger)" : "var(--success)");
            const amountPrefix = isCorrection ? (item.amount > 0 ? "+" : "") : (isDebit ? "-" : "+");
            const titleStr = isCorrection ? "Egyenleg korrekció" : (item.method || (isDebit ? 'Havi Előírás' : 'Befizetés'));`;

if (appJs.includes(targetFullscreenTimeline)) {
    appJs = appJs.replace(targetFullscreenTimeline, replaceFullscreenTimeline);
}

const targetFullscreenTitle = `<div style="font-weight:500; color:var(--text-main); font-size:14px;">\${item.method || (isDebit ? 'Havi El'rs' : 'Befizetcs')}</div>`;
const replaceFullscreenTitle = `<div style="font-weight:500; color:var(--text-main); font-size:14px;">\${titleStr}</div>`;
if (appJs.includes(targetFullscreenTitle)) {
    appJs = appJs.replace(targetFullscreenTitle, replaceFullscreenTitle);
}


fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Updated app.js for Correction transaction type.");
