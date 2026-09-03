const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Replace the <main class="app-container"> with a simpler main tag that takes up full width
indexHtml = indexHtml.replace('<main class="app-container">', '<main style="flex: 1; width: 100%; display: flex; flex-direction: column;">');

// bump version
indexHtml = indexHtml.replace('<script src="app.js?v=33"></script>', '<script src="app.js?v=34"></script>');
fs.writeFileSync(indexPath, indexHtml, 'utf8');

console.log("Fixed nested app-container bug!");
