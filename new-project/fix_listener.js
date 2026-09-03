const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const regex = /document\.getElementById\("reset-db-btn"\)\.addEventListener\("click", function\(\) {[\s\S]*?}\);/g;
appJs = appJs.replace(regex, '');

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Removed reset-db-btn event listener");

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace('<script src="app.js?v=26"></script>', '<script src="app.js?v=27"></script>');
fs.writeFileSync(indexPath, indexHtml, 'utf8');
