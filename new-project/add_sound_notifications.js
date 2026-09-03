const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const soundUtility = `
// Web Audio API Audio Notification Generator
window.playNotificationSound = function(type = 'success') {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        if (type === 'success') {
            // Pleasant double-chime (success/completion)
            const now = ctx.currentTime;
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, now); // C5
            osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
            
            gain1.gain.setValueAtTime(0.15, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            
            osc1.start(now);
            osc1.stop(now + 0.3);
            
            // Second chime
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(783.99, now + 0.12); // G5
            
            gain2.gain.setValueAtTime(0.15, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
            
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            
            osc2.start(now + 0.12);
            osc2.stop(now + 0.42);
        } else if (type === 'warning' || type === 'attention') {
            // Attention double-tone (intervention required / delete modal)
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now); // A4
            osc.frequency.setValueAtTime(330, now + 0.12); // E4
            
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(now);
            osc.stop(now + 0.35);
        }
    } catch (e) {
        // AudioContext may be blocked before first user interaction
    }
};
`;

if (!appJs.includes('playNotificationSound')) {
    appJs += '\n' + soundUtility;
}

// Add sound triggers to key actions
// 1. In confirmDeleteTx (when item deleted)
appJs = appJs.replace("saveStateToLocalStorage();\n    recalculateFlatBalances();", "saveStateToLocalStorage();\n    recalculateFlatBalances();\n    playNotificationSound('success');");

// 2. In deleteTransaction / deleteLedgerTransaction (when deletion prompt opens)
appJs = appJs.replace("document.getElementById('delete-tx-confirm-modal').style.display = 'flex';", "document.getElementById('delete-tx-confirm-modal').style.display = 'flex';\n    playNotificationSound('warning');");

// 3. In saveLedgerComment & saveInlineLedgerComment
appJs = appJs.replace("saveStateToLocalStorage();\n    document.getElementById('comment-edit-modal').style.display = 'none';", "saveStateToLocalStorage();\n    document.getElementById('comment-edit-modal').style.display = 'none';\n    playNotificationSound('success');");

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully added Web Audio notification sound utility to app.js");
