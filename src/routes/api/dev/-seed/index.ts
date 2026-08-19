/**
 * Public surface of the demo seed.
 *
 * The route handler in `../seed.ts` imports from here and nothing else, so the dataset and the applier
 * stay free to move around behind it.
 */

export { applySeed, type ApplySeedOptions, type SeedReport } from './apply'
export { SeedBootstrapError } from './bootstrap'
export { DATASET_VERSION } from './dataset'
