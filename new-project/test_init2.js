const jsdom = require('jsdom'); 
const { JSDOM } = jsdom; 
const fs = require('fs'); 
const dom = new JSDOM(fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html', 'utf8'), { url: 'http://localhost/', runScripts: 'dangerously' }); 
dom.window.localStorage.setItem('tarsashaz_state', '{}'); 

const errEl = dom.window.document.createElement('script'); 
errEl.textContent = 'window.onerror = function(m, u, l, c, e) { console.log("GLOBAL_ERROR:", m, l, e && e.stack); }'; 
dom.window.document.head.appendChild(errEl); 

const script = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js', 'utf8'); 
const el = dom.window.document.createElement('script'); 
el.textContent = script; 
dom.window.document.body.appendChild(el); 

console.log('Script loaded. Calling quickLogin...'); 
dom.window.quickLogin('admin'); 
console.log('Done!');
