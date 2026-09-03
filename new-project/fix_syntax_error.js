const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Replace invalid template literal inside object literal
appJs = appJs.replace('show_all: "${(state.currentLang === "en") ? "Show all" : "Mutasd az összeset"}",', 'show_all: "Mutasd az összeset",');
appJs = appJs.replace('show_all: "${(state.currentLang === "en") ? "Show all" : "Mutasd az  sszeset"}",', 'show_all: "Mutasd az összeset",');

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Fixed syntax error in app.js");
