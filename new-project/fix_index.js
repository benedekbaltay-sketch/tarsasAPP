const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let data = fs.readFileSync(indexPath, 'utf8');

data = data.replace('????', '🇭🇺');
data = data.replace('<script src="app.js?v=14"></script>', '<script src="app.js?v=15"></script>');

fs.writeFileSync(indexPath, data);
console.log("Fixed index.html emojis");
