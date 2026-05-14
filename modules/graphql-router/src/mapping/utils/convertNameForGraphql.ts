/**
 * Makes a field name usable in a GraphQL Schema.
 *
 * This will replace all `.` characters with `__`, which is intended to be used to indicate
 * a nested relationship since GraphQL schemas cannot use `.` characters.
 */
const convertNameForGraphql = (name: string): string => name.split('.').join('__');
export default convertNameForGraphql;
