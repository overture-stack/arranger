/**
 * Type guard to filter fulfilled Promises
 */
export const isFulfilledPromise = <TResponse>(result: PromiseSettledResult<TResponse>) => {
	return typeof result === 'object' && result !== null && 'status' in result && result.status === 'fulfilled';
};
