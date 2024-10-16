import SQONBuilder from '@overture-stack/sqon-builder';

export const isSQONFilter = (filter: unknown) => {
	// An error will be thrown if the provided input is invalid.
	SQONBuilder.from(filter);
};
