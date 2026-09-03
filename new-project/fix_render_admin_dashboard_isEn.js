const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

appJs = appJs.replace('function renderAdminDashboard() {\n    recalculateFlatBalances();', 'function renderAdminDashboard() {\n    const isEn = (state.currentLang === "en");\n    recalculateFlatBalances();');

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully added isEn to renderAdminDashboard");
