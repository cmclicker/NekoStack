import { describe, expect, it } from 'vitest';
import { tokens, defaultTheme, defaultMode, themeOptions } from '../src/index.js';

describe('Design tokens — meta', () => {
  it('declares NekoStack and defaults', () => {
    expect(tokens.meta.name).toBe('NekoStack');
    expect(defaultTheme).toBe('neko');
    expect(defaultMode).toBe('dark');
  });
});

describe('Design tokens — themes × modes', () => {
  it('ships Neko, Synthwave, and Cupcake, each with dark and light modes', () => {
    expect(Object.keys(tokens.themes)).toEqual(['neko', 'synthwave', 'cupcake']);
    for (const theme of Object.keys(tokens.themes)) {
      expect(Object.keys(tokens.themes[theme].modes)).toEqual(['dark', 'light']);
    }
  });

  it('every (theme, mode) combination exposes the same semantic role set', () => {
    const reference = Object.keys(tokens.themes.neko.modes.dark.color.semantic).sort();
    for (const theme of Object.keys(tokens.themes)) {
      for (const mode of Object.keys(tokens.themes[theme].modes)) {
        const roles = Object.keys(tokens.themes[theme].modes[mode].color.semantic).sort();
        expect(roles, `${theme}.${mode}`).toEqual(reference);
      }
    }
  });

  it('themeOptions enumerates every (theme, mode) pair with labels', () => {
    expect(themeOptions.length).toBe(6);
    expect(themeOptions.find((o) => o.isDefault)).toMatchObject({ theme: 'neko', mode: 'dark' });
    expect(themeOptions.map((o) => o.label)).toContain('Neko · Dark');
    expect(themeOptions.map((o) => o.label)).toContain('Synthwave · Light');
  });
});

describe('Design tokens — base', () => {
  it('has comfortable spacing values', () => {
    expect(tokens.base.spacing['4']).toBe('16px');
    expect(tokens.base.spacing['8']).toBe('32px');
  });
  it('keeps neutrals as theme-invariant Dracula-derived ramp', () => {
    expect(tokens.base.color.neutral['900']).toBe('#282a36');
    expect(tokens.base.color.neutral['50']).toBe('#f8f8f2');
  });
});

describe('Design tokens — WCAG AA contrast', () => {
  // WCAG 2.1 relative-luminance contrast — every (theme × mode × role) pair of
  // base/-content must clear 4.5:1 for normal-text AA. Also asserts text-base,
  // text-muted, and text-subtle vs bg-base.
  function hexToRgb(h: string): [number, number, number] {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function srgbToLin(c: number): number {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function lum(hex: string): number {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
  }
  function ratio(a: string, b: string): number {
    const l1 = lum(a), l2 = lum(b);
    const lo = Math.min(l1, l2), hi = Math.max(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  const ROLES = ['primary', 'secondary', 'accent-1', 'accent-2', 'accent-3', 'info', 'success', 'warning', 'danger'];
  const TEXT_ROLES = ['text-base', 'text-muted', 'text-subtle'];
  const AA_NORMAL = 4.5;

  for (const [theme, themeData] of Object.entries(tokens.themes)) {
    for (const [mode, modeData] of Object.entries(themeData.modes)) {
      const s: Record<string, string> = (modeData as { color: { semantic: Record<string, string> } }).color.semantic;
      for (const role of ROLES) {
        it(`${theme} · ${mode}: ${role} on ${role}-content clears AA (4.5:1)`, () => {
          const r = ratio(s[role], s[`${role}-content`]);
          expect(r, `${s[role]} on ${s[`${role}-content`]} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
        });
      }
      for (const tk of TEXT_ROLES) {
        it(`${theme} · ${mode}: ${tk} on bg-base clears AA (4.5:1)`, () => {
          const r = ratio(s[tk], s['bg-base']);
          expect(r, `${s[tk]} on ${s['bg-base']} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
        });
      }
    }
  }
});
