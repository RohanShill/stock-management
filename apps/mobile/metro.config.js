const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // If a local relative import has a .js extension, try resolving without .js (to match .ts/.tsx)
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const candidateName = moduleName.slice(0, -3);
    try {
      return (defaultResolveRequest || context.resolveRequest)(context, candidateName, platform);
    } catch (e) {
      // If candidate fails, fallback to standard resolution
    }
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
