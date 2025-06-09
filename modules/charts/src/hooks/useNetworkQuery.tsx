import { useEffect, useState } from 'react';
import { DataContextInterface } from '@overture-stack/arranger-components';
import { get } from 'lodash';

const AggregationsQuery = (fieldName) => `
  ${fieldName}
  {
    bucket_count
    buckets {
      doc_count
      key
    }
  }
`;

const NumericAggregationsQuery = (field) => ``;

const resolveGQLResponse = ({ fieldName, documentType, gqlResponse }) => {
	return get(gqlResponse, ['data', documentType, 'aggregations', fieldName]);
};

const createQueryResolver =
	({ documentType }: { documentType: string }) =>
	({ fields }: { fields: string[] }) => {
		const fullQuery = `
    query ChartsQuery($filters: JSON) {
      ${documentType} {
        aggregations(
          filters: $filters
          include_missing: true
          aggregations_filter_themselves: true
        ) {
          ${fields.map((fieldName) => AggregationsQuery(fieldName))}
        }
      }
    }`;

		return fullQuery;
	};

type UseNetworkQueryProps = Pick<DataContextInterface, 'documentType' | 'apiFetcher' | 'sqon'>;

export const useNetworkQuery = ({ documentType, apiFetcher, sqon }: UseNetworkQueryProps) => {
	const [fields, setFields] = useState(new Set());
	const [apiState, setApiState] = useState({ data: null, loading: false, error: false });

	const queryResolver = createQueryResolver({ documentType });

	const fetchData = async () => {
		try {
			setApiState((previous) => ({ ...previous, loading: true }));
			const data = await apiFetcher({
				body: {
					query: queryResolver({ fields: Array.from(fields) }),
				},
			});
			setApiState((previous) => ({ ...previous, data }));
		} catch (err) {
			setApiState((previous) => ({ ...previous, error: true }));
		} finally {
			setApiState((previous) => ({ ...previous, loading: false }));
		}
	};

	useEffect(() => {
		fetchData();
	}, [fields, sqon, apiFetcher]);

	return {
		apiState,
		addToQuery: ({ fieldName }: { fieldName: string }) => {
			setFields((previous) => {
				const newSet = new Set(previous);
				newSet.add(fieldName);
				return newSet;
			});
		},
		removeFromQuery: ({ fieldName }: { fieldName: string }) => {
			setFields((previous) => {
				const newSet = new Set(previous);
				newSet.delete(fieldName);
				return newSet;
			});
		},
	};
};
