/**
 * Some overlapping fields with identical types
 * Some individual fields
 * No object type collisions
 */
export const typeDefsA = /* GraphQL */ `
	type Query {
		aggs: Aggs
	}

	type Aggs {
		donors: Donor
	}

	type Donor {
		gender: String
		age: Int
	}
`;

export const typeDefsB = /* GraphQL */ `
	type Query {
		aggs: Aggs
	}

	type Aggs {
		donors: Donor
		analysis: Analysis
		location: String
	}

	type Donor {
		gender: String
	}

	type Analysis {
		type: String
	}
`;

export const typeDefsC = /* GraphQL */ `
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
		date: String
	}
`;

/**
 * No overlapping fields
 */
export const typeDefsD = /* GraphQL */ `
	type Query {
		donor: Donor
	}

	type Donor {
		gender: String
	}
`;

export const typeDefsE = /* GraphQL */ `
	type Query {
		lab: Lab
	}

	type Lab {
		location: String
	}
`;

/**
 * Type collisions
 */
export const typeDefsF = /* GraphQL */ `
	type Aggs {
		donor: Donor
	}

	type Donor {
		gender: String
	}
`;

export const typeDefsG = /* GraphQL */ `
	type Aggs {
		donor: NewDonor
	}

	type NewDonor {
		gender: String
	}
`;
