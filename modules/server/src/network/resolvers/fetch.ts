import axios, { AxiosError } from 'axios';
import { DocumentNode } from 'graphql';

import { NetworkQueryVariables } from '.';
import { fetchGql } from '../gql';
import { failure, Result, success } from '../result';
import { ASTtoString } from '../utils/gql';
import { CONNECTION_STATUS } from './aggregations';

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
export const fetchData = async <SuccessType>(
	query: NetworkQuery,
): Promise<Result<SuccessType, typeof CONNECTION_STATUS.ERROR>> => {
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
		if (response.status === 200 && response.statusText === 'OK') {
			console.log(`Fetch data completing for ${query.url}`);
			return success(responseData);
		}
	} catch (error) {
		if (axios.isCancel(error)) {
			console.log(`Fetch data cancelled for ${query.url}`);
			return failure(CONNECTION_STATUS.ERROR, `Request cancelled: ${url}`);
		}

		if (axios.isAxiosError(error)) {
			const errorResponse = error as AxiosError<{ errors: { message: string }[] }>;

			if (errorResponse.code === 'ECONNREFUSED') {
				console.error(`Network failure: ${url}`);
				return failure(CONNECTION_STATUS.ERROR, `Network failure: ${url}`);
			}

			if (error.response) {
				const errors =
					errorResponse.response &&
					errorResponse.response.data.errors.map((gqlError) => gqlError.message).join('\n');
				console.error(errors);
				return failure(CONNECTION_STATUS.ERROR, 'errors');
			}
		}
		return failure(CONNECTION_STATUS.ERROR, `Unknown error`);
	}
	// TS would like a return value outside of try/catch handling
	return failure(CONNECTION_STATUS.ERROR, `Unknown error`);
};
