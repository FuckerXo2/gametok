const fs = require('fs');
let code = fs.readFileSync('src/screens/CreateScreen.tsx', 'utf8');

if (!code.includes("import * as FileSystem from 'expo-file-system';") && !code.includes('import * as FileSystem from "expo-file-system";')) {
  code = code.replace(/import \* as ImagePicker from ["']expo-image-picker["'];/, "import * as ImagePicker from 'expo-image-picker';\nimport * as FileSystem from 'expo-file-system';");
}

if (!code.includes("const [localHtmlUri, setLocalHtmlUri]")) {
  code = code.replace(
    /const \[activeHtml, setActiveHtml\] = useState<string \| null>\(null\);/,
    "const [activeHtml, setActiveHtml] = useState<string | null>(null);\n  const [localHtmlUri, setLocalHtmlUri] = useState<string | null>(null);"
  );
  
  const effectCode = `
  useEffect(() => {
    if (!activeHtml) {
      setLocalHtmlUri(null);
      return;
    }
    const writeHtml = async () => {
      try {
        const fileUri = FileSystem.cacheDirectory + 'preview.html';
        await FileSystem.writeAsStringAsync(fileUri, activeHtml, { encoding: FileSystem.EncodingType.UTF8 });
        setLocalHtmlUri(fileUri + '?t=' + Date.now());
      } catch (e) {
        console.error('Failed to write local HTML', e);
      }
    };
    writeHtml();
  }, [activeHtml]);
`;
  code = code.replace(/const \[errorMsg, setErrorMsg\] = useState<string \| null>\(null\);/, "const [errorMsg, setErrorMsg] = useState<string | null>(null);\n" + effectCode);
}

// Now replace WebView sources
code = code.replace(/source=\{\{\s*html:\s*activeHtml,\s*baseUrl:\s*["']https:\/\/gametok\.app["']\s*\}\}/g, 
  "source={localHtmlUri ? { uri: localHtmlUri } : { html: '', baseUrl: 'https://gametok.app' }}");

fs.writeFileSync('src/screens/CreateScreen.tsx', code);
console.log("Patched CreateScreen.tsx");
