const fs = require('fs');

// 1. Update index.html
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let html = fs.readFileSync(indexPath, 'utf8');

// Remove current balance A and rename date input
const targetKk = `<div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-fee-date-input">Új díj érvényes ettől</label>
                        <input id="flat-fee-date-input" type="month" class="form-input" title="Hagyja üresen, ha nincs jövőbeli/múltbeli változás" />
                    </div>
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-current-balance-a">Jelenlegi KK Egyenleg (Ft)</label>
                        <input id="flat-current-balance-a" type="number" class="form-input" title="Átírással automatikus korrekció készül!" />
                    </div>`;
const replacementKk = `<div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-fee-date-input">Melyik hónaptól érvényes?</label>
                        <input id="flat-fee-date-input" type="month" class="form-input" title="Válassza ki a kezdő hónapot (visszamenőleg is)" />
                    </div>`;

// Remove current balance B and rename date input
const targetFa = `<div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-renovation-fee-date-input">Új díj érvényes ettől</label>
                        <input id="flat-renovation-fee-date-input" type="month" class="form-input" title="Hagyja üresen, ha nincs jövőbeli/múltbeli változás" />
                    </div>
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-current-balance-b">Jelenlegi FA Egyenleg (Ft)</label>
                        <input id="flat-current-balance-b" type="number" class="form-input" title="Átírással automatikus korrekció készül!" />
                    </div>`;
const replacementFa = `<div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-renovation-fee-date-input">Melyik hónaptól érvényes?</label>
                        <input id="flat-renovation-fee-date-input" type="month" class="form-input" title="Válassza ki a kezdő hónapot (visszamenőleg is)" />
                    </div>`;

html = html.replace(targetKk, replacementKk);
html = html.replace(targetFa, replacementFa);

fs.writeFileSync(indexPath, html, 'utf8');
console.log("Updated index.html");

// 2. Update app.js
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Remove current balance fetching in toggleFlatEditMode
const targetJsToggle = `        document.getElementById("flat-fee-input").value = flat.monthlyFee || 0;
        document.getElementById("flat-fee-date-input").value = "";
        document.getElementById("flat-current-balance-a").value = flat.balance || 0;
        
        document.getElementById("flat-renovation-fee-input").value = flat.renovationFee || 0;
        document.getElementById("flat-renovation-fee-date-input").value = "";
        document.getElementById("flat-current-balance-b").value = flat.renovationBalance || 0;`;
const replacementJsToggle = `        document.getElementById("flat-fee-input").value = flat.monthlyFee || 0;
        document.getElementById("flat-fee-date-input").value = "";
        
        document.getElementById("flat-renovation-fee-input").value = flat.renovationFee || 0;
        document.getElementById("flat-renovation-fee-date-input").value = "";`;
appJs = appJs.replace(targetJsToggle, replacementJsToggle);

// Remove balance processing logic from form submit
const targetJsSubmit = `    const newRenovationFeeDate = document.getElementById("flat-renovation-fee-date-input").value;
    
    const targetBalA = parseFloat(document.getElementById("flat-current-balance-a").value) || 0;
    const targetBalB = parseFloat(document.getElementById("flat-current-balance-b").value) || 0;
    
    const flatIndex = state.flats.findIndex(f => f.flatNum === flatNum);
    if (flatIndex === -1) return;
    const flat = state.flats[flatIndex];
    
    // Process Balance Corrections
    const diffA = targetBalA - (flat.balance || 0);
    const diffB = targetBalB - (flat.renovationBalance || 0);
    
    const today = new Date().toISOString().split('T')[0];
    
    if (Math.abs(diffA) > 0.01) {
        state.transactions.push({
            id: 'tx-' + Date.now() + '-kk-corr',
            date: today,
            type: "Credit",
            amount: diffA,
            flatNum: flat.flatNum,
            account: "Közös Költség",
            method: "Egyenleg korrekció",
            reference: diffA > 0 ? "Kézi jóváírás" : "Kézi terhelés"
        });
    }
    
    if (Math.abs(diffB) > 0.01) {
        state.transactions.push({
            id: 'tx-' + Date.now() + '-fa-corr',
            date: today,
            type: "Credit",
            amount: diffB,
            flatNum: flat.flatNum,
            account: "Felújítási Alap",
            method: "Egyenleg korrekció",
            reference: diffB > 0 ? "Kézi jóváírás" : "Kézi terhelés"
        });
    }`;

const replacementJsSubmit = `    const newRenovationFeeDate = document.getElementById("flat-renovation-fee-date-input").value;
    
    const flatIndex = state.flats.findIndex(f => f.flatNum === flatNum);
    if (flatIndex === -1) return;
    const flat = state.flats[flatIndex];
    
    const today = new Date().toISOString().split('T')[0];`;
appJs = appJs.replace(targetJsSubmit, replacementJsSubmit);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Updated app.js");
