// Public entry point for @nekostack/theme.
// The actual data lives in the generated module produced by scripts/build.mjs.
/**
 * Public API for @nekostack/theme.
 * This file acts as the entry point to all theme tokens and utilities.
 */

// Import core components directly for type safety and explicit usage.
import * as rawTokens from '../dist/tokens';

// Export key data structures instead of a blanket export (*).
export const Theme = rawTokens.themes;
export const ModeUtility = {
    getTheme: (themeName: string, modeName: 'dark' | 'light') => {
        const themeData = rawTokens.themes[themeName];
        if (!themeData || !themeData.modes[modeName]) {
            throw new Error(`Theme or mode not found: ${themeName} / ${modeName}`);
        }
        return themeData.modes[modeName];
    },
    // Add other necessary utilities here, like contrast checkers if they need to be exposed programmatically.
};

export const isDark = (modeName: 'dark' | 'light') => modeName === 'dark';
export type ThemePalette = typeof rawTokens.themes[any].modes['dark']; // Use the most detailed mode for typing consistency.
export type ThemeName = keyof typeof rawTokens.themes;

// Export all necessary exports from the original structure, but keep them grouped under clear APIs.
export * from '../dist/tokens';
