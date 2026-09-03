const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
const htmlPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';

let appJs = fs.readFileSync(appPath, 'utf8');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Full translations dictionary
const perfectTranslations = `const translations = {
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
        search_fullscreen_placeholder: "Keresés dátum, összeg, megjegyzés alapján...",
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
        total_balance: "Összes egyenleg",
        current_kk_balance: "Jelenlegi KK egyenleg",
        current_fa_balance: "Jelenlegi FA egyenleg",
        monthly_kk_fee: "Havi KK előírás",
        monthly_fa_fee: "Havi FA előírás",
        ownership_share: "Tulajdoni hányad",
        tenant_count: "Lakók száma",
        email: "E-mail cím",
        phone: "Telefonszám"
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
        search_fullscreen_placeholder: "Search by date, amount, comment...",
        show_all: "Show all",
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
        total_balance: "Total Balance",
        current_kk_balance: "Current Common Cost Balance",
        current_fa_balance: "Current Renovation Fund Balance",
        monthly_kk_fee: "Monthly Common Cost Fee",
        monthly_fa_fee: "Monthly Renovation Fund Fee",
        ownership_share: "Ownership Share",
        tenant_count: "Number of Residents",
        email: "Email Address",
        phone: "Phone Number"
    }
};`;

const tStart = appJs.indexOf("const translations = {");
const tEnd = appJs.indexOf("function applyTranslations()");
if (tStart !== -1 && tEnd !== -1) {
    appJs = appJs.substring(0, tStart) + perfectTranslations + "\n\n" + appJs.substring(tEnd);
}

// 2. Fix literal string template expressions in single quotes inside app.js
appJs = appJs.split(`'<span>\${(state.currentLang === "en") ? "Cancel" : "Mégse"}</span>'`).join('`<span>${(state.currentLang === "en") ? "Cancel" : "Mégse"}</span>`');
appJs = appJs.split(`'<span>\${(state.currentLang === "en") ? "Edit" : "Szerkesztés"}</span>'`).join('`<span>${(state.currentLang === "en") ? "Edit" : "Szerkesztés"}</span>`');

// Replace any remaining literal template string in single quotes
appJs = appJs.replace(/'<i data-lucide="x" style="width:14px;height:14px;"><\/i> <span>\$\{\(state\.currentLang === "en"\) \? "Cancel" : "Mégse"\}<\/span>'/g, '`<i data-lucide="x" style="width:14px;height:14px;"></i> <span>${(state.currentLang === "en") ? "Cancel" : "Mégse"}</span>`');
appJs = appJs.replace(/'<i data-lucide="pencil" style="width:14px;height:14px;"><\/i> <span>\$\{\(state\.currentLang === "en"\) \? "Edit" : "Szerkesztés"\}<\/span>'/g, '`<i data-lucide="pencil" style="width:14px;height:14px;"></i> <span>${(state.currentLang === "en") ? "Edit" : "Szerkesztés"}</span>`');
appJs = appJs.replace(/'<i data-lucide="x" style="width:16px;height:16px;"><\/i> <span>\$\{\(state\.currentLang === "en"\) \? "Cancel" : "Mégse"\}<\/span>'/g, '`<i data-lucide="x" style="width:16px;height:16px;"></i> <span>${(state.currentLang === "en") ? "Cancel" : "Mégse"}</span>`');
appJs = appJs.replace(/'<i data-lucide="pencil" style="width:16px;height:16px;"><\/i> <span>\$\{\(state\.currentLang === "en"\) \? "Edit" : "Szerkesztés"\}<\/span>'/g, '`<i data-lucide="pencil" style="width:16px;height:16px;"></i> <span>${(state.currentLang === "en") ? "Edit" : "Szerkesztés"}</span>`');

// 3. Add data-i18n attributes to index.html for flat detail stat labels
html = html.replace('<span class="stat-label">Jelenlegi KK egyenleg</span>', '<span class="stat-label" data-i18n="current_kk_balance">Jelenlegi KK egyenleg</span>');
html = html.replace('<span class="stat-label">Jelenlegi FA egyenleg</span>', '<span class="stat-label" data-i18n="current_fa_balance">Jelenlegi FA egyenleg</span>');
html = html.replace('<span class="stat-label">Havi KK előírás</span>', '<span class="stat-label" data-i18n="monthly_kk_fee">Havi KK előírás</span>');
html = html.replace('<span class="stat-label">Havi FA előírás</span>', '<span class="stat-label" data-i18n="monthly_fa_fee">Havi FA előírás</span>');
html = html.replace('<span class="stat-label" style="margin-bottom:2px; display:block;">Tulajdonos neve</span>', '<span class="stat-label" style="margin-bottom:2px; display:block;" data-i18n="owner_name">Tulajdonos neve</span>');
html = html.replace('<span class="stat-label" style="margin-bottom:2px; display:block;">Tulajdoni hányad</span>', '<span class="stat-label" style="margin-bottom:2px; display:block;" data-i18n="ownership_share">Tulajdoni hányad</span>');
html = html.replace('<span class="stat-label" style="margin-bottom:2px; display:block;">Lakók száma</span>', '<span class="stat-label" style="margin-bottom:2px; display:block;" data-i18n="tenant_count">Lakók száma</span>');
html = html.replace('<span class="stat-label" style="margin-bottom:2px; display:block;">E-mail cím</span>', '<span class="stat-label" style="margin-bottom:2px; display:block;" data-i18n="email">E-mail cím</span>');
html = html.replace('<span class="stat-label" style="margin-bottom:2px; display:block;">Telefonszám</span>', '<span class="stat-label" style="margin-bottom:2px; display:block;" data-i18n="phone">Telefonszám</span>');

html = html.replace('placeholder="Keresés dátum, összeg, megjegyzés alapján..."', 'placeholder="Keresés dátum, összeg, megjegyzés alapján..." data-i18n-placeholder="search_fullscreen_placeholder"');

fs.writeFileSync(appPath, appJs, 'utf8');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log("Successfully fixed literal template strings and added full i18n data tags!");
