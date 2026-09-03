const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const exportFunctions = `
// ==========================================
// EXCEL EXPORT FUNCTIONS
// ==========================================

window.exportFlatsToExcel = function() {
    if (!window.XLSX) {
        alert("Az Excel exportáló nem töltődött be. Kérjük ellenőrizze az internetkapcsolatot.");
        return;
    }
    
    const data = state.flats.map(flat => {
        const flatTransactions = state.transactions.filter(tx => tx.flatNum === flat.flatNum && tx.status === "Verified");
        const paymentsKK = flatTransactions.filter(tx => tx.type !== "Correction" && tx.targetAccount === "Közös Költség").reduce((s, t) => s + t.amount, 0);
        const paymentsFA = flatTransactions.filter(tx => tx.type !== "Correction" && tx.targetAccount === "Felújítási Alap").reduce((s, t) => s + t.amount, 0);
        
        return {
            "Lakás Száma": flat.flatNum,
            "Tulajdonos": flat.ownerName || "-",
            "E-mail": flat.ownerEmail || "-",
            "Telefon": flat.ownerPhone || "-",
            "Lakók száma": flat.tenantCount,
            "Közös Költség (Ft)": getCurrentFee(flat.flatNum, "Közös Költség"),
            "Felújítási Alap (Ft)": getCurrentFee(flat.flatNum, "Felújítási Alap"),
            "KK Befizetések": paymentsKK,
            "FA Befizetések": paymentsFA,
            "Jelenlegi Egyenleg": flat.balance
        };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lakások");
    XLSX.writeFile(wb, "lakasok_es_egyenlegek.xlsx");
};

window.exportTransactionsToExcel = function() {
    if (!window.XLSX) return;
    
    const data = [];
    
    state.transactions.forEach(tx => {
        data.push({
            "Dátum": tx.date,
            "Típus": tx.type === "Correction" ? "Korrekció" : "Befizetés",
            "Lakás/Szolgáltató": tx.flatNum + ". Lakás",
            "Összeg (Ft)": tx.amount,
            "Kategória/Mód": tx.type === "Correction" ? "Egyenleg korrekció" : translateMethod(tx.method),
            "Főkönyvi Fiók": tx.targetAccount || "-",
            "Megjegyzés": tx.comment || ""
        });
    });
    
    state.expenses.forEach(exp => {
        data.push({
            "Dátum": exp.date,
            "Típus": "Kiadás",
            "Lakás/Szolgáltató": exp.provider,
            "Összeg (Ft)": -exp.amount, 
            "Kategória/Mód": translateCategory(exp.category),
            "Főkönyvi Fiók": "-",
            "Megjegyzés": exp.comment || ""
        });
    });
    
    data.sort((a, b) => new Date(b["Dátum"]) - new Date(a["Dátum"])); 
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tranzakciók");
    XLSX.writeFile(wb, "minden_tranzakcio.xlsx");
};

window.exportFlatLedgerToExcel = function(accountTypeCode) {
    if (!window.XLSX) return;
    const flatNum = state.currentUser.flatNum;
    const targetAccount = accountTypeCode === 'A' ? "Közös Költség" : "Felújítási Alap";
    const timeline = getFlatLedgerTimeline(flatNum, targetAccount);
    
    const data = timeline.map(item => ({
        "Dátum": item.date,
        "Megnevezés": item.method || (item.type === "Debit" ? "Havi Előírás" : (item.type === "Correction" ? "Egyenleg korrekció" : "Befizetés")),
        "Megjegyzés": item.comment || "",
        "Összeg (Ft)": item.amount,
        "Folyószámla Egyenleg (Ft)": item.runningBalance
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Előzmények");
    XLSX.writeFile(wb, \`\${flatNum}_lakas_\${accountTypeCode}_folyoszamla.xlsx\`);
};

window.exportFlatDetailToExcel = function() {
    if (!window.XLSX) return;
    const flatNum = state.currentFlatDetailNum;
    if (!flatNum) return;
    
    const timeline = getCombinedFlatLedgerTimeline(flatNum);
    const data = timeline.map(item => {
        const isDebit = item.type === "Debit";
        const isCorrection = item.type === "Correction";
        const titleStr = isCorrection ? "Egyenleg korrekció" : (item.method || (isDebit ? 'Havi Előírás' : 'Befizetés'));
        return {
            "Dátum": item.date,
            "Számla": item.account,
            "Megnevezés": titleStr,
            "Megjegyzés": item.comment || "",
            "Összeg (Ft)": item.amount,
            "Folyószámla Egyenleg (Ft)": item.runningBalance
        };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Minden Előzmény");
    XLSX.writeFile(wb, \`\${flatNum}_lakas_teljes_elozmeny.xlsx\`);
};
`;

if (!appJs.includes('window.exportFlatsToExcel')) {
    appJs = appJs + '\n' + exportFunctions;
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Added Excel export functions to app.js");
} else {
    console.log("Export functions already exist.");
}
