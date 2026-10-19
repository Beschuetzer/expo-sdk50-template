import Module, { createRequire } from 'node:module';

if (process.platform === 'win32') {
  Module.builtinModules = Module.builtinModules.filter(
    (moduleName) => !moduleName.startsWith('node:'),
  );
}

createRequire(import.meta.url)('@expo/cli');
