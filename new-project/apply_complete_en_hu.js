const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
const htmlPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';

let appJs = fs.readFileSync(appPath, 'utf8');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Update renderAdminTransactions
const oldAdminTx = `function renderAdminTransactions(showAll = false) {
    const query = document.getElementById("admin-search").value.toLowerCase();
    const tbody = document.getElementById("admin-transactions-tbody");
    tbody.innerHTML = "";
    const isEditMode = state.adminTxEditMode === true;
    
    const paymentsList = state.transactions.map(t => ({
        ...t,
        type: "Befizetés",
        displayName: \`\${t.flatNum}. Lakás\`,
        categoryDisplay: \`\${translateMethod(t.method)} (\${t.targetAccount})\`,
        amountDisplay: \`+\${formatCurrency(t.amount)}\`,
        amountClass: "text-success",
        badgeClass: t.targetAccount === "Közös Költség" ? "status-verified" : "status-pending",
        badgeText: t.targetAccount === "Közös Költség" ? "Közös Költség" : "Felújítási Alap",
        icon: t.targetAccount === "Közös Költség" ? "check" : "piggy-bank"
    }));
    
    const expensesList = state.expenses.map(e => ({
        ...e,
        type: "Kiadás",
        displayName: e.provider,
        categoryDisplay: translateCategory(e.category),
        amountDisplay: \`-\${formatCurrency(e.amount)}\`,
        amountClass: "text-danger",
        badgeClass: "status-expense",
        badgeText: "Kiadás",
        icon: "minus"
    }));`;

const newAdminTx = `function renderAdminTransactions(showAll = false) {
    const query = document.getElementById("admin-search").value.toLowerCase();
    const tbody = document.getElementById("admin-transactions-tbody");
    tbody.innerHTML = "";
    const isEditMode = state.adminTxEditMode === true;
    const isEn = (state.currentLang === 'en');
    
    const paymentsList = state.transactions.map(t => ({
        ...t,
        type: isEn ? "Payment" : "Befizetés",
        displayName: isEn ? \`Flat \${t.flatNum}\` : \`\${t.flatNum}. Lakás\`,
        categoryDisplay: \`\${translateMethod(t.method)} (\${t.targetAccount === "Közös Költség" ? (isEn ? "Common Cost" : "Közös Költség") : (isEn ? "Renovation Fund" : "Felújítási Alap")})\`,
        amountDisplay: \`+\${formatCurrency(t.amount)}\`,
        amountClass: "text-success",
        badgeClass: t.targetAccount === "Közös Költség" ? "status-verified" : "status-pending",
        badgeText: t.targetAccount === "Közös Költség" ? (isEn ? "Common Cost" : "Közös Költség") : (isEn ? "Renovation Fund" : "Felújítási Alap"),
        icon: t.targetAccount === "Közös Költség" ? "check" : "piggy-bank"
    }));
    
    const expensesList = state.expenses.map(e => ({
        ...e,
        type: isEn ? "Expense" : "Kiadás",
        displayName: e.provider,
        categoryDisplay: translateCategory(e.category),
        amountDisplay: \`-\${formatCurrency(e.amount)}\`,
        amountClass: "text-danger",
        badgeClass: "status-expense",
        badgeText: isEn ? "Expense" : "Kiadás",
        icon: "minus"
    }));`;

appJs = appJs.split('function renderAdminTransactions(showAll = false) {').join(newAdminTx);

// Replace "Mutasd az összeset" in app.js
appJs = appJs.split('Mutasd az összeset').join('${(state.currentLang === "en") ? "Show all" : "Mutasd az összeset"}');

// 2. Update toggleAdminTxEditMode & toggleFullscreenEditMode
appJs = appJs.replace(/<span>Mégse<\/span>/g, `<span>\${(state.currentLang === "en") ? "Cancel" : "Mégse"}</span>`);
appJs = appJs.replace(/<span>Szerkesztés<\/span>/g, `<span>\${(state.currentLang === "en") ? "Edit" : "Szerkesztés"}</span>`);

// 3. Update openFullscreenTx
const oldOpenFS = `window.openFullscreenTx = function(type) {
    fullscreenType = type;
    fullscreenEditMode = false;
    fullscreenSearchQuery = '';
    
    const title = document.getElementById("fullscreen-tx-title");
    if (type === 'flat') {
        title.textContent = \`\${state.currentFlatDetailNum}. Lakás - Teljes előzmény\`;
    } else {
        title.textContent = \`Minden tranzakció és kiadás\`;
    }`;

const newOpenFS = `window.openFullscreenTx = function(type) {
    fullscreenType = type;
    fullscreenEditMode = false;
    fullscreenSearchQuery = '';
    const isEn = (state.currentLang === 'en');
    
    const title = document.getElementById("fullscreen-tx-title");
    if (type === 'flat') {
        title.textContent = isEn ? \`Flat \${state.currentFlatDetailNum} - Full History\` : \`\${state.currentFlatDetailNum}. Lakás - Teljes előzmény\`;
    } else {
        title.textContent = isEn ? "All Transactions & Expenses" : "Minden tranzakció és kiadás";
    }`;

appJs = appJs.replace(oldOpenFS, newOpenFS);

// 4. Update renderFlatDetailTimeline
appJs = appJs.replace("viewAllBtn.innerHTML = \"Minden tranzakció megtekintése\";", "viewAllBtn.innerHTML = (state.currentLang === 'en') ? \"View all transactions\" : \"Minden tranzakció megtekintése\";");

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully updated app.js for full EN/HU translations!");
