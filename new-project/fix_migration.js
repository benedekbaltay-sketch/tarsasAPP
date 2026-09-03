const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const targetMigration = `window.addEventListener("DOMContentLoaded", () => {`;
const replaceMigration = `window.addEventListener("DOMContentLoaded", () => {
    // Migrate old balance corrections to type "Correction"
    if (state.transactions) {
        state.transactions.forEach(tx => {
            if (tx.method === "Egyenleg korrekció" && tx.type === "Credit") {
                tx.type = "Correction";
            }
        });
    }
`;

if (appJs.includes(targetMigration)) {
    appJs = appJs.replace(targetMigration, replaceMigration);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Added migration for existing correction transactions.");
} else {
    console.log("Failed to find DOMContentLoaded.");
}
