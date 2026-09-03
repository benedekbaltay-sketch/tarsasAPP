const fs = require('fs');

global.window = global;
global.window.addEventListener = () => {};
global.window.scrollTo = () => {};
global.document = {
    querySelectorAll: () => [],
    getElementById: (id) => ({
        style: {},
        value: '',
        dataset: {},
        addEventListener: () => {},
        appendChild: () => {},
        innerHTML: '',
        textContent: ''
    }),
    createElement: () => ({ style: {}, appendChild: () => {}, setAttribute: () => {} }),
    addEventListener: () => {}
};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.lucide = { createIcons: () => {} };

const js = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js', 'utf8');

eval(js.replace('let state = {', 'window.state = {'));

window.state.users.forEach(u => {
    try {
        console.log('Testing quickLogin for user:', u.id || u.email, 'flatNum:', u.flatNum);
        quickLogin(u.flatNum || u.id || 'admin');
        console.log('  -> Success! Rendered view for:', window.state.currentUser.role);
    } catch (e) {
        console.error('  -> FAILED for user:', u.id || u.email, e);
    }
});
