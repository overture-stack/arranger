export const CONNECTION_STATUS = {
	OK: 'OK',
	ERROR: 'ERROR',
} as const;

/*
 * Querying from resolvers remote connections
 */

export type NetworkNode = {
	name: string;
	hits: number;
	status: keyof typeof CONNECTION_STATUS;
	errors: string;
	aggregations: { name: string; type: string }[];
};
