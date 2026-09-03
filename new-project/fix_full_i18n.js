const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
const htmlPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';

let appJs = fs.readFileSync(appPath, 'utf8');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Expand translations object in app.js
const newTranslationsObj = `const translations = {
    hu: {
        app_title: "Közös Költség Nyilvántartó",
        building_address: "Batyu utca 21. - Társasház",
        role: "Szerepkör",
        logout: "Kijelentkezés",
        admin_arrears_title: "Lakások és Egyenlegek",
        admin_all_tx_title: "Minden tranzakció és kiadás",
        admin_add_transaction: "Tranzakció rögzítése",
        admin_add_flat: "Új lakás",
        transaction_modal_title: "Új Tranzakció Rögzítése",
        add_payment: "Befizetés rögzítése",
        add_expense: "Kiadás rögzítése",
        flat: "Lakás",
        account: "Számla",
        date: "Dátum",
        amount: "Összeg (Ft)",
        method: "Módszer",
        comment: "Megjegyzés",
        save_payment: "Befizetés mentése",
        category: "Kategória",
        provider: "Szolgáltató",
        save_expense: "Kiadás mentése",
        add_flat_title: "Új lakás hozzáadása",
        flat_num: "Lakásszám (pl. III 12)",
        owner_name: "Tulajdonos neve",
        monthly_fee: "Közös Költség Előírás (Ft/hó)",
        renovation_fee: "Felújítási Alap Előírás (Ft/hó)",
        cancel: "Mégse",
        add: "Hozzáadás",
        delete: "Törlés",
        edit: "Szerkesztés",
        export_excel: "Excel",
        search_placeholder: "Keresés…",
        show_all: "Mutasd az összeset",
        delete_confirm_title: "Biztosan törlöd a lakást?",
        delete_confirm_desc: "Ezzel a művelettel a lakás adatai törlésre kerülnek az aktuális nézetből. Ez nem visszavonható.",
        delete_tx_title: "Biztosan törlöd ezt a tételt?",
        delete_tx_desc: "Ez a művelet visszavonhatatlan és azonnal végrehajtódik.",
        delete_btn: "Törlés véglegesítése",
        login_title: "Bejelentkezés",
        quick_login_title: "Gyorsbejelentkezés (Teszteléshez):",
        representative: "Közös Képviselő",
        rep_role: "Társasház képviselet",
        tenant_role: "Társasházi lakó",
        kpi_building_reserve: "Közös Költség alap",
        kpi_renovation_fund: "Felújítási Alap",
        kpi_total_arrears: "Összes hátralék",
        kpi_monthly_balance: "Aktuális havi mérleg",
        total_balance: "Összes egyenleg"
    },
    en: {
        app_title: "Common Cost Tracker",
        building_address: "Batyu Street 21 - Condominium",
        role: "Role",
        logout: "Logout",
        admin_arrears_title: "Flats and Balances",
        admin_all_tx_title: "All Transactions & Expenses",
        admin_add_transaction: "Record Transaction",
        admin_add_flat: "Add Flat",
        transaction_modal_title: "Record New Transaction",
        add_payment: "Record Payment",
        add_expense: "Record Expense",
        flat: "Flat",
        account: "Account",
        date: "Date",
        amount: "Amount (HUF)",
        method: "Method",
        comment: "Comment",
        save_payment: "Save Payment",
        category: "Category",
        provider: "Provider",
        save_expense: "Save Expense",
        add_flat_title: "Add New Flat",
        flat_num: "Flat Number (e.g. III 12)",
        owner_name: "Owner Name",
        monthly_fee: "Common Cost Fee (HUF/mo)",
        renovation_fee: "Renovation Fund Fee (HUF/mo)",
        cancel: "Cancel",
        add: "Add",
        delete: "Delete",
        edit: "Edit",
        export_excel: "Excel",
        search_placeholder: "Search...",
        show_all: "Show All",
        delete_confirm_title: "Are you sure you want to delete this flat?",
        delete_confirm_desc: "This action will remove the flat's data from the current view. It cannot be undone.",
        delete_tx_title: "Are you sure you want to delete this item?",
        delete_tx_desc: "This action is permanent and immediate.",
        delete_btn: "Confirm Deletion",
        login_title: "Login",
        quick_login_title: "Quick Login (For Testing):",
        representative: "Representative",
        rep_role: "Property Management",
        tenant_role: "Resident",
        kpi_building_reserve: "Common Cost Reserve",
        kpi_renovation_fund: "Renovation Fund",
        kpi_total_arrears: "Total Arrears",
        kpi_monthly_balance: "Current Monthly Balance",
        total_balance: "Total Balance"
    }
};`;

const tStart = appJs.indexOf("const translations = {");
const tEnd = appJs.indexOf("function applyTranslations()");

if (tStart !== -1 && tEnd !== -1) {
    appJs = appJs.substring(0, tStart) + newTranslationsObj + "\n\n" + appJs.substring(tEnd);
}

