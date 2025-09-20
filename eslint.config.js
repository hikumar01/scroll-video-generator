const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly'
      }
    },
    rules: {
      // Formatting and style
      'indent': ['error', 2, { 'SwitchCase': 1 }],
      'linebreak-style': ['error', 'unix'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'semi': ['error', 'always'],
      'no-trailing-spaces': 'error',
      'eol-last': 'error',
      'object-curly-spacing': ['error', 'always'],
      'space-before-blocks': 'error',
      'space-before-function-paren': ['error', 'never'],
      'space-in-parens': 'error',
      'space-infix-ops': 'error',
      'spaced-comment': ['error', 'always'],
      'arrow-spacing': 'error',
      'block-spacing': 'error',
      'brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
      'comma-dangle': ['error', 'never'],
      'comma-spacing': 'error',
      'comma-style': 'error',
      'computed-property-spacing': 'error',
      'func-call-spacing': 'error',
      'key-spacing': 'error',
      'keyword-spacing': 'error',
      'max-len': ['error', { 
        'code': 120, 
        'ignoreUrls': true, 
        'ignoreStrings': true,
        'ignoreTemplateLiterals': true
      }],
      'no-multiple-empty-lines': ['error', { 'max': 2, 'maxEOF': 1 }],

      // Variables and scope
      'no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_', 
        'varsIgnorePattern': '^_', 
        'caughtErrorsIgnorePattern': '^_' 
      }],
      'prefer-const': 'error',
      'no-var': 'error',

      // Best practices
      'no-console': 'off',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unused-expressions': ['error', { 
        'allowShortCircuit': true, 
        'allowTernary': true 
      }],
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'no-void': 'error',
      'prefer-arrow-callback': 'error'
    }
  }
];
