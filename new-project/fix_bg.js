const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let data = fs.readFileSync(indexPath, 'utf8');

data = data.replace('background:var(--bg-main)', 'background:var(--bg-body)');

data = data.replace('<script src="app.js?v=23"></script>', '<script src="app.js?v=24"></script>');

fs.writeFileSync(indexPath, data);
console.log("Fixed transparent modal background");
