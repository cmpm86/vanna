/**
 * FOChainData - Jest Configuration
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/app/(.*)$': '<rootDir>/app/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  testMatch: [
    '**/__tests__/**/*.test.(ts|tsx)'
  ],
  setupFilesAfterEnv: [],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};