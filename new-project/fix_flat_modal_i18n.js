const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
const htmlPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';

let appJs = fs.readFileSync(appPath, 'utf8');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Add extra keys to translations dictionary in app.js
const extraDictHu = `
        basic_info: "Alapadatok",
        ownership_percentage: "Tulajdoni hányad (%)",
        tenant_count_persons: "Lakók száma (fő)",
        flat_details_title: "Lakás részletes adatlapja",
        save: "Mentés"`;

const extraDictEn = `
        basic_info: "Basic Information",
        ownership_percentage: "Ownership Share (%)",
        tenant_count_persons: "Number of Residents",
        flat_details_title: "Flat Details",
        save: "Save"`;

if (!appJs.includes("basic_info:")) {
    appJs = appJs.replace('phone: "Telefonszám"', 'phone: "Telefonszám",' + extraDictHu);
    appJs = appJs.replace('phone: "Phone Number"', 'phone: "Phone Number",' + extraDictEn);
}

// 2. Fix dynamic Lakás title in openFlatDetailModal
const oldTitleLine = `document.getElementById("flat-detail-title").textContent = \`\${flatNum}. Lakás részletes adatlapja\`;`;
const newTitleLine = `const isEn = (state.currentLang === 'en');\n    document.getElementById("flat-detail-title").textContent = isEn ? \`Flat \${flatNum} - Details\` : \`\${flatNum}. Lakás részletes adatlapja\`;`;

appJs = appJs.replace(oldTitleLine, newTitleLine);

// 3. Fix user header name & tenant flat name
appJs = appJs.replace('document.getElementById("header-user-name").textContent = `${state.currentUser.flatNum}. lakás`;', 'const isEn = (state.currentLang === "en");\n        document.getElementById("header-user-name").textContent = isEn ? `Flat ${state.currentUser.flatNum}` : `${state.currentUser.flatNum}. lakás`;');
appJs = appJs.replace('document.getElementById("tenant-flat-num").textContent = `${flat.flatNum}. lakás`;', 'const isEn = (state.currentLang === "en");\n        document.getElementById("tenant-flat-num").textContent = isEn ? `Flat ${flat.flatNum}` : `${flat.flatNum}. lakás`;');

// 4. Fix HTML form tags for edit flat form
html = html.replace('<h5 style="margin:0 0 8px 0;font-size:14px;color:var(--text-main);">Alapadatok</h5>', '<h5 style="margin:0 0 8px 0;font-size:14px;color:var(--text-main);" data-i18n="basic_info">Alapadatok</h5>');
html = html.replace('<label for="flat-ownership-input">Tulajdoni hányad (%)</label>', '<label for="flat-ownership-input" data-i18n="ownership_percentage">Tulajdoni hányad (%)</label>');
html = html.replace('<label for="flat-tenant-input">Lakók száma (fő)</label>', '<label for="flat-tenant-input" data-i18n="tenant_count_persons">Lakók száma (fő)</label>');
html = html.replace('<button type="button" class="btn btn-outline btn-sm" onclick="toggleFlatEditMode(false)">Mégse</button>', '<button type="button" class="btn btn-outline btn-sm" onclick="toggleFlatEditMode(false)" data-i18n="cancel">Mégse</button>');
html = html.replace('<button type="submit" class="btn btn-primary btn-sm">Mentés</button>', '<button type="submit" class="btn btn-primary btn-sm" data-i18n="save">Mentés</button>');

fs.writeFileSync(appPath, appJs, 'utf8');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log("Successfully updated flat detail modal & title translations!");
