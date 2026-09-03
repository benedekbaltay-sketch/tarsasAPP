const fs = require('fs');
const code = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js', 'utf8');
const match = code.match(/const INITIAL_MOCK_DATA = ({[\s\S]*?});\s*let state =/);
if (match) {
    const mockData = eval('(' + match[1] + ')');
    console.log("Mock flats count:", mockData.flats.length);
    console.log("Mock transactions count:", mockData.transactions.length);
} else {
    console.log("Could not find INITIAL_MOCK_DATA");
}
