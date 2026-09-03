const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const startStr = 'window.toggleFullscreenEditMode = function() {';
const endStr = 'window.exportFullscreenToExcel = function() {';

const si = appJs.indexOf(startStr);
const ei = appJs.indexOf(endStr);

if (si === -1 || ei === -1) { console.log('not found'); process.exit(1); }

const newFunc = `window.toggleFullscreenEditMode = function() {
    fullscreenEditMode = !fullscreenEditMode;
    const btn = document.getElementById('fullscreen-edit-btn');
    if (btn) {
        if (fullscreenEditMode) {
            btn.innerHTML = '<i data-lucide="x" style="width:16px;height:16px;"></i> <span>M\u00e9gse</span>';
            btn.style.background = 'var(--danger)';
            btn.style.color = '#fff';
            btn.style.border = 'none';
        } else {
            btn.innerHTML = '<i data-lucide="pencil" style="width:16px;height:16px;"></i> <span>Szerkeszt\u00e9s</span>';
            btn.style.background = '';
            btn.style.color = '';
            btn.style.border = '';
        }
        lucide.createIcons();
    }
    renderFullscreenList();
};

`;

appJs = appJs.substring(0, si) + newFunc + appJs.substring(ei);
fs.writeFileSync(appPath, appJs, 'utf8');
console.log('Done');
