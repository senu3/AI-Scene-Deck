exports.default = async function beforePack(context) {
  const info = context.packager.info;

  // electron-builder 26.x uses `npm list` with `shell: true` in its npm collector.
  // On the current toolchain, that path can produce empty stdout and break packaging.
  // Force the traversal collector so packaging stays reproducible in local builds.
  info.getPackageManager = async () => 'traversal';
  info.getWorkspaceRoot = async () => undefined;
};
