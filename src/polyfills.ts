// Polyfill Node/browser globals required by modern libraries under Hermes
if (typeof process !== 'undefined') {
  if (typeof (process as any).emitWarning !== 'function') {
    (process as any).emitWarning = () => {};
  }
}

if (typeof globalThis !== 'undefined') {
  if (typeof (globalThis as any).process === 'undefined') {
    (globalThis as any).process = { env: {}, emitWarning: () => {} };
  } else if (typeof (globalThis as any).process.emitWarning !== 'function') {
    (globalThis as any).process.emitWarning = () => {};
  }
}
