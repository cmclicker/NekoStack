import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokensRaw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'tokens.json'), 'utf8'));

function resolveValue(val, root) {
  const v = (val !== null && typeof val === 'object' && 'value' in val) ? val.value : val;

  if (typeof v === 'string' && v.startsWith('{') && v.endsWith('}')) {
    const pathStr = v.slice(1, -1);
    const resolved = pathStr.split('.').reduce((acc, curr) => acc?.[curr], root);
    if (resolved === undefined) throw new Error(`Alias not found: ${v}`);
    return resolveValue(resolved, root);
  }
  return v;
}

function resolveTokens(obj, root) {
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
    if ('value' in obj) {
      return { ...obj, value: resolveValue(obj, root) };
    }
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = resolveTokens(v, root);
    return out;
  }
  return obj;
}

const tokens = resolveTokens(tokensRaw, tokensRaw);

function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function srgbToLin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lum(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  const lo = Math.min(l1, l2), hi = Math.max(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

const ROLES = ['primary', 'secondary', 'accent-1', 'accent-2', 'accent-3', 'info', 'success', 'warning', 'danger'];
// Tokens used as foreground text on surfaces — must clear 4.5:1 against bg-base.
const ACCENT_TEXT_ROLES = ['primary', 'secondary', 'link'];

let failures = 0;
let largeOnly = 0;

for (const [theme, themeData] of Object.entries(tokens.themes)) {
  for (const [mode, modeData] of Object.entries(themeData.modes)) {
    const s = modeData.color.semantic;
    console.log(`\n=== ${theme} · ${mode} ===`);
    for (const r of ROLES) {
      const bg = s[r]?.value ?? s[r];
      const fg = s[r + '-content']?.value ?? s[r + '-content'];
      if (!bg || !fg || (typeof bg === 'string' && bg.startsWith('rgba'))) continue;
      const ra = ratio(bg, fg);
      const pass = ra >= 4.5 ? 'OK' : ra >= 3.0 ? 'AA-LARGE' : 'FAIL';
      const flag = ra >= 4.5 ? '   ' : ra >= 3.0 ? ' ! ' : 'XXX';
      if (ra < 4.5 && ra >= 3.0) largeOnly++;
      if (ra < 3.0) failures++;
      console.log(`  ${flag} ${r.padEnd(10)} ${bg} on ${fg} = ${ra.toFixed(2)}:1  [${pass}]`);
    }
    const bgBase = modeData.color.semantic['bg-base']?.value ?? modeData.color.semantic['bg-base'];
    for (const tk of ['text-base', 'text-muted', 'text-subtle']) {
      const fg = s[tk]?.value ?? s[tk];
      const ra = ratio(bgBase, fg);
      const pass = ra >= 4.5 ? 'OK' : ra >= 3.0 ? 'AA-LARGE' : 'FAIL';
      const flag = ra >= 4.5 ? '   ' : ra >= 3.0 ? ' ! ' : 'XXX';
      if (ra < 4.5 && ra >= 3.0) largeOnly++;
      if (ra < 3.0) failures++;
      console.log(`  ${flag} ${tk.padEnd(10)} ${fg} on ${bgBase} = ${ra.toFixed(2)}:1  [${pass}]`);
    }
    console.log(`  -- accent-as-text on bg-base (4.5:1 required) --`);
    for (const tk of ACCENT_TEXT_ROLES) {
      const fg = s[tk]?.value ?? s[tk];
      if (!fg || typeof fg !== 'string' || fg.startsWith('rgba') || fg.startsWith('rgb')) continue;
      const ra = ratio(bgBase, fg);
      const pass = ra >= 4.5 ? 'OK' : ra >= 3.0 ? 'AA-LARGE' : 'FAIL';
      const flag = ra >= 4.5 ? '   ' : ra >= 3.0 ? ' ! ' : 'XXX';
      if (ra < 4.5 && ra >= 3.0) largeOnly++;
      if (ra < 4.5) failures++;
      console.log(`  ${flag} ${tk.padEnd(10)} ${fg} on ${bgBase} = ${ra.toFixed(2)}:1  [${pass}]`);
    }
  }
}

console.log(`\n${failures} hard fails (< 3:1), ${largeOnly} large-text-only passes (3–4.5:1)`);

if (failures > 0) {
  console.error(`\n❌ Audit failed: ${failures} inaccessible color pairs found.`);
  process.exit(1);
} else {
  console.log(`\n✅ All colors pass accessibility checks!`);
}
