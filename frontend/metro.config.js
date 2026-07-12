const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Do not set unstable_conditionNames with "import"/"require" — that breaks @babel/runtime
// helpers (e.g. _objectWithoutPropertiesLoose is not a function in expo-router).
config.resolver.sourceExts = [...new Set([...config.resolver.sourceExts, 'cjs', 'mjs'])];

const openpgpLightweight = path.join(
  __dirname,
  'node_modules/openpgp/dist/lightweight/openpgp.min.mjs'
);

const nobleHashesRoots = [
  path.join(__dirname, 'node_modules/@noble/hashes'),
  path.join(__dirname, 'node_modules/@protontech/drive-sdk/node_modules/@noble/hashes'),
  path.join(__dirname, 'node_modules/@protontech/crypto/node_modules/@noble/hashes'),
];

function resolveNobleHashesCryptoJs() {
  for (const root of nobleHashesRoots) {
    const candidate = path.join(root, 'crypto.js');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const esmCandidate = path.join(root, 'esm/crypto.js');
    if (fs.existsSync(esmCandidate)) {
      return esmCandidate;
    }
  }
  return null;
}

const nobleHashesCryptoJs = resolveNobleHashesCryptoJs();

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'openpgp/lightweight') {
    return { filePath: openpgpLightweight, type: 'sourceFile' };
  }
  if (
    nobleHashesCryptoJs &&
    (moduleName === '@noble/hashes/crypto.js' || moduleName.endsWith('@noble/hashes/crypto.js'))
  ) {
    return { filePath: nobleHashesCryptoJs, type: 'sourceFile' };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
