const html = require("fs").readFileSync("index.html", "utf8"); const rx = />Paso\s+(\d+)<\/span>\s*<h2[^>]*>(.*?)<\/h2>/g; let m; while(m = rx.exec(html)) console.log("Paso "+m[1]+": "+m[2]);
