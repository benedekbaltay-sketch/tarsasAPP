const fs = require('fs');

const html = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html', 'utf8');
const js = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js', 'utf8');

console.log('=== AUDIT OF REMAINING HUNGARIAN UI TEXTS ===');

// Check index.html for text inside tags without data-i18n
const tagRegex = /<([a-z1-6]+)([^>]*)>([^<]+)<\/\1>/gi;
let match;
const untranslatedHtml = [];

while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[1];
    const attrs = match[2];
    const text = match[3].trim();
    if (text && !attrs.includes('data-i18n') && !attrs.includes('id=') && text.length > 1 && !/^\d+$/.test(text) && text !== '-' && text !== '—' && text !== '€' && text !== 'Ft') {
        if (/[áéíóöőúüű]/i.test(text) || text.includes('Lakás') || text.includes('Kiadás') || text.includes('Befizetés') || text.includes('Mégse') || text.includes('Mentés')) {
            untranslatedHtml.push({ tag, text });
        }
    }
}

console.log('1. HTML untranslated Hungarian tags count:', untranslatedHtml.length);
untranslatedHtml.forEach(item => console.log(`   <${item.tag}>: "${item.text}"`));

// Check app.js for hardcoded Hungarian strings in innerHTML or textContent assignments
const jsLines = js.split('\n');
const untranslatedJs = [];

jsLines.forEach((line, index) => {
    if ((line.includes('innerHTML') || line.includes('textContent') || line.includes('badgeText') || line.includes('displayName') || line.includes('labelText')) && /[áéíóöőúüű]/i.test(line) && !line.includes('translateMethod') && !line.includes('translateCategory') && !line.includes('translations =')) {
        untranslatedJs.push({ lineNum: index + 1, code: line.trim() });
    }
});

console.log('2. JS dynamic rendering untranslated lines count:', untranslatedJs.length);
untranslatedJs.forEach(item => console.log(`   Line ${item.lineNum}: ${item.code}`));
