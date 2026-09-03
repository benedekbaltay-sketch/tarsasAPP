const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Fix buttons layout: use fixed widths and stop wrapping
// Remove flex-wrap: wrap from user-profile in styles.css
const cssPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/styles.css';
let css = fs.readFileSync(cssPath, 'utf8');
css = css.replace(/flex-wrap:\s*wrap;/g, '');
fs.writeFileSync(cssPath, css);

// Fix index.html buttons
// Language button with flag image
indexHtml = indexHtml.replace(
    /<button id="lang-toggle-btn"[\s\S]*?<\/button>/,
    `<button id="lang-toggle-btn" class="btn btn-outline btn-sm btn-icon-only" style="width: 40px; height: 32px; padding: 0; border: none; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" onclick="toggleLanguage()">
        <img id="lang-flag-img" src="https://flagcdn.com/hu.svg" style="width: 24px; border-radius: 2px;" alt="HU">
    </button>`
);

// Role and Name container
indexHtml = indexHtml.replace(
    /<div class="user-info"[^>]*>[\s\S]*?<\/div>/,
    `<div class="user-info" style="width: 140px; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end;">
        <span class="user-role-badge" id="header-user-role" data-i18n="role" style="text-align: right; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; box-sizing: border-box;">Szerepkör</span>
        <span class="user-name" id="header-user-name" style="text-align: right; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; box-sizing: border-box;">Felhasználó</span>
    </div>`
);

// Logout button
indexHtml = indexHtml.replace(
    /<button class="btn btn-outline" id="logout-btn".*?<\/button>/,
    `<button class="btn btn-outline" id="logout-btn" style="width: 130px; flex-shrink: 0; justify-content: center;" onclick="logout()" data-i18n="logout">Kijelentkezés</button>`
);

indexHtml = indexHtml.replace('<script src="app.js?v=27"></script>', '<script src="app.js?v=28"></script>');
fs.writeFileSync(indexPath, indexHtml, 'utf8');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Update applyTranslations to use the image
appJs = appJs.replace(
    /const langBtn = document\.getElementById\("lang-toggle-btn"\);\s*if \(langBtn\) {[\s\S]*?}/,
    `const flagImg = document.getElementById("lang-flag-img");
    if (flagImg) {
        flagImg.src = state.currentLang === "hu" ? "https://flagcdn.com/gb.svg" : "https://flagcdn.com/hu.svg";
        flagImg.alt = state.currentLang === "hu" ? "GB" : "HU";
    }`
);

fs.writeFileSync(appPath, appJs, 'utf8');

console.log("Fixed flags with SVG and fixed layout shifting");
