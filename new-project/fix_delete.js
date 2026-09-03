const fs = require('fs');

// 1. Modify index.html
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Replace the form buttons
const oldFormButtons = `<div style="display:flex;justify-content:flex-end;gap:8px;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="toggleFlatEditMode(false)">
                        Mcgse
                    </button>
                    <button type="submit" class="btn btn-primary btn-sm">
                        <i data-lucide="save" style="width:14px;height:14px;"></i> Adatok mentcse
                    </button>
                </div>`;
// regex match avoiding encoding issues
const regexFormButtons = /<div style="display:flex;justify-content:flex-end;gap:8px;">[\s\S]*?Adatok ment.*?<\/button>\s*<\/div>/;

const newFormButtons = `<div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
                    <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger-light);" onclick="openDeleteModal(document.getElementById('flat-detail-flatnum-hidden').value)">
                        <i data-lucide="trash-2" style="width:14px;height:14px;"></i> Lakás törlése
                    </button>
                    <div style="display:flex;gap:8px;">
                        <button type="button" class="btn btn-outline btn-sm" onclick="toggleFlatEditMode(false)">
                            Mégse
                        </button>
                        <button type="submit" class="btn btn-primary btn-sm">
                            <i data-lucide="save" style="width:14px;height:14px;"></i> Mentés
                        </button>
                    </div>
                </div>`;

indexHtml = indexHtml.replace(regexFormButtons, newFormButtons);
indexHtml = indexHtml.replace('<script src="app.js?v=29"></script>', '<script src="app.js?v=30"></script>');
fs.writeFileSync(indexPath, indexHtml, 'utf8');

// 2. Modify app.js
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const regexDelBtn = /<button class="btn btn-outline btn-sm" style="color:var\(--danger\);border-color:var\(--danger-light\);" onclick="event\.stopPropagation\(\); openDeleteModal\('\$\{flat\.flatNum\}'\)">[\s\S]*?<\/button>/;
const newEditBtn = `<button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openFlatDetailModal('\${flat.flatNum}'); setTimeout(() => toggleFlatEditMode(true), 100);">
                    <i data-lucide="pencil" style="width:12px;height:12px;"></i> Szerkesztés
                </button>`;

appJs = appJs.replace(regexDelBtn, newEditBtn);
fs.writeFileSync(appPath, appJs, 'utf8');

console.log("Updated flat edit/delete logic");
