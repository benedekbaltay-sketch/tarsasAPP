const fs = require('fs');

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';

let indexHtml = fs.readFileSync(indexPath, 'utf8');
let appJs = fs.readFileSync(appPath, 'utf8');

// 1. Update index.html
const regexOldFees = /<div class="stat-item">\s*<span class="stat-label">Havi el[öő']r[ás]+ \(KK\+FA\)<\/span>\s*<span class="stat-value" id="flat-detail-fees-summary">.*?<\/span>\s*<\/div>/i;

const newFeesHTML = `<div class="stat-item">
                    <span class="stat-label">Havi KK előírás</span>
                    <span class="stat-value" id="flat-detail-fee-a">–</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Havi FA előírás</span>
                    <span class="stat-value" id="flat-detail-fee-b">–</span>
                </div>`;

indexHtml = indexHtml.replace(regexOldFees, newFeesHTML);
indexHtml = indexHtml.replace('v=39', 'v=40');
fs.writeFileSync(indexPath, indexHtml, 'utf8');


// 2. Update app.js
const regexOldAppJs = /document\.getElementById\("flat-detail-fees-summary"\)\.textContent = `\$\{formatCurrency\(flat\.monthlyFee\)\} \+ \$\{formatCurrency\(flat\.renovationFee\)\}`;/g;

const newAppJs = `document.getElementById("flat-detail-fee-a").textContent = formatCurrency(flat.monthlyFee);
    document.getElementById("flat-detail-fee-b").textContent = formatCurrency(flat.renovationFee);`;

appJs = appJs.replace(regexOldAppJs, newAppJs);
fs.writeFileSync(appPath, appJs, 'utf8');

console.log("Updated both files for split fees!");
