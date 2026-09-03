const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
const htmlPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';

let appJs = fs.readFileSync(appPath, 'utf8');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Add extra translation keys to app.js dictionary
const extraHu = `
        tx_and_fees_title: "Tranzakciók és Előírások",
        not_registered: "Nincs regisztrálva",
        close: "Bezárás",
        income_str: "bevétel",
        expense_str: "kiadás"`;

const extraEn = `
        tx_and_fees_title: "Transactions & Fees",
        not_registered: "Not registered",
        close: "Close",
        income_str: "income",
        expense_str: "expense"`;

if (!appJs.includes("tx_and_fees_title:")) {
    appJs = appJs.replace('save: "Mentés"', 'save: "Mentés",' + extraHu);
    appJs = appJs.replace('save: "Save"', 'save: "Save",' + extraEn);
}

// 2. Fix header user name and role in updateAppView
const oldHeaderUserLogic = `    if (state.currentUser.role === "admin") {
        document.getElementById("header-user-name").textContent = "Közös Képviselő";
        document.getElementById("header-user-role").textContent = (translations[state.currentLang || "hu"] || translations.hu).role || "Társasház képviselet";
    } else {
        const isEn = (state.currentLang === "en");
        document.getElementById("header-user-name").textContent = isEn ? \`Flat \${state.currentUser.flatNum}\` : \`\${state.currentUser.flatNum}. lakás\`;
        document.getElementById("header-user-role").textContent = (translations[state.currentLang || "hu"] || translations.hu).role || "Társasházi lakó";
    }`;

const newHeaderUserLogic = `    const isEn = (state.currentLang === "en");
    if (state.currentUser.role === "admin") {
        document.getElementById("header-user-name").textContent = isEn ? "Representative" : "Közös Képviselő";
        document.getElementById("header-user-role").textContent = isEn ? "Property Management" : "Társasház képviselet";
    } else {
        document.getElementById("header-user-name").textContent = isEn ? \`Flat \${state.currentUser.flatNum}\` : \`\${state.currentUser.flatNum}. lakás\`;
        document.getElementById("header-user-role").textContent = isEn ? "Resident" : "Társasházi lakó";
    }`;

appJs = appJs.replace(oldHeaderUserLogic, newHeaderUserLogic);

// 3. Fix sub-stats (income/expense) in renderAdminDashboard
const oldSubStats = `document.getElementById("admin-kpi-sub-stats").textContent = \`(\${formatCurrency(stats.income)} bevétel, \${formatCurrency(stats.expense)} kiadás)\`;`;
const newSubStats = `const isEn = (state.currentLang === "en");\n        document.getElementById("admin-kpi-sub-stats").textContent = isEn ? \`(\${formatCurrency(stats.income)} income, \${formatCurrency(stats.expense)} expense)\` : \`(\${formatCurrency(stats.income)} bevétel, \${formatCurrency(stats.expense)} kiadás)\`;`;
appJs = appJs.replace(oldSubStats, newSubStats);

// 4. Fix matrix tile rendering in renderFlatTileMatrix
appJs = appJs.replace('<h4>${flat.flatNum}. lakás</h4>', '<h4>${isEn ? `Flat ${flat.flatNum}` : `${flat.flatNum}. lakás`}</h4>');
appJs = appJs.replace('<span>Közös Költség</span>', '<span>${isEn ? "Common Cost" : "Közös Költség"}</span>');
appJs = appJs.replace('<span>Felújítási Alap</span>', '<span>${isEn ? "Renovation Fund" : "Felújítási Alap"}</span>');

// 5. Fix "Nincs regisztrálva" in openFlatDetailModal
appJs = appJs.replace('document.getElementById("ro-flat-owner").textContent = flat.ownerName || "—";', 'document.getElementById("ro-flat-owner").textContent = flat.ownerName || (isEn ? "Not registered" : "Nincs regisztrálva");');
appJs = appJs.replace('document.getElementById("flat-detail-email").textContent = flat.email || "Nincs regisztrálva";', 'document.getElementById("flat-detail-email").textContent = flat.email || (isEn ? "Not registered" : "Nincs regisztrálva");');
appJs = appJs.replace('document.getElementById("ro-flat-phone").textContent = flat.phone || "Nincs regisztrálva";', 'document.getElementById("ro-flat-phone").textContent = flat.phone || (isEn ? "Not registered" : "Nincs regisztrálva");');

// 6. Fix HTML tags in index.html
html = html.replace('<h3>Minden tranzakció és kiadás</h3>', '<h3 data-i18n="admin_all_tx_title">Minden tranzakció és kiadás</h3>');
html = html.replace('<h3>Tranzakciók és Előírások</h3>', '<h3 data-i18n="tx_and_fees_title">Tranzakciók és Előírások</h3>');
html = html.replace('<button id="flat-detail-close-btn-bottom" class="btn btn-outline">Bezárás</button>', '<button id="flat-detail-close-btn-bottom" class="btn btn-outline" data-i18n="close">Bezárás</button>');

fs.writeFileSync(appPath, appJs, 'utf8');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log("Successfully fixed all 9 reported Hungarian string locations!");
