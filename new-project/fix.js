const fs = require('fs');
const path = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let data = fs.readFileSync(path, 'utf8');
const replacement = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/replacement.txt', 'utf8');

const startStr = 'function renderAdminTransactions(showAll = false) {';
const endStr = '// --- Action Handlers ---';

const start = data.indexOf(startStr);
const end = data.indexOf(endStr);

if (start === -1 || end === -1) {
    console.log("Not found");
    process.exit(1);
}

data = data.substring(0, start) + replacement + "\n\n" + data.substring(end);
fs.writeFileSync(path, data);
console.log("Replaced successfully");
