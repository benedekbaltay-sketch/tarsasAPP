const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const oldArrearsFunc = `function renderArrearsMatrix() {
    const container = document.getElementById("arrears-matrix-list");
    container.innerHTML = "";
    
    const delText = (translations[state.currentLang || "hu"] || translations.hu).delete || "Törlés";`;

const newArrearsFunc = `function renderArrearsMatrix() {
    const container = document.getElementById("arrears-matrix-list");
    if (!container) return;
    container.innerHTML = "";
    
    const isEn = (state.currentLang === 'en');
    const delText = (translations[state.currentLang || "hu"] || translations.hu).delete || "Törlés";`;

appJs = appJs.replace(oldArrearsFunc, newArrearsFunc);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully fixed missing isEn declaration in renderArrearsMatrix!");