// 2. Update translateMethod & translateCategory & getBalanceBadgeHtml
const newHelpers = `function translateMethod(method) {
    const isEn = (state.currentLang === 'en');
    if (method === "Bank Transfer") return isEn ? "Bank Transfer" : "Banki átutalás";
    if (method === "Cash Offset") return isEn ? "Cash Offset" : "Készpénz korrekció";
    return method;
}

function translateCategory(category) {
    const isEn = (state.currentLang === 'en');
    switch (category) {
        case "Utility": return isEn ? "Utility" : "Közmű";
        case "Insurance": return isEn ? "Insurance" : "Biztosítás";
        case "Maintenance": return isEn ? "Maintenance" : "Karbantartás";
        case "Bank Fee": return isEn ? "Bank Fee" : "Bankköltség";
        default: return category;
    }
}

function getBalanceBadgeHtml(balance, neutralMode = false) {
    const isEn = (state.currentLang === 'en');
    const overpaidStr = isEn ? "Overpaid" : "Túlfizetés";
    const arrearsStr = isEn ? "Arrears" : "Hátralék";
    const settledStr = isEn ? "Settled" : "Rendezett";

    if (balance > 0) {
        return \`<span class="matrix-badge \${neutralMode ? '' : 'matrix-badge-tulfizetes'}"><i data-lucide="check-circle" style="width:12px;height:12px;"></i> \${overpaidStr}: \${formatCurrency(balance)}</span>\`;
    } else if (balance < 0) {
        return \`<span class="matrix-badge \${neutralMode ? '' : 'matrix-badge-hatralek'}"><i data-lucide="alert-circle" style="width:12px;height:12px;"></i> \${arrearsStr}: \${formatCurrency(balance)}</span>\`;
    } else {
        return \`<span class="matrix-badge \${neutralMode ? '' : 'matrix-badge-rendezett'}"><i data-lucide="minus" style="width:12px;height:12px;"></i> \${settledStr}</span>\`;
    }
}`;

const hStart = appJs.indexOf("function translateMethod(method)");
const hEnd = appJs.indexOf("function getHeroCardClasses");

if (hStart !== -1 && hEnd !== -1) {
    appJs = appJs.substring(0, hStart) + newHelpers + "\n\n" + appJs.substring(hEnd);
}

// 3. Update applyTranslations and toggleLanguage in app.js
const newApplyTrans = `function applyTranslations() {
    const lang = state.currentLang || 'hu';
    const dict = translations[lang] || translations.hu;
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit')) {
                el.value = dict[key];
            } else {
                el.textContent = dict[key];
            }
        }
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) {
            el.placeholder = dict[key];
        }
    });
}

window.toggleLanguage = function() {
    state.currentLang = state.currentLang === 'hu' ? 'en' : 'hu';
    saveStateToLocalStorage();
    applyTranslations();
    updateAppView();
    const flagImg = document.getElementById('lang-flag-img');
    if (flagImg) {
        flagImg.src = state.currentLang === 'hu' ? 'https://flagcdn.com/hu.svg' : 'https://flagcdn.com/gb.svg';
    }
};`;

const atStart = appJs.indexOf("function applyTranslations()");
const atEnd = appJs.indexOf("/* ==========================================================================");

if (atStart !== -1 && atEnd !== -1) {
    appJs = appJs.substring(0, atStart) + newApplyTrans + "\n\n" + appJs.substring(atEnd);
}

// 4. Update html data-i18n attributes
html = html.replace('<h1>Közös Költség Nyilvántartó</h1>', '<h1 data-i18n="app_title">Közös Költség Nyilvántartó</h1>');
html = html.replace('<span class="building-address">Batyu utca 21. - Társasház</span>', '<span class="building-address" data-i18n="building_address">Batyu utca 21. - Társasház</span>');
html = html.replace('<span class="stat-label" style="margin-bottom:4px; display:block;">Közös Költség alap</span>', '<span class="stat-label" style="margin-bottom:4px; display:block;" data-i18n="kpi_building_reserve">Közös Költség alap</span>');
html = html.replace('<span class="stat-label" style="margin-bottom:4px; display:block;">Felújítási Alap</span>', '<span class="stat-label" style="margin-bottom:4px; display:block;" data-i18n="kpi_renovation_fund">Felújítási Alap</span>');
html = html.replace('<span class="stat-label">Összes hátralék</span>', '<span class="stat-label" data-i18n="kpi_total_arrears">Összes hátralék</span>');
html = html.replace('<span class="stat-label">Aktuális havi mérleg</span>', '<span class="stat-label" data-i18n="kpi_monthly_balance">Aktuális havi mérleg</span>');
html = html.replace('<span class="kpi-micro-label">Összes egyenleg</span>', '<span class="kpi-micro-label" data-i18n="total_balance">Összes egyenleg</span>');
html = html.replace('placeholder="Keresés…"', 'placeholder="Keresés…" data-i18n-placeholder="search_placeholder"');

fs.writeFileSync(appPath, appJs, 'utf8');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log("Successfully updated full i18n localization in app.js & index.html");
