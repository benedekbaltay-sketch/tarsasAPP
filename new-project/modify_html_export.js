const fs = require('fs');
const htmlPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Add SheetJS script
if (!html.includes('xlsx.full.min.js')) {
    html = html.replace('</head>', '    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>\n</head>');
}

// 2. Add comment field to edit modal
const targetComment = `                  <div class="form-group">
                      <label for="edit-tx-date">Dátum</label>`;
const replaceComment = `                  <div class="form-group" id="edit-comment-group">
                      <label for="edit-tx-comment">Megjegyzés</label>
                      <input id="edit-tx-comment" type="text" class="form-input" />
                  </div>
                  
                  <div class="form-group">
                      <label for="edit-tx-date">Dátum</label>`;
if (html.includes(targetComment)) {
    html = html.replace(targetComment, replaceComment);
} else {
    // try fallback with utf-8 encoding issue
    const targetComment2 = `                  <div class="form-group">
                      <label for="edit-tx-date">Dtum</label>`;
    const replaceComment2 = `                  <div class="form-group" id="edit-comment-group">
                      <label for="edit-tx-comment">Megjegyzés</label>
                      <input id="edit-tx-comment" type="text" class="form-input" />
                  </div>
                  
                  <div class="form-group">
                      <label for="edit-tx-date">Dátum</label>`;
    if (html.includes(targetComment2)) {
        html = html.replace(targetComment2, replaceComment2);
    }
}

// 3. Add Export Buttons to Admin Matrix
const targetMatrixTitle = `<h3 data-i18n="admin_arrears_title">Lakások és Egyenlegek</h3>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="openAddFlatModal()">
                            <i data-lucide="plus"></i> Új lakás
                        </button>`;
const replaceMatrixTitle = `<h3 data-i18n="admin_arrears_title">Lakások és Egyenlegek</h3>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button class="btn btn-outline btn-sm" onclick="exportFlatsToExcel()">
                                <i data-lucide="download"></i> Export
                            </button>
                            <button class="btn btn-primary btn-sm" onclick="openAddFlatModal()">
                                <i data-lucide="plus"></i> Új lakás
                            </button>
                        </div>`;
if (html.includes(targetMatrixTitle)) {
    html = html.replace(targetMatrixTitle, replaceMatrixTitle);
} else {
    const targetMatrixTitle2 = `<h3 data-i18n="admin_arrears_title">Laksok cs Egyenlegek</h3>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="openAddFlatModal()">
                            <i data-lucide="plus"></i> s"j laks
                        </button>`;
    const replaceMatrixTitle2 = `<h3 data-i18n="admin_arrears_title">Lakások és Egyenlegek</h3>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button class="btn btn-outline btn-sm" onclick="exportFlatsToExcel()">
                                <i data-lucide="download"></i> Export
                            </button>
                            <button class="btn btn-primary btn-sm" onclick="openAddFlatModal()">
                                <i data-lucide="plus"></i> Új lakás
                            </button>
                        </div>`;
    if (html.includes(targetMatrixTitle2)) {
        html = html.replace(targetMatrixTitle2, replaceMatrixTitle2);
    }
}

// 4. Add Export Buttons to Admin Transactions
const targetAdminTxTitle = `<h3>Minden tranzakció és kiadás</h3>
                    </div>
                    <div style="display:flex; gap:16px; align-items:center;">`;
const replaceAdminTxTitle = `<h3>Minden tranzakció és kiadás</h3>
                    </div>
                    <div style="display:flex; gap:16px; align-items:center;">
                        <button class="btn btn-outline btn-sm" onclick="exportTransactionsToExcel()">
                            <i data-lucide="download"></i> Export
                        </button>`;
if (html.includes(targetAdminTxTitle)) {
    html = html.replace(targetAdminTxTitle, replaceAdminTxTitle);
} else {
    const targetAdminTxTitle2 = `<h3>Minden tranzakciƈ cs kiads</h3>
                    </div>
                    <div style="display:flex; gap:16px; align-items:center;">`;
    const replaceAdminTxTitle2 = `<h3>Minden tranzakció és kiadás</h3>
                    </div>
                    <div style="display:flex; gap:16px; align-items:center;">
                        <button class="btn btn-outline btn-sm" onclick="exportTransactionsToExcel()">
                            <i data-lucide="download"></i> Export
                        </button>`;
    if (html.includes(targetAdminTxTitle2)) {
        html = html.replace(targetAdminTxTitle2, replaceAdminTxTitle2);
    }
}

