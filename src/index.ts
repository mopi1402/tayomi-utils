// The root barrel: every domain, one import path. Safe to import broadly because the package
// declares sideEffects: false and holds no module-level state, so a bundler keeps only what a
// consumer actually calls. The per-domain subpaths (@tayomi/utils/process, /io, /ansi) expose the
// same functions for consumers who want a narrow door; both paths are the public contract, the
// file layout underneath is not.

export * from './process/index.js';
export * from './io/index.js';
export * from './ansi/index.js';
