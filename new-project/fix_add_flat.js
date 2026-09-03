const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let html = fs.readFileSync(indexPath, 'utf8');

const targetStr = `<div class="form-group">
                    <label for="new-flat-renovation" data-i18n="renovation_fee">Felújítási Alap Előírás (Ft/hó)</label>
                    <input id="new-flat-renovation" type="number" min="0" class="form-input" required />
                </div>`;

const injectStr = `
                <div class="form-group">
                    <label for="new-flat-ownership">Tulajdoni hányad (%)</label>
                    <input id="new-flat-ownership" type="number" step="0.01" min="0" class="form-input" required />
                </div>
                <div class="form-group">
                    <label for="new-flat-tenant">Lakók száma (fő)</label>
                    <input id="new-flat-tenant" type="number" min="1" class="form-input" required />
                </div>`;

if (!html.includes('id="new-flat-ownership"')) {
    html = html.replace(targetStr, targetStr + injectStr);
    fs.writeFileSync(indexPath, html, 'utf8');
    console.log("Added new-flat-ownership and new-flat-tenant to index.html");
} else {
    console.log("Already present in index.html");
}
