const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const oldToggle = `window.toggleLanguage = function() {
    state.currentLang = state.currentLang === 'hu' ? 'en' : 'hu';
    saveStateToLocalStorage();
    applyTranslations();
    updateAppView();
    const flagImg = document.getElementById('lang-flag-img');
    if (flagImg) {
        flagImg.src = state.currentLang === 'hu' ? 'https://flagcdn.com/hu.svg' : 'https://flagcdn.com/gb.svg';
    }
};`;

const newToggle = `window.toggleLanguage = function() {
    state.currentLang = state.currentLang === 'hu' ? 'en' : 'hu';
    saveStateToLocalStorage();
    applyTranslations();
    updateAppView();
    updateLangFlag();
};

function updateLangFlag() {
    const flagImg = document.getElementById('lang-flag-img');
    if (flagImg) {
        const isHu = (state.currentLang === 'hu' || !state.currentLang);
        flagImg.src = isHu ? 'https://flagcdn.com/gb.svg' : 'https://flagcdn.com/hu.svg';
        flagImg.alt = isHu ? 'EN' : 'HU';
        flagImg.title = isHu ? 'Switch to English' : 'Váltás magyar nyelvre';
    }
}`;

appJs = appJs.replace(oldToggle, newToggle);

// Also call updateLangFlag() in applyTranslations()
appJs = appJs.replace('function applyTranslations() {', 'function applyTranslations() {\n    updateLangFlag();');

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully updated flag toggle logic in app.js");
