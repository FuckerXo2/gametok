const fs = require('fs');
const acorn = require('acorn');
const content = fs.readFileSync('src/screens/HomeScreen.tsx', 'utf8');
const scriptRegex = /= `([\s\S]*?)`;/g;
let match;
while ((match = scriptRegex.exec(content)) !== null) {
    try {
        acorn.parse(match[1], { ecmaVersion: 2020 });
    } catch (e) {
        console.log("Syntax Error around char", match.index);
        console.log("Error:", e.message);
        const scriptLines = match[1].split('\n');
        console.log("Line:", e.loc.line, "->", scriptLines[e.loc.line - 1]);
    }
}
