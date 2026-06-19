import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const srcDir = path.join(root, 'src');

const css = fs.readFileSync(path.join(distDir, 'ui.css'), 'utf8');
const minCss = fs.readFileSync(path.join(distDir, 'ui.min.css'), 'utf8');
const catalog: string[] = JSON.parse(fs.readFileSync(path.join(distDir, 'components.json'), 'utf8'));

describe('@nekostack/ui build outputs', () => {
  it('produces ui.css and ui.min.css', () => {
    expect(css.length).toBeGreaterThan(0);
    expect(minCss.length).toBeGreaterThan(0);
    expect(minCss.length).toBeLessThan(css.length);
  });

  it('includes all 13 source files in cascade order', () => {
    const order = ['base', 'layout', 'button', 'form', 'disclosure', 'card', 'feedback', 'nav', 'overlay', 'data', 'media', 'mockup', 'utilities'];
    const positions = order.map(name => css.indexOf(`/* ===================== ${name} ===================== */`));
    for (const pos of positions) expect(pos).toBeGreaterThan(-1);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]!).toBeGreaterThan(positions[i - 1]!);
    }
  });
});

describe('token purity', () => {
  it('contains zero hardcoded hex colors', () => {
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const hexes = noComments.match(/#[0-9a-fA-F]{3,8}\b/g);
    expect(hexes).toBeNull();
  });

  it('every color reference uses --neko-color-semantic-* or allowed keywords', () => {
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const colorProps = [...noComments.matchAll(/((?:background|color|border(?:-\w+)?-color|outline-color|box-shadow)\s*:\s*)([^;]+)/g)];
    const allowed = /var\(--neko-|transparent|currentColor|inherit|initial|none|0/;
    for (const [, , value] of colorProps) {
      if (!value) continue;
      const cleaned = value.replace(/var\(--[^)]+\)/g, '').replace(/\d+px/g, '').trim();
      if (cleaned && !/^[\s,0]+$/.test(cleaned)) {
        expect(value).toMatch(allowed);
      }
    }
  });
});

describe('component catalog', () => {
  it('contains at least 90 components', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(90);
  });

  const requiredBlocks = [
    'neko-btn', 'neko-btn-group', 'neko-card', 'neko-input', 'neko-select',
    'neko-textarea', 'neko-checkbox', 'neko-radio', 'neko-switch',
    'neko-alert', 'neko-badge', 'neko-tag', 'neko-toast', 'neko-spinner',
    'neko-progress', 'neko-skeleton', 'neko-tabs', 'neko-link',
    'neko-breadcrumb', 'neko-menu', 'neko-pagination', 'neko-modal',
    'neko-dialog', 'neko-drawer', 'neko-tooltip', 'neko-popover',
    'neko-table', 'neko-list', 'neko-avatar', 'neko-stat', 'neko-empty',
    'neko-container', 'neko-stack', 'neko-cluster', 'neko-grid',
    'neko-divider', 'neko-prose', 'neko-code', 'neko-kbd',
    'neko-accordion', 'neko-swap', 'neko-dropdown',
    'neko-artboard', 'neko-mask',
    'neko-mockup-browser', 'neko-mockup-window', 'neko-mockup-phone', 'neko-mockup-code',
    'neko-chat', 'neko-indicator', 'neko-carousel', 'neko-diff',
    'neko-hero', 'neko-navbar', 'neko-bottom-nav', 'neko-footer',
    'neko-timeline', 'neko-steps', 'neko-rating', 'neko-radial-progress', 'neko-countdown',
    'neko-range', 'neko-file',
    'neko-collapse', 'neko-tree', 'neko-theme-controller', 'neko-banner', 'neko-status',
    'neko-loading-dots', 'neko-calendar', 'neko-stepper', 'neko-kbd-combo',
  ];

  for (const block of requiredBlocks) {
    it(`includes ${block}`, () => {
      expect(catalog).toContain(block);
    });
  }
});

describe('source file conventions', () => {
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.css'));

  it('every source file starts with a block comment listing its classes', () => {
    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
      expect(content.startsWith('/*')).toBe(true);
    }
  });

  it('no source file redefines shared keyframes', () => {
    for (const file of files) {
      if (file === 'base.css') continue;
      const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
      const noComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(noComments).not.toMatch(/@keyframes\s+neko-/);
    }
  });

  it('no source file uses !important (except base.css)', () => {
    for (const file of files) {
      if (file === 'base.css') continue;
      const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
      expect(content).not.toMatch(/!important/);
    }
  });
});

describe('interactive states', () => {
  it('button.css has :hover, :focus-visible, and :disabled', () => {
    const btn = fs.readFileSync(path.join(srcDir, 'button.css'), 'utf8');
    expect(btn).toContain(':hover');
    expect(btn).toContain(':focus-visible');
    expect(btn).toContain(':disabled');
  });

  it('form.css has :hover, :focus-visible, :disabled, and [aria-invalid]', () => {
    const form = fs.readFileSync(path.join(srcDir, 'form.css'), 'utf8');
    expect(form).toContain(':hover');
    expect(form).toContain(':focus-visible');
    expect(form).toContain(':disabled');
    expect(form).toContain('[aria-invalid="true"]');
  });

  it('nav.css interactive elements have :hover, :focus-visible, :disabled', () => {
    const nav = fs.readFileSync(path.join(srcDir, 'nav.css'), 'utf8');
    expect(nav).toContain(':hover');
    expect(nav).toContain(':focus-visible');
    expect(nav).toContain(':disabled');
  });
});
