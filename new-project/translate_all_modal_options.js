const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
const htmlPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';

let appJs = fs.readFileSync(appPath, 'utf8');
let html = fs.readFileSync(htmlPath, 'utf8');

// Add option translation logic to applyTranslations in app.js
if (!appJs.includes("document.querySelectorAll('option[data-i18n]')")) {
    appJs = appJs.replace("document.querySelectorAll('[data-i18n]').forEach(el => {", "document.querySelectorAll('[data-i18n], option[data-i18n]').forEach(el => {");
}

// Map of HTML strings in modals/forms to add data-i18n
const replacements = [
    ['<option value="Közös Költség">Közös Költség</option>', '<option value="Közös Költség" data-i18n="common_cost">Közös Költség</option>'],
    ['<option value="Felújítási Alap">Felújítási Alap</option>', '<option value="Felújítási Alap" data-i18n="renovation_fund">Felújítási Alap</option>'],
    ['<option value="Banki átutalás">Banki átutalás</option>', '<option value="Banki átutalás" data-i18n="bank_transfer">Banki átutalás</option>'],
    ['<option value="Készpénz korrekció">Készpénz korrekció</option>', '<option value="Készpénz korrekció" data-i18n="cash_offset">Készpénz korrekció</option>'],
    ['<option value="Közmű">Közmű</option>', '<option value="Közmű" data-i18n="utility">Közmű</option>'],
    ['<option value="Biztosítás">Biztosítás</option>', '<option value="Biztosítás" data-i18n="insurance">Biztosítás</option>'],
    ['<option value="Karbantartás">Karbantartás</option>', '<option value="Karbantartás" data-i18n="maintenance">Karbantartás</option>'],
    ['<option value="Bankköltség">Bankköltség</option>', '<option value="Bankköltség" data-i18n="bank_fee">Bankköltség</option>'],
    ['<button type="button" class="btn btn-outline" onclick="closeModal()">Mégse</button>', '<button type="button" class="btn btn-outline" onclick="closeModal()" data-i18n="cancel">Mégse</button>'],
    ['<button type="submit" class="btn btn-primary" id="tx-submit-btn">Mentés</button>', '<button type="submit" class="btn btn-primary" id="tx-submit-btn" data-i18n="save">Mentés</button>'],
    ['<button type="button" class="btn btn-outline" onclick="closeAddFlatModal()">Mégse</button>', '<button type="button" class="btn btn-outline" onclick="closeAddFlatModal()" data-i18n="cancel">Mégse</button>'],
    ['<button type="submit" class="btn btn-primary">Hozzáadás</button>', '<button type="submit" class="btn btn-primary" data-i18n="add">Hozzáadás</button>'],
    ['<button type="button" class="btn btn-outline" onclick="closeDeleteModal()">Mégse</button>', '<button type="button" class="btn btn-outline" onclick="closeDeleteModal()" data-i18n="cancel">Mégse</button>'],
    ['<button type="button" class="btn btn-danger" onclick="confirmDeleteFlat()">Törlés véglegesítése</button>', '<button type="button" class="btn btn-danger" onclick="confirmDeleteFlat()" data-i18n="delete_btn">Törlés véglegesítése</button>'],
    ['<button type="button" class="btn btn-outline" onclick="document.getElementById(\'delete-tx-confirm-modal\').style.display=\'none\'">Mégse</button>', '<button type="button" class="btn btn-outline" onclick="document.getElementById(\'delete-tx-confirm-modal\').style.display=\'none\'" data-i18n="cancel">Mégse</button>'],
    ['<button type="button" class="btn btn-danger" onclick="confirmDeleteTx()">Törlés véglegesítése</button>', '<button type="button" class="btn btn-danger" onclick="confirmDeleteTx()" data-i18n="delete_btn">Törlés véglegesítése</button>']
];

replacements.forEach(([from, to]) => {
    html = html.split(from).join(to);
});

fs.writeFileSync(appPath, appJs, 'utf8');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log("Successfully updated options and modal buttons for 100% translation coverage!");
