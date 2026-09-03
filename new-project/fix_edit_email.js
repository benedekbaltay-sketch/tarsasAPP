const fs = require('fs');

// 1. Update index.html
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let html = fs.readFileSync(indexPath, 'utf8');

const targetHtml = `<div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-phone-input">Telefonszám</label>
                        <input id="flat-phone-input" type="text" class="form-input" placeholder="pl. +36 30 123 4567" />
                    </div>`;
const injectHtml = targetHtml + `
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-email-input">E-mail cím</label>
                        <input id="flat-email-input" type="email" class="form-input" placeholder="pl. pelda@email.com" />
                    </div>`;

if (!html.includes('id="flat-email-input"')) {
    html = html.replace(targetHtml, injectHtml);
    fs.writeFileSync(indexPath, html, 'utf8');
    console.log("Updated index.html");
}

// 2. Update app.js
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Update toggleFlatEditMode
const targetJs1 = `        const user = state.users.find(u => u.flatNum === flatNum && u.role === "Owner");
        document.getElementById("flat-phone-input").value = (user && user.phone) ? user.phone : "";`;
const replaceJs1 = `        const user = state.users.find(u => u.flatNum === flatNum && u.role !== "admin");
        document.getElementById("flat-phone-input").value = (user && user.phone) ? user.phone : "";
        document.getElementById("flat-email-input").value = (user && user.email) ? user.email : "";`;

// Update form submit
const targetJs2 = `    const newOwnerName = document.getElementById("flat-owner-input").value.trim();
    const newPhone = document.getElementById("flat-phone-input").value.trim();`;
const replaceJs2 = `    const newOwnerName = document.getElementById("flat-owner-input").value.trim();
    const newPhone = document.getElementById("flat-phone-input").value.trim();
    const newEmail = document.getElementById("flat-email-input").value.trim();`;

// Update saving user
const targetJs3 = `    const user = state.users.find(u => u.flatNum === flatNum && u.role === "Owner");
    if (user) {
        user.name = newOwnerName;
        user.phone = newPhone;
    } else {
        state.users.push({
            id: 'u-' + Date.now(),
            flatNum: flat.flatNum,
            name: newOwnerName,
            phone: newPhone,
            role: "Owner"
        });
    }`;
const replaceJs3 = `    const user = state.users.find(u => u.flatNum === flatNum && u.role !== "admin");
    if (user) {
        user.name = newOwnerName;
        user.phone = newPhone;
        user.email = newEmail;
    } else {
        state.users.push({
            id: 'u-' + Date.now(),
            flatNum: flat.flatNum,
            name: newOwnerName,
            phone: newPhone,
            email: newEmail,
            role: "tenant"
        });
    }`;

if (!appJs.includes('flat-email-input')) {
    appJs = appJs.replace(targetJs1, replaceJs1);
    appJs = appJs.replace(targetJs2, replaceJs2);
    appJs = appJs.replace(targetJs3, replaceJs3);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Updated app.js");
}
