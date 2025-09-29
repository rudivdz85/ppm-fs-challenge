/**
 * Prettier configuration for PPM FS Challenge
 * Shared across all packages in the monorepo
 */

export default {
  // Formatting options
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  
  // JSX options
  jsxSingleQuote: false,
  jsxBracketSameLine: false,
  
  // Trailing commas
  trailingComma: 'es5',
  
  // Bracket spacing
  bracketSpacing: true,
  bracketSameLine: false,
  
  // Arrow function parentheses
  arrowParens: 'avoid',
  
  // Range formatting
  rangeStart: 0,
  rangeEnd: Infinity,
  
  // Parser options
  requirePragma: false,
  insertPragma: false,
  proseWrap: 'preserve',
  
  // HTML options
  htmlWhitespaceSensitivity: 'css',
  
  // Vue options
  vueIndentScriptAndStyle: false,
  
  // End of line
  endOfLine: 'lf',
  
  // Embedded language formatting
  embeddedLanguageFormatting: 'auto',
  
  // Single attribute per line in HTML/JSX
  singleAttributePerLine: false,
  
  // Override for specific file types
  overrides: [
    {
      files: '*.json',
      options: {
        tabWidth: 2,
        printWidth: 100,
      },
    },
    {
      files: '*.md',
      options: {
        printWidth: 100,
        proseWrap: 'always',
      },
    },
    {
      files: '*.{yml,yaml}',
      options: {
        tabWidth: 2,
        singleQuote: false,
      },
    },
    {
      files: '*.css',
      options: {
        singleQuote: false,
      },
    },
    {
      files: '*.{js,jsx,ts,tsx}',
      options: {
        singleQuote: true,
        trailingComma: 'es5',
      },
    },
  ],
};

// For CommonJS compatibility
module.exports = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  jsxSingleQuote: false,
  jsxBracketSameLine: false,
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  rangeStart: 0,
  rangeEnd: Infinity,
  requirePragma: false,
  insertPragma: false,
  proseWrap: 'preserve',
  htmlWhitespaceSensitivity: 'css',
  vueIndentScriptAndStyle: false,
  endOfLine: 'lf',
  embeddedLanguageFormatting: 'auto',
  singleAttributePerLine: false,
  overrides: [
    {
      files: '*.json',
      options: {
        tabWidth: 2,
        printWidth: 100,
      },
    },
    {
      files: '*.md',
      options: {
        printWidth: 100,
        proseWrap: 'always',
      },
    },
    {
      files: '*.{yml,yaml}',
      options: {
        tabWidth: 2,
        singleQuote: false,
      },
    },
    {
      files: '*.css',
      options: {
        singleQuote: false,
      },
    },
    {
      files: '*.{js,jsx,ts,tsx}',
      options: {
        singleQuote: true,
        trailingComma: 'es5',
      },
    },
  ],
};