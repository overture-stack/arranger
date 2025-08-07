/**
 * minimal logger to debug only in dev environment not built library
 */
const makeLogger = () => {
	const log = process?.env.ARRANGER_CHARTS_DEBUG ? console.log : () => undefined;
	return { log };
};

export const logger = makeLogger();
