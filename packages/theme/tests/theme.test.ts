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
      expect(Object.keys((tokens.themes as any)[theme].modes)).toEqual(['dark', 'light']);
    }
  });

  it('every (theme, mode) combination exposes the same semantic role set', () => {
    const reference = Object.keys(tokens.themes.neko.modes.dark.color.semantic).sort();
    for (const theme of Object.keys(tokens.themes)) {
      for (const mode of Object.keys((tokens.themes as any)[theme].modes)) {
        const roles = Object.keys((tokens.themes as any)[theme].modes[mode].color.semantic).sort();
        expect(roles, `${theme}.${mode}`).toEqual(reference);
      }
    }
  });

  it('themeOptions enumerates every (theme, mode) pair with labels', () => {
    expect(themeOptions.length).toBe(6);
    expect(themeOptions.find((o: any) => o.isDefault)).toMatchObject({ theme: 'neko', mode: 'dark' });
    expect(themeOptions.map((o: any) => o.label)).toContain('Neko · Dark');
    expect(themeOptions.map((o: any) => o.label)).toContain('Synthwave · Light');
  });
});

describe('Design tokens — base', () => {
  it('has comfortable spacing values', () => {
    expect(tokens.base.spacing['4'].value).toBe('16px');
    expect(tokens.base.spacing['8'].value).toBe('32px');
  });
  it('keeps neutrals as theme-invariant Dracula-derived ramp', () => {
    expect(tokens.base.color.neutral['900'].value).toBe('#282a36');
    expect(tokens.base.color.neutral['50'].value).toBe('#f8f8f2');
  });
});

describe('Design tokens — WCAG AA contrast', () => {
  // WCAG 2.1 relative-luminance contrast — every (theme × mode × role) pair of
  // base/-content must clear 4.5:1 for normal-text AA. Also asserts text-base,
  // text-muted, and text-subtle vs bg-base.
  function hexToRgb(h: any): [number, number, number] {
    const val = typeof h === 'object' ? h.value : h;
    const hex = val.replace('#', '');
    if (hex.length === 3) {
      const expanded = hex.split('').map((c: string) => c + c).join('');
      return [parseInt(expanded.slice(0, 2), 16), parseInt(expanded.slice(2, 4), 16), parseInt(expanded.slice(4, 6), 16)];
    }
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  function srgbToLin(c: number): number {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function lum(hex: any): number {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
  }
  function ratio(a: any, b: any): number {
    const l1 = lum(a), l2 = lum(b);
    const lo = Math.min(l1, l2), hi = Math.max(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  const ROLES = ['primary', 'secondary', 'accent-1', 'accent-2', 'accent-3', 'info', 'success', 'warning', 'danger'];
  const TEXT_ROLES = ['text-base', 'text-muted', 'text-subtle'];
  const AA_NORMAL = 4.5;

  for (const [theme, themeData] of Object.entries(tokens.themes as Record<string, any>)) {
    for (const [mode, modeData] of Object.entries((themeData as any).modes)) {
      const s: Record<string, any> = (modeData as any).color.semantic;
      for (const role of ROLES) {
        it(`${theme} · ${mode}: ${role} on ${role}-content clears AA (4.5:1)`, () => {
          const r = ratio(s[role], s[`${role}-content`]);
          const bg = s[role].value ?? s[role];
          const fg = s[`${role}-content`].value ?? s[`${role}-content`];
          expect(r, `${bg} on ${fg} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
        });
      }
      for (const tk of TEXT_ROLES) {
        it(`${theme} · ${mode}: ${tk} on bg-base clears AA (4.5:1)`, () => {
          const r = ratio(s[tk], s['bg-base']);
          const fg = s[tk].value ?? s[tk];
          const bg = s['bg-base'].value ?? s['bg-base'];
          expect(r, `${fg} on ${bg} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
        });
      }
    }
  }
});
