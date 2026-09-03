const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
const htmlPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';

let appJs = fs.readFileSync(appPath, 'utf8');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Add edit_item_title to dictionary in app.js
if (!appJs.includes("edit_item_title:")) {
    appJs = appJs.replace('edit: "Szerkesztés",', 'edit: "Szerkesztés", edit_item_title: "Tétel szerkesztése",');
    appJs = appJs.replace('edit: "Edit",', 'edit: "Edit", edit_item_title: "Edit Item",');
}

// 2. Fix openFullscreenTx in app.js
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

appJs = appJs.replace(/window\.openFullscreenTx = function\(type\)[\s\S]*?renderFullscreenList\(\);/m, `window.openFullscreenTx = function(type) {
    fullscreenType = type;
    fullscreenEditMode = false;
    fullscreenSearchQuery = '';
    const isEn = (state.currentLang === 'en');
    
    const title = document.getElementById("fullscreen-tx-title");
    if (type === 'flat') {
        title.textContent = isEn ? \`Flat \${state.currentFlatDetailNum} - Full History\` : \`\${state.currentFlatDetailNum}. Lakás - Teljes előzmény\`;
    } else {
        title.textContent = isEn ? "All Transactions & Expenses" : "Minden tranzakció és kiadás";
    }
    
    // Reset edit button
    const editBtn = document.getElementById('fullscreen-edit-btn');
    if (editBtn) {
        editBtn.innerHTML = \`<i data-lucide="pencil" style="width:16px;height:16px;"></i> <span>\${isEn ? "Edit" : "Szerkesztés"}</span>\`;
        editBtn.style.background = '';
        editBtn.style.color = '';
        editBtn.style.border = '';
    }
    
    // Reset search
    const searchInput = document.getElementById('fullscreen-search-input');
    if (searchInput) searchInput.value = '';
    
    renderFullscreenList();`);

// 3. Fix data-i18n in index.html
html = html.replace('<button id="grid-edit-btn" class="btn btn-outline btn-sm" onclick="toggleGridEditMode()">\n                                <i data-lucide="pencil" style="width:14px;height:14px;"></i> <span>Szerkesztés</span>\n                            </button>', '<button id="grid-edit-btn" class="btn btn-outline btn-sm" onclick="toggleGridEditMode()">\n                                <i data-lucide="pencil" style="width:14px;height:14px;"></i> <span data-i18n="edit">Szerkesztés</span>\n                            </button>');

html = html.replace('<span>Szerkesztés</span>', '<span data-i18n="edit">Szerkesztés</span>');
html = html.replace('<span>Szerkesztés</span>', '<span data-i18n="edit">Szerkesztés</span>');
html = html.replace('<span>Szerkesztés</span>', '<span data-i18n="edit">Szerkesztés</span>');
html = html.replace('<h3>Tétel szerkesztése</h3>', '<h3 data-i18n="edit_item_title">Tétel szerkesztése</h3>');
html = html.replace('title="Adatok szerkesztése"', 'title="Adatok szerkesztése" data-i18n-title="edit"');

fs.writeFileSync(appPath, appJs, 'utf8');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log("Successfully fixed all Szerkesztés occurrences across app.js and index.html!");
