const fs = require('fs');
const content = fs.readFileSync('src/screens/HomeScreen.tsx', 'utf8');
const regex = /const \w+_SCRIPT = `([\s\S]*?)`;/g;
let match;
while ((match = regex.exec(content)) !== null) {
  try {
    new Function(match[1]);
    console.log("OK", match[0].substring(0, 30));
  } catch(e) {
    console.log("ERROR", match[0].substring(0, 30), e);
  }
}
