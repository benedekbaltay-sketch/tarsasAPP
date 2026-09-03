const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const oldModalCode = `    const user = state.users.find(u => u.flatNum === flatNum && u.role === "Owner");
    const email = user ? user.email : "Nincs regisztrálva";
    
    const isEn = (state.currentLang === 'en');
    document.getElementById("flat-detail-title").textContent = isEn ? \`Flat \${flatNum} - Details\` : \`\${flatNum}. Lakás részletes adatlapja\`;
    document.getElementById("flat-detail-email").textContent = email;`;

const newModalCode = `    const isEn = (state.currentLang === 'en');
    const user = state.users.find(u => u.flatNum === flatNum);
    const ownerName = flat.ownerName || (user && user.name) || (isEn ? "Not provided" : "Nincs megadva");
    const email = (user && user.email && user.email !== flatNum) ? user.email : (isEn ? "Not registered" : "Nincs regisztrálva");
    const phone = (user && user.phone) ? user.phone : (isEn ? "Not provided" : "Nincs megadva");
    
    document.getElementById("flat-detail-title").textContent = isEn ? \`Flat \${flatNum} - Details\` : \`\${flatNum}. Lakás részletes adatlapja\`;
    document.getElementById("flat-detail-email").textContent = email;`;

appJs = appJs.replace(oldModalCode, newModalCode);

// Also replace read-only view population in openFlatDetailModal
const oldRoView = `    // Populate read-only view
    document.getElementById("ro-flat-owner").textContent = user ? user.name : "Nincs";
    document.getElementById("ro-flat-ownership").textContent = (flat.ownershipShare || 0) + "%";
    document.getElementById("ro-flat-tenant-count").textContent = flat.tenantCount || 1;
    document.getElementById("ro-flat-phone").textContent = user && user.phone ? user.phone : "Nincs megadva";`;

const newRoView = `    // Populate read-only view
    document.getElementById("ro-flat-owner").textContent = ownerName;
    document.getElementById("ro-flat-ownership").textContent = (flat.ownershipShare || 0) + "%";
    document.getElementById("ro-flat-tenant-count").textContent = flat.tenantCount || 1;
    document.getElementById("ro-flat-phone").textContent = phone;`;

appJs = appJs.replace(oldRoView, newRoView);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully updated email, phone and owner defaults with i18n!");
