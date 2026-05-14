import axios, { type AxiosError } from 'axios';
import { type DocumentNode } from 'graphql';

import { fetchGql } from '#network/gql.js';
import { type NetworkQueryVariables } from '#network/resolvers/index.js';
import { type AsyncResult, failure, success } from '#network/result.js';
import { ASTtoString } from '#network/utils/gql.js';

type NetworkQuery = {
	url: string;
	gqlQuery: DocumentNode;
	queryVariables: NetworkQueryVariables;
};

/**
 * Query remote connections and handle network responses
 *
 * @param query
 * @returns
 */
export const fetchData = async <SuccessType>(query: NetworkQuery): AsyncResult<SuccessType> => {
	const { url, gqlQuery, queryVariables } = query;

	console.log(`Fetch data starting for ${url}..`);

	try {
		const response = await fetchGql({
			url,
			gqlQuery: ASTtoString(gqlQuery),
			variables: queryVariables,
		});

		// axios response "data" field, graphql response "data" field
		const responseData = response.data?.data;
		if (response.status === 200) {
			console.log(`Fetch data completing for ${query.url}`);
			return success(responseData);
		}

		// We shouldn't end up here, since axios should throw an error if the status is not 200
		return failure(`Network request failed with status ${response.status}`);
	} catch (error) {
		if (axios.isCancel(error)) {
			console.log(`Fetch data cancelled for ${query.url}`);
			return failure(`Request cancelled: ${url}`);
		}

		if (axios.isAxiosError(error)) {
			const errorResponse = error as AxiosError<{ errors: { message: string }[] }>;

			if (errorResponse.code === 'ECONNREFUSED') {
				console.error(`Network failure: ${url}`);
				return failure(`Network failure: ${url}`);
			}

			if (errorResponse.response) {
				const errors = errorResponse.response.data.errors.map((gqlError) => gqlError.message).join('\n');
				console.error(errors);
				return failure('errors');
			}
		}
		return failure(`Unknown error`);
	}
};
