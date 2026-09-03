const fs = require('fs');

// 1. REVERT index.html form buttons and UPDATE Admin dashboard header
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Revert flat-fee-edit-form buttons
const badFormButtons = /<div style="display:flex;justify-content:space-between;align-items:center;width:100%;">[\s\S]*?Lakás törlése[\s\S]*?<\/button>\s*<\/div>\s*<\/div>/;
const origFormButtons = `<div style="display:flex;justify-content:flex-end;gap:8px;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="toggleFlatEditMode(false)">
                        Mégse
                    </button>
                    <button type="submit" class="btn btn-primary btn-sm">
                        <i data-lucide="save" style="width:14px;height:14px;"></i> Adatok mentése
                    </button>
                </div>`;
indexHtml = indexHtml.replace(badFormButtons, origFormButtons);

// Replace Admin dashboard header buttons
const oldAdminHeaderBtns = /<button class="btn btn-outline btn-sm" onclick="openAddTransactionModal\(\)">[\s\S]*?<\/button>\s*<button class="btn btn-success btn-sm" onclick="openAddFlatModal\(\)">[\s\S]*?<\/button>/;
const newAdminHeaderBtns = `<button class="btn btn-outline btn-sm" onclick="openAddTransactionModal()">
                                <i data-lucide="plus" style="width:14px;height:14px;"></i> <span data-i18n="admin_add_transaction">Új tranzakció</span>
                            </button>
                            <button id="grid-add-flat-btn" class="btn btn-success btn-sm" onclick="openAddFlatModal()" style="display:none;">
                                <i data-lucide="home" style="width:14px;height:14px;"></i> <span>Új lakás</span>
                            </button>
                            <button id="grid-edit-btn" class="btn btn-outline btn-sm" onclick="toggleGridEditMode()">
                                <i data-lucide="pencil" style="width:14px;height:14px;"></i> <span>Szerkesztés</span>
                            </button>`;
indexHtml = indexHtml.replace(oldAdminHeaderBtns, newAdminHeaderBtns);

indexHtml = indexHtml.replace('<script src="app.js?v=30"></script>', '<script src="app.js?v=31"></script>');
fs.writeFileSync(indexPath, indexHtml, 'utf8');

// 2. Modify app.js
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Ensure state.isGridEditMode exists
if (!appJs.includes('isGridEditMode:')) {
    appJs = appJs.replace(/currentLang: "hu"/, 'currentLang: "hu",\n    isGridEditMode: false');
}

// Add toggleGridEditMode function
const toggleFunc = `
window.toggleGridEditMode = function() {
    state.isGridEditMode = !state.isGridEditMode;
    const editBtn = document.getElementById("grid-edit-btn");
    const addBtn = document.getElementById("grid-add-flat-btn");
    
    if (state.isGridEditMode) {
        editBtn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;"></i> <span>Kész</span>';
        addBtn.style.display = "inline-flex";
    } else {
        editBtn.innerHTML = '<i data-lucide="pencil" style="width:14px;height:14px;"></i> <span>Szerkesztés</span>';
        addBtn.style.display = "none";
    }
    renderArrearsMatrix();
};
`;
if (!appJs.includes('window.toggleGridEditMode')) {
    appJs = appJs + '\n' + toggleFunc;
}

// Revert renderArrearsMatrix card button and conditionally render
const oldCardRegex = /<div class="flat-tile-actions">[\s\S]*?<button class="btn btn-outline btn-sm" onclick="event\.stopPropagation\(\); openFlatDetailModal\('\$\{flat\.flatNum\}'\); setTimeout\(\(\) => toggleFlatEditMode\(true\), 100\);">[\s\S]*?Szerkesztés[\s\S]*?<\/button>\s*<\/div>/;

const newCardActions = `\${state.isGridEditMode ? \`
            <div class="flat-tile-actions">
                <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger-light);" onclick="event.stopPropagation(); openDeleteModal('\${flat.flatNum}')">
                    <i data-lucide="trash-2" style="width:12px;height:12px;"></i> \${delText}
                </button>
            </div>\` : ''}`;

appJs = appJs.replace(oldCardRegex, newCardActions);

// Make sure that renderArrearsMatrix reset the button state if called on its own? No, the button is toggled.

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Applied grid edit mode logic");
