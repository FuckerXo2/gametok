#!/usr/bin/env node
/**
 * bundle-games-iife.mjs
 *
 * Backend ingestion & compilation script for GameTok Native Runtime.
 * Reads HTML5 games from `gametok-games/<gameId>/`, extracts all scripts in order,
 * resolves dependencies (like zepto, main.js, game.js), applies sanity fixes,
 * compiles into a self-contained IIFE bundle (`game.bundle.js`), and verifies
 * headless execution.
 *
 * Usage:
 *   node scripts/bundle-games-iife.mjs           # Bundle all games in catalog
 *   node scripts/bundle-games-iife.mjs breakout  # Bundle a single game
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { transformSync } from '@babel/core';
import transformClasses from '@babel/plugin-transform-classes';
import transformClassProperties from '@babel/plugin-transform-class-properties';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_GAMES_DIR = path.resolve(__dirname, '../../gametok-games');

/**
 * Browser bundles can contain modern class declarations that parse in Safari
 * but fail when Hermes evaluates them via Function(). Lower these constructs
 * before the bundle is published to R2.
 */
function transpileForHermes(source, sourceName) {
  const result = transformSync(source, {
    babelrc: false,
    configFile: false,
    comments: false,
    compact: true,
    filename: sourceName,
    plugins: [transformClassProperties, transformClasses],
  });

  if (!result?.code) {
    throw new Error(`Babel produced no output for ${sourceName}`);
  }

  return result.code;
}

function extractScriptsFromHtml(htmlContent, gameDir) {
  const scriptTagRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  const scripts = [];

  while ((match = scriptTagRegex.exec(htmlContent)) !== null) {
    const attrs = match[1] || '';
    const inlineContent = match[2] || '';

    // Ignore importmap or JSON blocks
    if (/type\s*=\s*["'](importmap|application\/json|text\/json)["']/i.test(attrs)) {
      continue;
    }

    const srcMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/i);
    if (srcMatch) {
      let scriptRelPath = srcMatch[1].replace(/^\.\//, '');
      // Strip query parameters or hashes
      scriptRelPath = scriptRelPath.split('?')[0].split('#')[0];
      const fullPath = path.resolve(gameDir, scriptRelPath);

      if (fs.existsSync(fullPath)) {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        scripts.push({
          source: scriptRelPath,
          content: fileContent,
          isExternal: true,
        });
      } else {
        console.warn(`  [WARN] Script file not found: ${fullPath}`);
      }
    } else if (inlineContent.trim().length > 0) {
      scripts.push({
        source: 'inline',
        content: inlineContent,
        isExternal: false,
      });
    }
  }

  // Fallback: If no script tags in index.html, look for game.js directly
  if (scripts.length === 0) {
    const gameJs = path.join(gameDir, 'game.js');
    if (fs.existsSync(gameJs)) {
      scripts.push({
        source: 'game.js',
        content: fs.readFileSync(gameJs, 'utf8'),
        isExternal: true,
      });
    }
  }

  return scripts;
}

function bundleGame(gameId) {
  const gameDir = path.join(ROOT_GAMES_DIR, gameId);
  if (!fs.existsSync(gameDir) || !fs.statSync(gameDir).isDirectory()) {
    console.error(`[ERROR] Game directory not found: ${gameDir}`);
    return false;
  }

  console.log(`\n========================================`);
  console.log(`Ingesting Game: ${gameId}`);
  console.log(`Directory: ${gameDir}`);

  const indexPath = path.join(gameDir, 'index.html');
  let scripts = [];

  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8');
    scripts = extractScriptsFromHtml(html, gameDir);
  } else {
    const gameJs = path.join(gameDir, 'game.js');
    if (fs.existsSync(gameJs)) {
      scripts.push({ source: 'game.js', content: fs.readFileSync(gameJs, 'utf8'), isExternal: true });
    }
  }

  if (scripts.length === 0) {
    console.warn(`  [SKIP] No script content found for ${gameId}`);
    return false;
  }

  console.log(`  Found ${scripts.length} script segment(s): ${scripts.map(s => s.source).join(', ')}`);

  // Wrap each script in its own closure to preserve scope boundaries and prevent
  // strict mode variable leaks when multiple scripts are concatenated
  const concatenatedCode = scripts
    .map(s => `
/* --- Source: ${s.source} --- */
(function() {
${transpileForHermes(s.content, `${gameId}/${s.source}`)}
})();`)
    .join('\n');

  // Wrap in clean IIFE compatible with both standard browser and Hermes globalThis
  const bundledIIFE = `/**
 * Bundled by GameTok Ingestion Pipeline
 * Game ID: ${gameId}
 * Date: ${new Date().toISOString()}
 */
(function(window, document, self) {
${concatenatedCode}
})(
  typeof globalThis !== 'undefined' ? globalThis : window,
  typeof document !== 'undefined' ? document : (typeof globalThis !== 'undefined' ? globalThis.document : null),
  typeof globalThis !== 'undefined' ? globalThis : self
);
`;

  const outputPath = path.join(gameDir, 'game.bundle.js');
  fs.writeFileSync(outputPath, bundledIIFE, 'utf8');
  console.log(`  Saved clean bundle (${bundledIIFE.length} bytes) to: ${outputPath}`);

  // Test headless execution
  const valid = testHeadlessExecution(gameId, bundledIIFE);
  if (valid) {
    console.log(`  [VERIFIED] ${gameId} bundle runs cleanly without errors.`);
  } else {
    console.warn(`  [WARNING] ${gameId} bundle encountered issues during headless check.`);
  }

  return valid;
}

