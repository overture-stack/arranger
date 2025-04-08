export const getCaughtErrorMessage = (error: unknown) => {
	return error instanceof Error ? error.message : JSON.stringify(error);
};
