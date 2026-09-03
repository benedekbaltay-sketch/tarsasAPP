const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let data = fs.readFileSync(indexPath, 'utf8');

if (!data.includes('white-space: normal;')) {
    data = data.replace('.tx-subtitle {\n        font-size: 13px;\n        color: var(--text-muted);', '.tx-subtitle {\n        font-size: 13px;\n        color: var(--text-muted);\n        white-space: normal;\n        word-break: break-word;');
}

data = data.replace('<script src="app.js?v=22"></script>', '<script src="app.js?v=23"></script>');

fs.writeFileSync(indexPath, data);
console.log("Added word-break to tx-subtitle");
