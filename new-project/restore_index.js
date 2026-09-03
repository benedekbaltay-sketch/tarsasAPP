const fs = require('fs');
const path = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let data = fs.readFileSync(path, 'utf8');

data = data.replace('<div id="admin-transactions-tbody" class="modern-list"></div>', 
`<table class="ledger-table">
    <thead>
        <tr>
            <th>Dátum</th>
            <th>Típus</th>
            <th>Név / Lakás</th>
            <th>Összeg</th>
            <th>Kategória / Egyenleg</th>
            <th>Megjegyzés</th>
            <th style="width:60px;text-align:right;">Műveletek</th>
        </tr>
    </thead>
    <tbody id="admin-transactions-tbody"></tbody>
</table>`);

data = data.replace('<div id="flat-detail-ledger-tbody" class="modern-list"></div>',
`<table class="ledger-table">
    <thead>
        <tr>
            <th>Dátum</th>
            <th>Típus</th>
            <th>Összeg</th>
            <th>Egyenleg</th>
            <th>Megjegyzés</th>
            <th style="width:60px;text-align:right;">Műveletek</th>
        </tr>
    </thead>
    <tbody id="flat-detail-ledger-tbody"></tbody>
</table>`);

data = data.replace('<div id="fullscreen-tx-tbody" class="modern-list">\n                <!-- Populated by JS -->\n            </div>',
`<table class="ledger-table">
    <thead id="fullscreen-tx-thead-tr">
        <!-- Populated by JS -->
    </thead>
    <tbody id="fullscreen-tx-tbody">
        <!-- Populated by JS -->
    </tbody>
</table>`);

data = data.replace('class="app-main"', 'class="app-container"');
data = data.replace('style="max-width:860px;"', '');

fs.writeFileSync(path, data);
console.log("Restored tables in index.html");
