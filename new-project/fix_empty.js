const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const regex = /const hasNewSchema = state\.flats && state\.flats\.length > 0 && \('renovationBalance' in state\.flats\[0\]\);\s*if \(!hasNewSchema\) {[\s\S]*?}/;

const replacement = `const hasNewSchema = state.flats && state.flats.length > 0 && ('renovationBalance' in state.flats[0]);
            const hasTransactions = state.transactions && state.transactions.length > 0;
            if (!hasNewSchema || !hasTransactions) {
                console.log("Empty or old database schema detected. Performing automatic reset...");
                resetStateToDefaults();
            }`;

appJs = appJs.replace(regex, replacement);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Added auto-reset logic for empty transactions");

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace('<script src="app.js?v=25"></script>', '<script src="app.js?v=26"></script>');
fs.writeFileSync(indexPath, indexHtml, 'utf8');