function testHeadlessExecution(gameId, bundleCode) {
  const canvas = {
    width: 400, height: 800, clientWidth: 400, clientHeight: 800,
    offsetWidth: 400, offsetHeight: 800,
    getContext: () => ({
      fillRect: () => {}, clearRect: () => {}, beginPath: () => {}, closePath: () => {},
      moveTo: () => {}, lineTo: () => {}, arc: () => {}, roundRect: () => {}, fill: () => {},
      stroke: () => {}, setLineDash: () => {}, getLineDash: () => [], clip: () => {},
      fillText: () => {}, measureText: () => ({ width: 10 }),
      save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {}, scale: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      drawImage: () => {}, getImageData: () => ({ data: new Uint8Array(4) }),
    }),
    addEventListener: () => {}, removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 800 }),
    style: {},
  };

  const createMockElem = (id = '', tag = 'DIV') => ({
    tagName: tag, nodeName: tag, nodeType: 1, id,
    classList: { add: () => {}, remove: () => {}, toggle: () => false, contains: () => false },
    style: {}, innerText: '', textContent: '', innerHTML: '',
    appendChild: (c) => c, removeChild: (c) => c, contains: () => true,
    addEventListener: () => {}, removeEventListener: () => {},
    querySelectorAll: () => Array.from({ length: 64 }, () => createMockElem()),
    querySelector: () => createMockElem(),
    getElementsByTagName: (tag) => ((tag || '').toLowerCase() === 'canvas' ? [canvas] : Array.from({ length: 4 }, () => createMockElem())),
    getElementsByClassName: () => Array.from({ length: 4 }, () => createMockElem()),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 800 }),
    setAttribute: () => {}, getAttribute: () => null,
    getContext: (t) => (t && t.includes('webgl') ? null : canvas.getContext('2d')),
  });
  const elem = createMockElem();

  const doc = {
    createElement: (tag) => (tag === 'canvas' ? canvas : createMockElem()),
    getElementById: (id) => (['canvas', 'game', 'c', 'minimap'].includes(id) || id.toLowerCase().includes('canvas') ? canvas : createMockElem(id)),
    querySelector: (sel) => (sel.includes('canvas') || sel.includes('game') ? canvas : createMockElem()),
    querySelectorAll: () => Array.from({ length: 64 }, () => createMockElem()),
    getElementsByTagName: (tag) => ((tag || '').toLowerCase() === 'canvas' ? [canvas] : Array.from({ length: 4 }, () => createMockElem())),
    getElementsByClassName: () => Array.from({ length: 4 }, () => createMockElem()),
    body: elem, head: elem, documentElement: elem,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  };

  globalThis.window = globalThis;
  globalThis.self = globalThis;
  globalThis.document = doc;
  globalThis.canvas = canvas;
  globalThis.innerWidth = 400;
  globalThis.innerHeight = 800;
  globalThis.devicePixelRatio = 2;
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.dispatchEvent = () => {};
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '', width: '400px', height: '800px' });
  globalThis.AudioContext = function() { return { createGain: () => ({ gain: {} }), createOscillator: () => ({ frequency: {} }) }; };
  globalThis.Image = function() { return { onload: null, src: '' }; };
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  class SyntheticHTMLAudioElement {
    src = ''; loop = false; volume = 1; currentTime = 0; paused = true;
    constructor(src) { if (src) this.src = src; }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    addEventListener() {} removeEventListener() {}
  }
  globalThis.location = { href: 'https://gametok.app', protocol: 'https:' };
  globalThis.Audio = SyntheticHTMLAudioElement;
  globalThis.HTMLAudioElement = SyntheticHTMLAudioElement;
  try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'GameTok/1.0' }, configurable: true, writable: true }); } catch {}

  try {
    const fn = new Function('window', 'document', 'self', bundleCode);
    fn(globalThis, doc, globalThis);
    return true;
  } catch (err) {
    console.error(`  [HEADLESS CRASH] ${gameId}: ${err.message}`);
    return false;
  }
}

// Main CLI
const IGNORE_DIRS = new Set(['node_modules', 'report', 'scripts', 'support', 'thumbnails', 'openpigeon-games', 'game', 'icons']);

const targetGame = process.argv[2];
if (targetGame) {
  bundleGame(targetGame);
  process.exit(0);
} else {
  console.log(`Starting catalog ingestion from: ${ROOT_GAMES_DIR}`);
  const entries = fs.readdirSync(ROOT_GAMES_DIR, { withFileTypes: true });
  let count = 0;
  let success = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (IGNORE_DIRS.has(entry.name)) continue;
    count++;
    if (bundleGame(entry.name)) {
      success++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Catalog Ingestion Complete!`);
  console.log(`Processed: ${count} games | Verified: ${success}/${count}`);
  process.exit(0);
}
