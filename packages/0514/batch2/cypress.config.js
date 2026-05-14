const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: false,
    baseUrl: null,
    viewportWidth: 1280,
    viewportHeight: 720,
  },
})
