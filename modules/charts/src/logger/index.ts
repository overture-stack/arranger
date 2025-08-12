/**
 * minimal logger to debug only in dev environment not built library
 */
const makeLogger = () => {
	const log = true ? console.log : () => undefined;
	return { log };
};

export const logger = makeLogger();
