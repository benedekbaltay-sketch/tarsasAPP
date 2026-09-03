const fs = require('fs');

const mockEnv = `
const window = {
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
};
const document = {
    getElementById: (id) => ({
        addEventListener: () => {},
        style: {},
        classList: { toggle: () => {}, add: () => {}, remove: () => {} }
    }),
    addEventListener: () => {}
};
const localStorage = {
    getItem: () => null,
    setItem: () => {}
};
`;

const appJs = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js', 'utf8');

try {
    const fn = new Function('window', 'document', 'localStorage', appJs);
    fn(mockEnv.window, mockEnv.document, mockEnv.localStorage);
    console.log("Initialization successful!");
} catch (e) {
    console.error("INITIALIZATION ERROR:", e);
}
