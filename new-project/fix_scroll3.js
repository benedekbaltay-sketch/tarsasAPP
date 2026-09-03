const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let data = fs.readFileSync(indexPath, 'utf8');

data = data.replace(
    '<div class="modal-body" style="overflow-y:auto; padding:24px; flex:1;">',
    '<div class="modal-body" style="overflow-y:auto; padding:24px; flex:1; min-height:0;">'
);

data = data.replace('<script src="app.js?v=17"></script>', '<script src="app.js?v=18"></script>');

fs.writeFileSync(indexPath, data);
console.log("Fixed flexbox min-height bug");
