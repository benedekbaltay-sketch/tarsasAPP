const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const missingUsers = `    users: [
        { id: "admin", name: "Nagy Elemér", email: "admin@batyu21.hu", role: "admin", flatNum: "0" },
        { id: "Fsz 1", name: "Ivánné Mód Ágnes", email: "mod.agnes@gmail.com", role: "tenant", flatNum: "Fsz 1" },
        { id: "Fsz 2", name: "Baltay Zsombor Ferenc", email: "zsombor.baltay@example.com", role: "tenant", flatNum: "Fsz 2" },
        { id: "Fsz 3", name: "Bódi Anikó", email: "bodi.aniko@example.com", role: "tenant", flatNum: "Fsz 3" },
        { id: "I 4", name: "Hóman Józsefné", email: "homan.jozsefne@example.com", role: "tenant", flatNum: "I 4" },
        { id: "I 5", name: "Iván Noémi", email: "ivan.noemi@example.com", role: "tenant", flatNum: "I 5" },
        { id: "I 6", name: "Citi Apartman", email: "citi.apartman@example.com", role: "tenant", flatNum: "I 6" },
        { id: "II 7-8", name: "Dr. Cser László Gusztáv", email: "cser.laszlo@example.com", role: "tenant", flatNum: "II 7-8" },
        { id: "II 9", name: "Dr. Forrai Anna", email: "forrai.anna@example.com", role: "tenant", flatNum: "II 9" }
    ],`;

if (!appJs.includes('users: [')) {
    appJs = appJs.replace('flats: [', missingUsers + '\n    flats: [');
}

// Add INITIAL_MOCK_DATA back to the end of the file or before resetStateToDefaults
if (!appJs.includes('const INITIAL_MOCK_DATA')) {
    const mockDataStr = `
const INITIAL_MOCK_DATA = JSON.parse(JSON.stringify(state));
`;
    appJs = appJs.replace('function resetStateToDefaults() {', mockDataStr + '\nfunction resetStateToDefaults() {');
}

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Fixed missing users array and INITIAL_MOCK_DATA!");
