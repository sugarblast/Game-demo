// Inlines CSS + JS into a single self-contained index.html (no dependencies).
const fs = require('fs'), path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const js = ['data.js', 'news.js', 'sim.js', 'trophies.js', 'audio.js', 'map.js', 'ui.js'].map(rd).join('\n;\n');
if (js.includes('</script')) throw new Error('JS contains </script');
const html = rd('template.html').split('/*CSS*/').join(rd('style.css')).split('/*JS*/').join(js);
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html', (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB');
