import { sanitizeGraphqlFlatName } from '@overture-stack/arranger-types/tools';

/**
 * Makes a field name usable in a GraphQL Schema: flattens `.` (nesting) to `__`, and any other
 * character GraphQL disallows in a name to `_`. See `sanitizeGraphqlFlatName` for the full rule.
 */
const convertNameForGraphql = (name: string): string => sanitizeGraphqlFlatName(name);
export default convertNameForGraphql;
