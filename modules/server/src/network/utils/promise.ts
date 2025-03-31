/**
 * Type guard to filter fulfilled Promises
 */
export const fulfilledPromiseFilter = <Result>(result: unknown): result is Result => {
	return (
		typeof result === 'object' &&
		result !== null &&
		'status' in result &&
		result.status === 'fulfilled'
	);
};
