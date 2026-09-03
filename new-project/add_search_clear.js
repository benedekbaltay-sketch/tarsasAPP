const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const searchClearHelpers = `
// Search Input Clear Helpers
window.toggleSearchClear = function(inputId, clearBtnId) {
    const input = document.getElementById(inputId);
    const clearBtn = document.getElementById(clearBtnId);
    if (input && clearBtn) {
        clearBtn.style.display = input.value.length > 0 ? "inline-flex" : "none";
        if (window.lucide) lucide.createIcons();
    }
};

window.clearSearchInput = function(inputId, clearBtnId, callback) {
    const input = document.getElementById(inputId);
    const clearBtn = document.getElementById(clearBtnId);
    if (input) {
        input.value = "";
        if (clearBtn) clearBtn.style.display = "none";
        if (typeof callback === "function") callback();
        input.focus();
    }
};
`;

if (!appJs.includes('window.toggleSearchClear')) {
    appJs += '\n' + searchClearHelpers;
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Successfully added search clear helpers to app.js");
} else {
    console.log("searchClearHelpers already exists");
}
