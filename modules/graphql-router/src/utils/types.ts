/**
 * const CONNECTION_STATUS = {
 *   OK: 'OK',
 *   ERROR: 'ERROR'
 * } as const;
 *
 * type ConnectionStatus = ObjectValues<typeof CONNECTION_STATUS>; // 'OK' | 'ERROR'
 *
 */
export type ObjectValues<T> = T[keyof T];
