const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let data = fs.readFileSync(indexPath, 'utf8');

data = data.replace(
    '<div id="fullscreen-tx-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:9999; background:var(--bg-main); flex-direction:column;">',
    '<div id="fullscreen-tx-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; z-index:9999; background:var(--bg-main); flex-direction:column;">'
);

data = data.replace('<script src="app.js?v=21"></script>', '<script src="app.js?v=22"></script>');

fs.writeFileSync(indexPath, data);
console.log("Fixed 100vh bug");
