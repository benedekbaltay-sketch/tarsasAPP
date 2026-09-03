const fs = require('fs');

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Replace the buttons by targeting the parent container or more flexible regex
const regex = /<button class="btn btn-primary btn-sm" onclick="openAddTransactionModal\(\)">[\s\S]*?<\/button>\s*<button class="btn btn-success btn-sm" onclick="openAddFlatModal\(\)">[\s\S]*?<\/button>/;

const replacement = `<button class="btn btn-primary btn-sm" onclick="openAddTransactionModal()">
                                <i data-lucide="plus" style="width:14px;height:14px;"></i> <span data-i18n="admin_add_transaction">Tranzakció rögzítése</span>
                            </button>
                            <button id="grid-add-flat-btn" class="btn btn-success btn-sm" onclick="openAddFlatModal()" style="display:none;">
                                <i data-lucide="home" style="width:14px;height:14px;"></i> <span data-i18n="admin_add_flat">Új lakás</span>
                            </button>
                            <button id="grid-edit-btn" class="btn btn-outline btn-sm" onclick="toggleGridEditMode()">
                                <i data-lucide="pencil" style="width:14px;height:14px;"></i> <span>Szerkesztés</span>
                            </button>`;

if (regex.test(indexHtml)) {
    indexHtml = indexHtml.replace(regex, replacement);
    // ensure version bump
    indexHtml = indexHtml.replace('<script src="app.js?v=31"></script>', '<script src="app.js?v=32"></script>');
    fs.writeFileSync(indexPath, indexHtml, 'utf8');
    console.log("Successfully replaced buttons!");
} else {
    console.log("Regex did NOT match!");
}
