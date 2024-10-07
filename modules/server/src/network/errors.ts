export class NetworkAggregationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'NetworkAggregationError';
	}
}

type ErrorWithMessage = {
	message: string;
};

const isErrorWithMessage = (error: unknown): error is ErrorWithMessage => {
	return (
		typeof error === 'object' &&
		error !== null &&
		'message' in error &&
		typeof (error as Error).message === 'string'
	);
};

const getErrorMessage = (error: unknown): string => {
	if (isErrorWithMessage(error)) {
		return error.message;
	} else {
		return 'Unknown error';
	}
};
