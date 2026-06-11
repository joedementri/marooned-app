const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Zustand v5 ships ESM (.mjs) files that use import.meta, which Metro cannot
// handle in web bundles. By placing 'react-native' before 'import' in the
// condition priority list, Metro resolves to zustand's CJS build instead.
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

module.exports = config;
