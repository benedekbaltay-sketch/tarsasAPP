const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let data = fs.readFileSync(indexPath, 'utf8');

data = data.replace('white-space: nowrap;\n        overflow: hidden;\n        text-overflow: ellipsis;', '/* nowrap removed */');
data = data.replace('white-space: nowrap;\r\n        overflow: hidden;\r\n        text-overflow: ellipsis;', '/* nowrap removed */');
data = data.replace('white-space: nowrap; overflow: hidden; text-overflow: ellipsis;', '');

// Try a more robust regex if the above fails
data = data.replace(/white-space:\s*nowrap;[\s\S]*?text-overflow:\s*ellipsis;/g, '');

data = data.replace('<script src="app.js?v=20"></script>', '<script src="app.js?v=21"></script>');

fs.writeFileSync(indexPath, data);
console.log("Removed text truncation from tx-subtitle");
