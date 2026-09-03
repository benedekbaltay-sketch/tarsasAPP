const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let data = fs.readFileSync(indexPath, 'utf8');

data = data.replace(
    '<div class="modal-box" style="max-width:100%; height:100vh; border-radius:0; border:none; display:flex; flex-direction:column;">',
    '<div class="modal-box" style="max-width:100%; height:100%; max-height:100%; border-radius:0; border:none; display:flex; flex-direction:column;">'
);

data = data.replace('<script src="app.js?v=15"></script>', '<script src="app.js?v=16"></script>');

fs.writeFileSync(indexPath, data);
console.log("Fixed fullscreen modal scrolling css");