// 5. Add Export Buttons to Tenant A
const targetTenantATitle = `<h3>Közös Költség – Egyenleg és tranzakciók</h3>
                    </div>
                </div>`;
const replaceTenantATitle = `<h3>Közös Költség – Egyenleg és tranzakciók</h3>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="exportFlatLedgerToExcel('A')">
                        <i data-lucide="download"></i> Export
                    </button>
                </div>`;
if (html.includes(targetTenantATitle)) {
    html = html.replace(targetTenantATitle, replaceTenantATitle);
} else {
    const targetTenantATitle2 = `<h3>K z s K ltscg ?" Egyenleg cs tranzakciƈk</h3>
                    </div>
                </div>`;
    const replaceTenantATitle2 = `<h3>Közös Költség – Egyenleg és tranzakciók</h3>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="exportFlatLedgerToExcel('A')">
                        <i data-lucide="download"></i> Export
                    </button>
                </div>`;
    if (html.includes(targetTenantATitle2)) {
        html = html.replace(targetTenantATitle2, replaceTenantATitle2);
    }
}

// 6. Add Export Buttons to Tenant B
const targetTenantBTitle = `<h3>Felújítási Alap – Egyenleg és tranzakciók</h3>
                    </div>
                </div>`;
const replaceTenantBTitle = `<h3>Felújítási Alap – Egyenleg és tranzakciók</h3>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="exportFlatLedgerToExcel('B')">
                        <i data-lucide="download"></i> Export
                    </button>
                </div>`;
if (html.includes(targetTenantBTitle)) {
    html = html.replace(targetTenantBTitle, replaceTenantBTitle);
} else {
    const targetTenantBTitle2 = `<h3>Felƭjtsi Alap ?" Egyenleg cs tranzakciƈk</h3>
                    </div>
                </div>`;
    const replaceTenantBTitle2 = `<h3>Felújítási Alap – Egyenleg és tranzakciók</h3>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="exportFlatLedgerToExcel('B')">
                        <i data-lucide="download"></i> Export
                    </button>
                </div>`;
    if (html.includes(targetTenantBTitle2)) {
        html = html.replace(targetTenantBTitle2, replaceTenantBTitle2);
    }
}

// 7. Add Export to Admin Flat Detail Modal
const targetFlatDetailTitle = `              <h3 id="fullscreen-tx-title">Tétel elózmény</h3>
          </div>
          <div class="modal-body" style="padding:0;">`;
const replaceFlatDetailTitle = `              <h3 id="fullscreen-tx-title">Tétel elózmény</h3>
              <button class="btn btn-outline btn-sm" onclick="exportFlatDetailToExcel()" style="margin-left:auto;margin-right:16px;">
                  <i data-lucide="download"></i> Export
              </button>
          </div>
          <div class="modal-body" style="padding:0;">`;
if (html.includes(targetFlatDetailTitle)) {
    html = html.replace(targetFlatDetailTitle, replaceFlatDetailTitle);
} else {
    const targetFlatDetailTitle2 = `              <h3 id="fullscreen-tx-title">Tctel elƈzmcny</h3>
          </div>
          <div class="modal-body" style="padding:0;">`;
    const replaceFlatDetailTitle2 = `              <h3 id="fullscreen-tx-title">Tétel előzmény</h3>
              <button class="btn btn-outline btn-sm" onclick="exportFlatDetailToExcel()" style="margin-left:auto;margin-right:16px;">
                  <i data-lucide="download"></i> Export
              </button>
          </div>
          <div class="modal-body" style="padding:0;">`;
    if (html.includes(targetFlatDetailTitle2)) {
        html = html.replace(targetFlatDetailTitle2, replaceFlatDetailTitle2);
    }
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log("Updated HTML with Export buttons and comment input.");
