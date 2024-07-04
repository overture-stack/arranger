import { buildSchema } from 'graphql';

/**
 * At no point do we modify the type definitions within the tests
 */
const typeDefsA = /* GraphQL */ `
	type Query {
		aggs: Aggs
	}

	type Aggs {
		donors: Donor
	}

	type Donor {
		gender: String
	}
`;

const typeDefsB = /* GraphQL */ `
	type Query {
		aggs: Aggs
	}

	type Aggs {
		donors: Donor
		analysis: Analysis
	}

	type Donor {
		gender: String
	}

	type Analysis {
		type: String
	}
`;

const networkSchemas = [buildSchema(typeDefsA), buildSchema(typeDefsB)];

export { networkSchemas };
