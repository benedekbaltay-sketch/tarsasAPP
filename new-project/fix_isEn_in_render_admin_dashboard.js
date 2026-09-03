const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const oldFuncStart = `function renderAdminDashboard() {
    // Populate total treasury & reserves`;

const newFuncStart = `function renderAdminDashboard() {
    const isEn = (state.currentLang === 'en');
    // Populate total treasury & reserves`;

appJs = appJs.replace(oldFuncStart, newFuncStart);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully defined isEn in renderAdminDashboard!");
