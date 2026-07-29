import { isValidNameError } from 'graphql';

import { esToGraphqlTypeMap } from '../mappingToScalarFields.js';

/** A field or document-type name that graphql-js would reject as a GraphQL identifier, plus why. */
export type InvalidGraphqlName = {
	/** Full dotted path to the field in the mapping (e.g. `biomarkers.ca19-9_level`), or the document type name itself. */
	path: string;
	/** graphql-js's own explanation of why this name is invalid. */
	reason: string;
};

const isGraphqlRelevant = (type: string | undefined): boolean =>
	type === 'object' || type === 'nested' || Object.keys(esToGraphqlTypeMap).includes(type ?? '');

/**
 * Finds every field name (and the catalogue's document type name) that graphql-js's Name grammar
 * would reject, so a broken schema build can name the specific offender instead of surfacing only
 * graphql-js's own opaque parse error. Validates the leaf segment actually used as a GraphQL
 * identifier at each level, not the full dotted path: nested fields are built hierarchically, so a
 * field like `donor.age` never itself becomes a single GraphQL name, only `age` does.
 */
const findInvalidGraphqlNames = ({
	documentType,
	fieldsFromMapping,
}: {
	documentType?: string;
	fieldsFromMapping: { fieldName: string; type?: string }[];
}): InvalidGraphqlName[] => {
	const documentTypeError = documentType ? isValidNameError(documentType) : undefined;
	const documentTypeIssues = documentTypeError
		? [{ path: documentType as string, reason: documentTypeError.message }]
		: [];

	const fieldIssues = fieldsFromMapping.filter(({ type }) => isGraphqlRelevant(type)).flatMap(({ fieldName }) => {
		const leaf = fieldName.split('.').pop() ?? fieldName;
		const error = isValidNameError(leaf);
		return error ? [{ path: fieldName, reason: error.message }] : [];
	});

	return [...documentTypeIssues, ...fieldIssues];
};

export default findInvalidGraphqlNames;
