const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<div class="sticky top-10">/g, '<div class="sticky top-[100px] md:top-[120px] z-[5]">');
fs.writeFileSync('index.html', html);
console.log('Done replacement');