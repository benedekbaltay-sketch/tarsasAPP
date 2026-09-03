const fs = require('fs');
const appJs = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js', 'utf8');
const testCode = 
var window = {};
var document = {
    getElementById: () => ({ style: {}, classList: {add: ()=>{}, remove: ()=>{}} }),
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: {add: ()=>{}, remove: ()=>{}} }),
    addEventListener: () => {}
};
var localStorage = { getItem: () => null, setItem: () => null };
var lucide = { createIcons: () => null };
 + appJs;
try {
    eval(testCode);
    console.log("No syntax errors");
} catch (e) {
    console.log("Error:", e.toString());
}
