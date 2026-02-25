/**
 * Jest Configuration
 *
 * Supports both API tests (node) and React component tests (jsdom)
 * Uses @jest/environment-jsdom docblock directive for component tests
 */

const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

// Custom Jest config
const customJestConfig = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!jose)',
  ],
  // Default to node environment for API tests
  // Component tests should use @jest-environment jsdom docblock
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/mobile/',
    '/__tests__/api-loads.test.ts',
    '/__tests__/loadUtils.test.ts',
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
}

module.exports = createJestConfig(customJestConfig)
