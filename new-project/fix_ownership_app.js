const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// 1. Add ownershipShare to state.flats
const flatsRegex = /flats: \[\s*\{ flatNum: "Fsz 1"/;
const newFlats = `flats: [
        { flatNum: "Fsz 1", monthlyFee: 26038, renovationFee: 5126, tenantCount: 2, ownershipShare: 12.46, balance: 0, renovationBalance: 0 },
        { flatNum: "Fsz 2", monthlyFee: 18348, renovationFee: 3612, tenantCount: 1, ownershipShare: 8.78, balance: 0, renovationBalance: 0 },
        { flatNum: "Fsz 3", monthlyFee: 21379, renovationFee: 4209, tenantCount: 2, ownershipShare: 10.23, balance: 0, renovationBalance: 0 },
        { flatNum: "I 4", monthlyFee: 30721, renovationFee: 5304, tenantCount: 1, ownershipShare: 12.89, balance: 0, renovationBalance: 0 },
        { flatNum: "I 5", monthlyFee: 20687, renovationFee: 3571, tenantCount: 2, ownershipShare: 8.68, balance: 0, renovationBalance: 0 },
        { flatNum: "I 6", monthlyFee: 27670, renovationFee: 4777, tenantCount: 2, ownershipShare: 11.61, balance: 0, renovationBalance: 0 },
        { flatNum: "II 7-8", monthlyFee: 55579, renovationFee: 9594, tenantCount: 1, ownershipShare: 23.32, balance: 0, renovationBalance: 0 },
        { flatNum: "II 9", monthlyFee: 25161, renovationFee: 4954, tenantCount: 3, ownershipShare: 12.04, balance: 0, renovationBalance: 0 }
    ],`;

// To accurately replace the flats array, let's find the start and end of it
const startFlats = 'flats: [';
const endFlats = '    ],';
const startIndex = appJs.indexOf(startFlats);
const endIndex = appJs.indexOf(endFlats, startIndex) + endFlats.length;

if (startIndex !== -1 && endIndex !== -1) {
    appJs = appJs.substring(0, startIndex) + newFlats.substring(0, newFlats.length - 1) + appJs.substring(endIndex);
}

// 2. Add to openFlatDetailModal
const roTenant = 'document.getElementById("ro-flat-tenant-count").textContent = flat.tenantCount || 1;';
const newRoTenant = `document.getElementById("ro-flat-ownership").textContent = (flat.ownershipShare || 0) + "%";\n    ` + roTenant;
appJs = appJs.replace(roTenant, newRoTenant);

const editTenant = 'document.getElementById("flat-tenant-input").value = flat.tenantCount || 1;';
const newEditTenant = `document.getElementById("flat-ownership-input").value = flat.ownershipShare || 0;\n    ` + editTenant;
appJs = appJs.replace(editTenant, newEditTenant);

// 3. Add to Form Submit Handler
const saveTenant = 'const newTenantCount = parseInt(document.getElementById("flat-tenant-input").value) || 1;';
const newSaveTenant = `const newOwnershipShare = parseFloat(document.getElementById("flat-ownership-input").value) || 0;\n    ` + saveTenant;
appJs = appJs.replace(saveTenant, newSaveTenant);

const assignTenant = 'flat.tenantCount = newTenantCount;';
const newAssignTenant = `flat.ownershipShare = newOwnershipShare;\n    ` + assignTenant;
appJs = appJs.replace(assignTenant, newAssignTenant);

// 4. Add to add-flat-form submit handler
const addFlatParse = 'const renovationFee = parseInt(document.getElementById("new-flat-renovation").value, 10);';
const addFlatParseNew = addFlatParse + `\n    const ownershipShare = parseFloat(document.getElementById("new-flat-ownership").value) || 0;`;
appJs = appJs.replace(addFlatParse, addFlatParseNew);

const addFlatPush = 'flatNum, monthlyFee, renovationFee, tenantCount, balance: 0, renovationBalance: 0';
const newAddFlatPush = 'flatNum, monthlyFee, renovationFee, tenantCount, ownershipShare, balance: 0, renovationBalance: 0';
appJs = appJs.replace(addFlatPush, newAddFlatPush);

// 5. Update createFlatCard to show ownership share
const cardTenant = '<i data-lucide="users" style="width:12px;height:12px;"></i> ${flat.tenantCount} f\'</div>';
const newCardTenant = '<i data-lucide="pie-chart" style="width:12px;height:12px;"></i> ${flat.ownershipShare || 0}% | <i data-lucide="users" style="width:12px;height:12px;"></i> ${flat.tenantCount} f\'</div>';
appJs = appJs.replace(cardTenant, newCardTenant);
// Some files have different encodings for ő
const cardTenant2 = '<i data-lucide="users" style="width:12px;height:12px;"></i> ${flat.tenantCount} fő</div>';
const newCardTenant2 = '<i data-lucide="pie-chart" style="width:12px;height:12px;"></i> ${flat.ownershipShare || 0}% | <i data-lucide="users" style="width:12px;height:12px;"></i> ${flat.tenantCount} fő</div>';
appJs = appJs.replace(cardTenant2, newCardTenant2);

// Make sure to add default if not present
appJs = appJs.replace(
    'if (!appJs.includes(\'flatViewAll:\')) {', 
    'if (!appJs.includes(\'ownershipShare\')) { state.flats[0].ownershipShare = 12.46; state.flats[1].ownershipShare = 8.78; state.flats[2].ownershipShare = 10.23; state.flats[3].ownershipShare = 12.89; state.flats[4].ownershipShare = 8.68; state.flats[5].ownershipShare = 11.61; state.flats[6].ownershipShare = 23.32; state.flats[7].ownershipShare = 12.04; }\n    if (!appJs.includes(\'flatViewAll:\')) {'
);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Updated app.js");
