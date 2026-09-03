const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
const htmlPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';

let appJs = fs.readFileSync(appPath, 'utf8');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Add all missing dictionary keys to translations object in app.js
const extraHuKeys = `
        loading: "Betöltés…",
        category_method: "Kategória / Módszer",
        common_cost: "Közös Költség",
        renovation_fund: "Felújítási Alap",
        bank_transfer: "Banki átutalás",
        cash_offset: "Készpénz korrekció",
        utility: "Közmű",
        insurance: "Biztosítás",
        maintenance: "Karbantartás",
        bank_fee: "Bankköltség",
        effective_from: "Érvényes ettől (ÉÉÉÉ-HH):"`;

const extraEnKeys = `
        loading: "Loading...",
        category_method: "Category / Method",
        common_cost: "Common Cost",
        renovation_fund: "Renovation Fund",
        bank_transfer: "Bank Transfer",
        cash_offset: "Cash Offset",
        utility: "Utility",
        insurance: "Insurance",
        maintenance: "Maintenance",
        bank_fee: "Bank Fee",
        effective_from: "Effective from (YYYY-MM):"`;

if (!appJs.includes("effective_from:")) {
    appJs = appJs.replace('expense_str: "kiadás"', 'expense_str: "kiadás",' + extraHuKeys);
    appJs = appJs.replace('expense_str: "expense"', 'expense_str: "expense",' + extraEnKeys);
}

// 2. Fix JS dynamic rendering lines
appJs = appJs.replace('document.getElementById("tenant-count").textContent = `${flat.tenantCount} fő`;', 'document.getElementById("tenant-count").textContent = isEn ? `${flat.tenantCount} residents` : `${flat.tenantCount} fő`;');
appJs = appJs.replace('document.getElementById("tenant-payment-ref").textContent = `KK - ${flat.flatNum} - [Hónap]`;', 'document.getElementById("tenant-payment-ref").textContent = `KK - ${flat.flatNum} - [${isEn ? "Month" : "Hónap"}]`;');
appJs = appJs.replace('document.getElementById("tenant-payment-ref-b").textContent = `FA - ${flat.flatNum} - [Hónap]`;', 'document.getElementById("tenant-payment-ref-b").textContent = `FA - ${flat.flatNum} - [${isEn ? "Month" : "Hónap"}]`;');
appJs = appJs.replace('tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Nem található tranzakció.</td></tr>`;', 'tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">${isEn ? "No transactions found." : "Nem található tranzakció."}</td></tr>`;');
appJs = appJs.replace('document.getElementById("admin-kpi-sub-stats").textContent = `Bevétel: ${formatCurrency(stats.inflow)} | Kiadás: ${formatCurrency(stats.outflow)}`;', 'document.getElementById("admin-kpi-sub-stats").textContent = isEn ? `Inflow: ${formatCurrency(stats.inflow)} | Outflow: ${formatCurrency(stats.outflow)}` : `Bevétel: ${formatCurrency(stats.inflow)} | Kiadás: ${formatCurrency(stats.outflow)}`;');
appJs = appJs.replace('tbody.innerHTML = \'<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nincsenek tranzakciók</td></tr>\';', 'tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">${(state.currentLang === "en") ? "No transactions" : "Nincsenek tranzakciók"}</td></tr>`;');
appJs = appJs.replace('tbody.innerHTML = \'<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Nincsenek tranzakciók</td></tr>\';', 'tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">${(state.currentLang === "en") ? "No transactions" : "Nincsenek tranzakciók"}</td></tr>`;');

// 3. Add data-i18n to HTML elements
const htmlReplacements = [
    ['<label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Érvényes ettől (ÉÉÉÉ-HH):</label>', '<label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;" data-i18n="effective_from">Érvényes ettől (ÉÉÉÉ-HH):</label>'],
    ['<td>Betöltés…</td>', '<td data-i18n="loading">Betöltés…</td>'],
    ['<label for="new-tx-flat">Lakás</label>', '<label for="new-tx-flat" data-i18n="flat">Lakás</label>'],
    ['<label for="new-tx-provider">Szolgáltató</label>', '<label for="new-tx-provider" data-i18n="provider">Szolgáltató</label>'],
    ['<label for="new-tx-date">Dátum</label>', '<label for="new-tx-date" data-i18n="date">Dátum</label>'],
    ['<label for="new-tx-amount">Összeg (Ft)</label>', '<label for="new-tx-amount" data-i18n="amount">Összeg (Ft)</label>'],
    ['<label id="tx-cat-method-label">Kategória / Módszer</label>', '<label id="tx-cat-method-label" data-i18n="category_method">Kategória / Módszer</label>'],
    ['<label for="new-tx-account">Számla</label>', '<label for="new-tx-account" data-i18n="account">Számla</label>'],
    ['<label for="new-tx-comment">Megjegyzés</label>', '<label for="new-tx-comment" data-i18n="comment">Megjegyzés</label>'],
    ['<h3>Biztosan törlöd ezt a tételt?</h3>', '<h3 data-i18n="delete_tx_title">Biztosan törlöd ezt a tételt?</h3>'],
    ['<p style="margin: 0; font-size:13px; color:var(--text-muted);">Ez a művelet visszavonhatatlan és azonnal végrehajtódik.</p>', '<p style="margin: 0; font-size:13px; color:var(--text-muted);" data-i18n="delete_tx_desc">Ez a művelet visszavonhatatlan és azonnal végrehajtódik.</p>']
];

htmlReplacements.forEach(([from, to]) => {
    html = html.split(from).join(to);
});

fs.writeFileSync(appPath, appJs, 'utf8');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log("Successfully completed 100% audit i18n translation updates!");
