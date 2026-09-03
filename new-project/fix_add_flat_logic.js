const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const target = `    const ownershipShare = parseFloat(document.getElementById("new-flat-ownership").value) || 0;
    
    if (state.flats.some(f => f.flatNum === flatNum)) {`;
    
const replacement = `    const ownershipShare = parseFloat(document.getElementById("new-flat-ownership").value) || 0;
    const tenantCount = parseInt(document.getElementById("new-flat-tenant").value, 10) || 1;
    
    if (state.flats.some(f => f.flatNum === flatNum)) {`;

appJs = appJs.replace(target, replacement);
appJs = appJs.replace('tenantCount: 1,', 'tenantCount,');
appJs = appJs.replace('        flatNum,\n        tenantCount,', '        flatNum,\n        tenantCount,\n        ownershipShare,');

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Fixed add-flat logic!");
