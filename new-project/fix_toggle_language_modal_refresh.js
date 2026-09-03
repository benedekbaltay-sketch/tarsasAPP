const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const oldToggle = `window.toggleLanguage = function() {
    state.currentLang = state.currentLang === 'hu' ? 'en' : 'hu';
    saveStateToLocalStorage();
    applyTranslations();
    updateAppView();
    updateLangFlag();
};`;

const newToggle = `window.toggleLanguage = function() {
    state.currentLang = state.currentLang === 'hu' ? 'en' : 'hu';
    saveStateToLocalStorage();
    applyTranslations();
    updateAppView();
    updateLangFlag();
    
    // Auto-refresh active modals with new language strings
    const flatModal = document.getElementById("flat-detail-modal");
    if (flatModal && flatModal.style.display === "flex" && state.currentFlatDetailNum) {
        openFlatDetailModal(state.currentFlatDetailNum);
    }
    
    const fsModal = document.getElementById("fullscreen-tx-modal");
    if (fsModal && fsModal.style.display === "flex") {
        openFullscreenTx(typeof fullscreenType !== 'undefined' ? fullscreenType : 'global');
    }
};`;

appJs = appJs.replace(oldToggle, newToggle);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully updated toggleLanguage to refresh open modals!");
