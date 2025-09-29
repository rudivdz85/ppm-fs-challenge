import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

// Base configuration for all TypeScript projects
export const base = {
  files: ['**/*.{js,jsx,ts,tsx}'],
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      project: true,
    },
    globals: {
      console: 'readonly',
      process: 'readonly',
      Buffer: 'readonly',
      __dirname: 'readonly',
      __filename: 'readonly',
    },
  },
  plugins: {
    '@typescript-eslint': typescript,
  },
  rules: {
    ...js.configs.recommended.rules,
    ...typescript.configs.recommended.rules,
    
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/prefer-const': 'error',
    '@typescript-eslint/no-var-requires': 'off',
    
    // General rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    'no-unused-expressions': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
  },
};

// Server-specific configuration
export const server = {
  ...base,
  files: ['**/*.{js,ts}', '!**/*.{jsx,tsx}'],
  languageOptions: {
    ...base.languageOptions,
    globals: {
      ...base.languageOptions.globals,
      global: 'readonly',
      module: 'readonly',
      require: 'readonly',
      exports: 'readonly',
    },
  },
  rules: {
    ...base.rules,
    'no-console': 'off', // Allow console in server
    '@typescript-eslint/no-var-requires': 'off', // Allow require in server
  },
};

// Client-specific configuration  
export const client = {
  ...base,
  files: ['**/*.{js,jsx,ts,tsx}'],
  languageOptions: {
    ...base.languageOptions,
    parserOptions: {
      ...base.languageOptions.parserOptions,
      ecmaFeatures: {
        jsx: true,
      },
    },
    globals: {
      ...base.languageOptions.globals,
      window: 'readonly',
      document: 'readonly',
      navigator: 'readonly',
      localStorage: 'readonly',
      sessionStorage: 'readonly',
      fetch: 'readonly',
    },
  },
  plugins: {
    ...base.plugins,
    react,
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    ...base.rules,
    
    // React specific rules
    ...react.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    
    'react/react-in-jsx-scope': 'off', // Not needed with React 17+
    'react/prop-types': 'off', // Using TypeScript for prop validation
    'react/display-name': 'warn',
    'react/no-unescaped-entities': 'warn',
    'react/jsx-key': 'error',
    'react/jsx-no-duplicate-props': 'error',
    'react/jsx-no-undef': 'error',
    'react/jsx-uses-react': 'off', // Not needed with React 17+
    'react/jsx-uses-vars': 'error',
    'react/no-deprecated': 'warn',
    'react/no-direct-mutation-state': 'error',
    'react/no-find-dom-node': 'error',
    'react/no-is-mounted': 'error',
    'react/no-render-return-value': 'error',
    'react/require-render-return': 'error',
    
    // React Hooks rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // React Refresh rules
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
};

// Export configurations with prettier integration
export default [
  base,
  prettier, // Disables conflicting ESLint rules
];

// Named exports for specific environments
export { server, client };