export class NetworkAggregationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'NetworkAggregationError';
	}
}
