const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const targetToggle = `    if (showEdit) {
        roView.style.display = "none";
        editForm.style.display = "flex";
        editBtn.style.display = "none";
    } else {
        roView.style.display = "flex";
        editForm.style.display = "none";
        editBtn.style.display = "inline-flex";
    }`;

const replaceToggle = `    if (showEdit) {
        roView.style.display = "none";
        editForm.style.display = "flex";
        editBtn.style.display = "none";
        
        document.querySelectorAll('.ro-stat-item').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.edit-stat-item').forEach(el => el.style.display = (el.tagName === 'INPUT' ? 'block' : 'flex'));
        
        // Populate inputs
        const flatNum = document.getElementById("flat-detail-flatnum-hidden").value;
        const flat = state.flats.find(f => f.flatNum === flatNum);
        if (flat) {
            document.getElementById("flat-edit-balance-a").value = flat.balance || 0;
            document.getElementById("flat-edit-balance-b").value = flat.renovationBalance || 0;
            
            const feeA = document.getElementById("flat-edit-fee-a");
            feeA.value = flat.monthlyFee || 0;
            feeA.dataset.original = flat.monthlyFee || 0;
            document.getElementById("flat-edit-fee-date-a").value = "";
            document.getElementById("flat-edit-fee-date-container-a").style.display = "none";
            
            const feeB = document.getElementById("flat-edit-fee-b");
            feeB.value = flat.renovationFee || 0;
            feeB.dataset.original = flat.renovationFee || 0;
            document.getElementById("flat-edit-fee-date-b").value = "";
            document.getElementById("flat-edit-fee-date-container-b").style.display = "none";
        }
    } else {
        roView.style.display = "flex"; // Restore original grid layout for roView
        editForm.style.display = "none";
        editBtn.style.display = "inline-flex";
        
        document.querySelectorAll('.ro-stat-item').forEach(el => el.style.display = ''); // Restore default display
        document.querySelectorAll('.edit-stat-item').forEach(el => el.style.display = 'none');
    }`;

if (appJs.includes(targetToggle)) {
    appJs = appJs.replace(targetToggle, replaceToggle);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Updated toggleFlatEditMode successfully.");
} else {
    console.log("Failed to find targetToggle.");
}
