const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectDir = process.cwd();
const cacheRoot = path.join(projectDir, '.cache');
const builderCacheDir = path.join(cacheRoot, 'electron-builder');
fs.mkdirSync(builderCacheDir, { recursive: true });

const builderBin = path.join(
  projectDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder',
);

const result = spawnSync(builderBin, process.argv.slice(2), {
  stdio: 'inherit',
  env: {
    ...process.env,
    XDG_CACHE_HOME: cacheRoot,
    ELECTRON_BUILDER_CACHE: builderCacheDir,
  },
});

process.exit(result.status ?? 1);
