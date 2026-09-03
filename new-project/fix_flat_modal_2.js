const fs = require('fs');

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// 1. Remove the tab buttons
const regexTabs = /<div style="display:flex; gap:8px; margin-bottom: 12px;">\s*<button class="btn btn-primary btn-sm" id="flat-tab-kk" onclick="setFlatModalTab\('Közös Költség'\)">Közös Költség<\/button>\s*<button class="btn btn-outline btn-sm" id="flat-tab-fa" onclick="setFlatModalTab\('Felújítási Alap'\)">Felújítási Alap<\/button>\s*<\/div>/;
indexHtml = indexHtml.replace(regexTabs, '');

// 2. Remove max-height from table-responsive and add view all container
const regexTableWrap = /<div class="table-responsive" style="max-height: 250px; overflow-y: auto; border: 1px solid var\(--border-color\); border-radius: var\(--radius-md\);">\s*<table class="data-table">([\s\S]*?)<\/table>\s*<\/div>/;
const replacementTableWrap = `<div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                    <table class="data-table">$1</table>
                </div>
                <div id="flat-view-all-container" style="text-align:center; padding-top:16px;">
                    <button class="btn btn-outline" id="flat-view-all-btn" onclick="toggleFlatViewAll()">Minden tranzakció megjelenítése</button>
                </div>`;
indexHtml = indexHtml.replace(regexTableWrap, replacementTableWrap);

indexHtml = indexHtml.replace('<script src="app.js?v=35"></script>', '<script src="app.js?v=36"></script>');
fs.writeFileSync(indexPath, indexHtml, 'utf8');

console.log("Updated index.html!");
