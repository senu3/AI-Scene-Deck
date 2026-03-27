const path = require('path');
const { spawnSync } = require('child_process');

if (process.platform !== 'win32') {
  console.error(
    `build-win must be run on Windows. Current host: ${process.platform}. ` +
    'This repository uses the local Electron distribution for packaging, so cross-building Windows artifacts is not supported.',
  );
  process.exit(1);
}

const runner = path.join(__dirname, 'run-electron-builder.cjs');
const result = spawnSync(
  process.execPath,
  [runner, '--win', '--x64', '--publish', 'never'],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
