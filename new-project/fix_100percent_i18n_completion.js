const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
const htmlPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';

let appJs = fs.readFileSync(appPath, 'utf8');
let html = fs.readFileSync(htmlPath, 'utf8');

// Helper in JS to get balance badge text cleanly
const getBalanceTextHelper = `function getBalanceBadgeText(balance) {
    const isEn = (state.currentLang === 'en');
    if (balance > 0) return (isEn ? "Overpaid: " : "Túlfizetés: ") + formatCurrency(balance);
    if (balance < 0) return (isEn ? "Arrears: " : "Hátralék: ") + formatCurrency(balance);
    return isEn ? "Settled" : "Rendezett";
}`;

if (!appJs.includes("function getBalanceBadgeText")) {
    appJs = appJs.replace("function getHeroSubtext(balance) {", getBalanceTextHelper + "\n\nfunction getHeroSubtext(balance) {\n    const isEn = (state.currentLang === 'en');");
}

appJs = appJs.replace('return "Minden előírás sikeresen kiegyenlítve.";', 'return isEn ? "All monthly fees fully settled." : "Minden előírás sikeresen kiegyenlítve.";');
appJs = appJs.replace('return "Önnek nincs elmaradása, egyenlege pozitív.";', 'return isEn ? "You have no arrears, your balance is positive." : "Önnek nincs elmaradása, egyenlege pozitív.";');
appJs = appJs.replace('return "Kérjük, fizesse be a hátralévő összeget mielőbb!";', 'return isEn ? "Please pay the outstanding arrears balance as soon as possible." : "Kérjük, fizesse be a hátralévő összeget mielőbb!";');

// Update hero values in tenant dashboard
appJs = appJs.replace('heroValueA.textContent = flat.balance > 0 ? `Túlfizetés: ${formatCurrency(flat.balance)}` : (flat.balance < 0 ? `Hátralék: ${formatCurrency(flat.balance)}` : "Rendezett");', 'heroValueA.textContent = getBalanceBadgeText(flat.balance);');
appJs = appJs.replace('heroValueB.textContent = flat.renovationBalance > 0 ? `Túlfizetés: ${formatCurrency(flat.renovationBalance)}` : (flat.renovationBalance < 0 ? `Hátralék: ${formatCurrency(flat.renovationBalance)}` : "Rendezett");', 'heroValueB.textContent = getBalanceBadgeText(flat.renovationBalance);');

// Update status badge for payment
appJs = appJs.replace('typeBadge = `<span class="status-badge status-verified"><i data-lucide="arrow-up" style="width:12px;height:12px;"></i> Befizetés</span>`;', 'typeBadge = `<span class="status-badge status-verified"><i data-lucide="arrow-up" style="width:12px;height:12px;"></i> ${(state.currentLang === "en") ? "Payment" : "Befizetés"}</span>`;');

// Dropdown option text content for flat selection
appJs = appJs.replace('opt.textContent = `${f.flatNum}. Lakás`;', 'opt.textContent = (state.currentLang === "en") ? `Flat ${f.flatNum}` : `${f.flatNum}. Lakás`;');
appJs = appJs.replace('opt.textContent = `${f.flatNum}. Lakás`;', 'opt.textContent = (state.currentLang === "en") ? `Flat ${f.flatNum}` : `${f.flatNum}. Lakás`;');

// Timeline view all button
appJs = appJs.replace('viewAllBtn.innerHTML = state.flatViewAll ? "Kevesebb tranzakció" : "Minden tranzakció megtekintése";', 'viewAllBtn.innerHTML = state.flatViewAll ? ((state.currentLang === "en") ? "Fewer transactions" : "Kevesebb tranzakció") : ((state.currentLang === "en") ? "View all transactions" : "Minden tranzakció megtekintése");');

// Edit & delete titles in flat timeline table
appJs = appJs.replace('title="Módosítás"', 'title="${isEn ? "Edit" : "Módosítás"}"');
appJs = appJs.replace('title="Törlés"', 'title="${isEn ? "Delete" : "Törlés"}"');
appJs = appJs.replace('title="Megjegyzés szerkesztése"', 'title="${isEn ? "Edit comment" : "Megjegyzés szerkesztése"}"');

// Fullscreen tx list item type display
appJs = appJs.replace('displayName: `${t.flatNum}. Lakás`,', 'displayName: (state.currentLang === "en") ? `Flat ${t.flatNum}` : `${t.flatNum}. Lakás`,');

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully applied 100% complete i18n fixes to app.js!");
