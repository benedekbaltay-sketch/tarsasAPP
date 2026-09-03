const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let data = fs.readFileSync(indexPath, 'utf8');

// Ensure correct UTF-8 text for the header
data = data.replace(/<h1.*?>.*?<\/h1>/, '<h1>Közös Költség Nyilvántartó</h1>');
data = data.replace(/<span class="building-address">.*?<\/span>/, '<span class="building-address">Batyu utca 21. - Társasház</span>');
data = data.replace(/<span class="user-role-badge".*?<\/span>/, '<span class="user-role-badge" id="header-user-role" data-i18n="role">Szerepkör</span>');
data = data.replace(/<span class="user-name".*?<\/span>/, '<span class="user-name" id="header-user-name">Felhasználó</span>');

// Force the flags instead of weird characters
data = data.replace(/<button id="lang-toggle-btn"[\s\S]*?>[\s\S]*?<\/button>/, `<button id="lang-toggle-btn" class="btn btn-outline btn-sm btn-icon-only" style="font-size: 18px; line-height: 1; padding: 4px; border: none;" onclick="toggleLanguage()">
                🇭🇺
            </button>`);

// Fix any other known text that might have been corrupted
data = data.replace(/Adatok Vissza.*?t.sa/g, 'Adatok Visszaállítása');
data = data.replace(/Kijelentkez.s/g, 'Kijelentkezés');
data = data.replace(/Minden tranzakci.*?s kiad.*?s teljes list.*?ja/g, 'Minden tranzakció és kiadás teljes listája');
data = data.replace(/.sszes tranzakci./g, 'Összes tranzakció');

data = data.replace('<script src="app.js?v=19"></script>', '<script src="app.js?v=20"></script>');

fs.writeFileSync(indexPath, data, 'utf8');
console.log("Fixed texts and bumped version to 20");
