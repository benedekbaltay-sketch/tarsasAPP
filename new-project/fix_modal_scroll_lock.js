const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// 1. In openFlatDetailModal
appJs = appJs.replace(
    'document.getElementById("flat-detail-modal").style.display = "flex";',
    'document.getElementById("flat-detail-modal").style.display = "flex";\n    document.body.style.overflow = "hidden";'
);

// 2. In closeFlatDetailModal
appJs = appJs.replace(
    'document.getElementById("flat-detail-modal").style.display = "none";',
    'document.getElementById("flat-detail-modal").style.display = "none";\n    document.body.style.overflow = "";'
);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully updated modal scroll lock in app.js");
