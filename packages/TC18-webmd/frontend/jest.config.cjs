module.exports = {
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['js', 'json', 'vue'],
  transform: {
    '^.+\\.vue$': '@vue/vue3-jest',
    '^.+\\.js$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^marked$': '<rootDir>/tests/mocks/marked.js',
  },
  testMatch: ['**/tests/**/*.test.js', '**/__tests__/**/*.test.js'],
  transformIgnorePatterns: ['node_modules/(?!marked)/'],
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
}
