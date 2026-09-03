const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const target1 = `    document.getElementById("flat-current-balance-a").value = flat.balance || 0;
    document.getElementById("flat-current-balance-b").value = flat.renovationBalance || 0;`;

if (appJs.includes(target1)) {
    appJs = appJs.replace(target1, '');
} else {
    appJs = appJs.replace('document.getElementById("flat-current-balance-a").value = flat.balance || 0;', '');
    appJs = appJs.replace('document.getElementById("flat-current-balance-b").value = flat.renovationBalance || 0;', '');
}

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Fixed openFlatDetailModal crash!");
