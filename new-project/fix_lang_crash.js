const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Ensure state has currentLang default
if (!appJs.includes("currentLang: 'hu'")) {
    appJs = appJs.replace("let state = {", "let state = {\n    currentLang: 'hu',");
}

// Safely replace translations[state.currentLang]
appJs = appJs.split('translations[state.currentLang]').join('(translations[state.currentLang || "hu"] || translations.hu)');

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully fixed currentLang crash!");
