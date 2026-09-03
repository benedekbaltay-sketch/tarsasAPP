const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let data = fs.readFileSync(indexPath, 'utf8');

data = data.replace(
    '<div id="fullscreen-tx-modal" class="modal-overlay" style="display:none; padding:0; align-items:flex-start;">',
    '<div id="fullscreen-tx-modal" class="modal-overlay" style="display:none; padding:0; align-items:stretch;">'
);

data = data.replace('<script src="app.js?v=16"></script>', '<script src="app.js?v=17"></script>');

fs.writeFileSync(indexPath, data);
console.log("Fixed flex-start to stretch");
