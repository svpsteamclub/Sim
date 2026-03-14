const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const searchStr = '<div class="editor-help"';
const closingBracket = html.indexOf('>', html.indexOf(searchStr));
if (closingBracket !== -1) {
    const toReplace = html.substring(html.indexOf(searchStr), closingBracket + 1);
    console.log("Replacing:", toReplace);
    html = html.replace(toReplace, '<div class="editor-help max-w-5xl mx-auto w-full">');
    fs.writeFileSync('index.html', html);
    console.log("Done");
}
