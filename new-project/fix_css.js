const fs = require('fs');
const cssPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/styles.css';
let css = fs.readFileSync(cssPath, 'utf8');

css = css.replace('.user-profile {\n    display: flex;\n    align-items: center;\n    gap: 16px;\n}', '.user-profile {\n    display: flex;\n    align-items: center;\n    gap: 16px;\n    flex-wrap: wrap;\n}');

fs.writeFileSync(cssPath, css);
console.log("Fixed flex-wrap on user-profile");
