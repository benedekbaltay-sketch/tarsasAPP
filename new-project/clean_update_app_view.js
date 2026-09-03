const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const cleanUpdateAppView = `function updateAppView() {
    try {
        window.scrollTo(0, 0);
        const loginView = document.getElementById("login-view");
        const tenantView = document.getElementById("tenant-view");
        const adminView = document.getElementById("admin-view");
        const profileBar = document.getElementById("user-profile-bar");
        
        if (!state.currentUser) {
            if (loginView) loginView.style.display = "flex";
            if (tenantView) tenantView.style.display = "none";
            if (adminView) adminView.style.display = "none";
            if (profileBar) profileBar.style.display = "none";
            applyTranslations();
            return;
        }
        
        if (loginView) loginView.style.display = "none";
        if (profileBar) profileBar.style.display = "flex";
        
        const isEn = (state.currentLang === "en");
        if (state.currentUser.role && state.currentUser.role.toLowerCase() === "admin") {
            document.getElementById("header-user-name").textContent = isEn ? "Representative" : "Közös Képviselő";
            document.getElementById("header-user-role").textContent = isEn ? "Property Management" : "Társasház képviselet";
        } else {
            document.getElementById("header-user-name").textContent = isEn ? \`Flat \${state.currentUser.flatNum}\` : \`\${state.currentUser.flatNum}. lakás\`;
            document.getElementById("header-user-role").textContent = isEn ? "Resident" : "Társasházi lakó";
        }
        
        applyTranslations();
        
        if (state.currentUser.role && state.currentUser.role.toLowerCase() === "admin") {
            if (tenantView) tenantView.style.display = "none";
            if (adminView) adminView.style.display = "flex";
            renderAdminDashboard();
        } else {
            if (tenantView) tenantView.style.display = "flex";
            if (adminView) adminView.style.display = "none";
            renderTenantDashboard();
        }
    } catch (err) {
        console.error("Error in updateAppView:", err);
        const loginView = document.getElementById("login-view");
        if (loginView) loginView.style.display = "flex";
    }
}`;

const uStart = appJs.indexOf("function updateAppView()");
const uEnd = appJs.indexOf("// 1. Render Tenant Dashboard");

if (uStart !== -1 && uEnd !== -1) {
    appJs = appJs.substring(0, uStart) + cleanUpdateAppView + "\n\n" + appJs.substring(uEnd);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Cleaned updateAppView function");
}
