const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const missingCode = `
const translations = {
    hu: {
        role: "Szerepkör",
        logout: "Kijelentkezés",
        admin_arrears_title: "Lakások és Egyenlegek",
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
        delete_confirm_title: "Biztosan törlöd a lakást?",
        delete_confirm_desc: "Ezzel a művelettel a lakás adatai törlésre kerülnek az aktuális nézetből. Ez nem visszavonható.",
        delete_btn: "Törlés véglegesítése"
    },
    en: {
        role: "Role",
        logout: "Logout",
        admin_arrears_title: "Flats and Balances",
        admin_add_transaction: "Add Transaction",
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
        delete_confirm_title: "Are you sure you want to delete this flat?",
        delete_confirm_desc: "This action will remove the flat's data from the current view. It cannot be undone.",
        delete_btn: "Confirm Deletion"
    }
};

function applyTranslations() {
    const lang = state.currentLang || 'hu';
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            if (el.tagName === 'INPUT' && el.type === 'button') {
                el.value = translations[lang][key];
            } else {
                el.textContent = translations[lang][key];
            }
        }
    });
}

window.toggleLanguage = function() {
    state.currentLang = state.currentLang === 'hu' ? 'en' : 'hu';
    saveStateToLocalStorage();
    applyTranslations();
    const flagImg = document.getElementById('lang-flag-img');
    if (flagImg) {
        flagImg.src = state.currentLang === 'hu' ? 'https://flagcdn.com/hu.svg' : 'https://flagcdn.com/gb.svg';
    }
}
`;

if (!appJs.includes('const translations =')) {
    appJs = missingCode + '\n' + appJs;
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Restored missing translations code.");
} else {
    console.log("Translations already present.");
}
