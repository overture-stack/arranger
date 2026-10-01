import includeEverything from './includeEverything.js';

/**
 * The earlier name of `includeEverything`, kept as the same function object so the two cannot drift.
 *
 * @deprecated Use `includeEverything`, or pass the router nothing when a deployment has no access control.
 */
const getDefaultServerSideFilter = includeEverything;

export default getDefaultServerSideFilter;
