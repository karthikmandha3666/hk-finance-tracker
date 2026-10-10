import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Mobile Safari, iOS & Viewport Stability Audit', () => {
  const indexHtmlPath = path.resolve(__dirname, '../../index.html');
  const indexCssPath = path.resolve(__dirname, '../index.css');

  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
  const indexCss = fs.readFileSync(indexCssPath, 'utf-8');

  describe('A. Unexpected Zoom & Viewport Configuration', () => {
    it('configures viewport to disable zoom on mobile (maximum-scale=1.0, user-scalable=no, viewport-fit=cover)', () => {
      expect(indexHtml).toContain('user-scalable=no');
      expect(indexHtml).toContain('maximum-scale=1.0');
      expect(indexHtml).toMatch(/meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width/);
      expect(indexHtml).toMatch(/meta\s+name=["']viewport["']\s+content=["'][^"']*viewport-fit=cover/);
    });

    it('includes Apple mobile web app standalone tags', () => {
      expect(indexHtml).toContain('apple-mobile-web-app-capable');
      expect(indexHtml).toContain('apple-mobile-web-app-status-bar-style');
    });

    it('enforces font-size >= 16px on .form-input to prevent iOS Safari auto-zoom on focus', () => {
      // Matches .form-input definition with 16px font-size
      expect(indexCss).toMatch(/\.form-input\s*\{[^}]*font-size:\s*16px/);
    });

    it('enforces font-size >= 16px on .filter-select to prevent iOS Safari auto-zoom on focus', () => {
      expect(indexCss).toMatch(/\.filter-select\s*\{[^}]*font-size:\s*16px/);
    });

    it('includes a universal mobile font-size safeguard for form controls', () => {
      // Must have media query for mobile screens setting font-size to 16px
      expect(indexCss).toMatch(/@media[^{]*max-width:\s*768px[^{]*\{[^}]*font-size:\s*16px\s*!important/);
    });
  });

  describe('B. Horizontal Movement & Layout Overflow Prevention', () => {
    it('does not force min-width: 130px on .filter-group, allowing clean shrinking at 320px', () => {
      // .filter-group should have min-width: 0 and flex-basis
      expect(indexCss).toMatch(/\.filter-group\s*\{[^}]*min-width:\s*0/);
      expect(indexCss).not.toMatch(/\.filter-group\s*\{[^}]*min-width:\s*130px/);
    });

    it('uses minmax(0, 1fr) on category and payment chips grids to prevent blowout', () => {
      expect(indexCss).toMatch(/\.category-chips-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
      expect(indexCss).toMatch(/\.payment-chips-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    });

    it('applies text truncation (ellipsis) on category and payment chips', () => {
      expect(indexCss).toMatch(/\.category-chip\s*\{[^}]*text-overflow:\s*ellipsis/);
      expect(indexCss).toMatch(/\.category-chip\s*\{[^}]*white-space:\s*nowrap/);
      expect(indexCss).toMatch(/\.payment-chip\s*\{[^}]*text-overflow:\s*ellipsis/);
      expect(indexCss).toMatch(/\.payment-chip\s*\{[^}]*white-space:\s*nowrap/);
    });

    it('uses minmax(0, 1fr) on frequency chips grid and prevents text overflow', () => {
      expect(indexCss).toMatch(/\.frequency-chips-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
      expect(indexCss).toMatch(/\.frequency-chip\s*\{[^}]*text-overflow:\s*ellipsis/);
      expect(indexCss).toMatch(/\.frequency-chip\s*\{[^}]*white-space:\s*nowrap/);
    });

    it('uses minmax(0, 1fr) on loans-home-card and truncates labels and values', () => {
      expect(indexCss).toMatch(/\.loans-home-card\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto\s*minmax\(0,\s*1fr\)\s*auto\s*minmax\(0,\s*1fr\)/);
      expect(indexCss).toMatch(/\.loans-home-stat-label\s*\{[^}]*text-overflow:\s*ellipsis/);
      expect(indexCss).toMatch(/\.loans-home-stat-val\s*\{[^}]*text-overflow:\s*ellipsis/);
    });

    it('uses minmax(0, 1fr) on bottom-nav tracks and truncates labels to fit 320px screens', () => {
      expect(indexCss).toMatch(/grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
      expect(indexCss).toMatch(/\.nav-label\s*\{[^}]*text-overflow:\s*ellipsis/);
      expect(indexCss).toMatch(/\.nav-label\s*\{[^}]*white-space:\s*nowrap/);
    });

    it('clips horizontal overflow at the mobile shell container level', () => {
      expect(indexCss).toMatch(/\.mobile-shell\s*\{[^}]*overflow-x:\s*clip/);
    });

    it('targets modern iPhone viewports (<= 440px) with responsive rules', () => {
      expect(indexCss).toMatch(/@media\s*\(max-width:\s*440px\)\s*\{/);
    });
  });

  describe('C. Vertical Scrolling, Keyboard & Modal Dialog Safety', () => {
    it('sets max-height, momentum scroll, and overscroll containment on modal dialogs', () => {
      expect(indexCss).toMatch(/\.modal-backdrop\s*\{[^}]*overscroll-behavior:\s*contain/);
      expect(indexCss).toMatch(/\.modal-card\s*\{[^}]*max-height:\s*calc\(100vh\s*-\s*32px\)/);
      expect(indexCss).toMatch(/\.modal-card\s*\{[^}]*max-height:\s*calc\(100dvh\s*-\s*32px\)/);
      expect(indexCss).toMatch(/\.modal-card\s*\{[^}]*overflow-y:\s*auto/);
    });

    it('locks background body scrolling when any modal dialog is mounted', () => {
      expect(indexCss).toMatch(/body:has\(\.modal-backdrop\)\s*\{\s*overflow:\s*hidden;\s*\}/);
    });

    it('respects safe-area-inset-top and safe-area-inset-bottom for notch and home indicator', () => {
      expect(indexCss).toContain('env(safe-area-inset-top');
      expect(indexCss).toContain('env(safe-area-inset-bottom');
    });
  });

  describe('D. Touch & Gesture Behavior', () => {
    it('applies touch-action: manipulation to eliminate double-tap delay and accidental zoom on interactive elements', () => {
      expect(indexCss).toMatch(/touch-action:\s*manipulation/);
    });
  });
});
