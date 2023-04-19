import { capitalize, uniq } from 'lodash';
import { compose, withProps } from 'recompose';

import { withQuery } from '@/Query';

import { decorateFieldWithColumnsState } from './QuickSearchQuery';

const nestedField = ({ field, nestedFields }) =>
	nestedFields?.find((x) => x.fieldName === field.fieldName?.split('.').slice(0, -1).join('.'));

const enhance = compose(
	withQuery(({ index }) => ({
		key: 'extendedFields',
		endpoint: `graphql/${capitalize(index)}QuickSearchExtendedQuery`,
		query: `
      query ${capitalize(index)}QuickSearchExtendedQuery {
        ${index} {
          configs {
            extended
            table {
              columns {
                fieldName
                query
                jsonPath
              }
            }
          }
        }
      }
    `,
	})),
	withProps(
		({
			allowlist,
			extendedFields: { data, loading, error },
			index,
			nestedFields = data?.[index]?.configs?.extended?.filter((x) => x.type === 'nested'),
			quickSearchFields = data?.[index]?.configs?.extended
				?.filter((x) => x.quickSearchEnabled)
				?.filter((x) => {
					const {
						fieldName: parentField = '',
					} = //defaults to "" because a root field's parent would evaluate to such
						nestedField({
							nestedFields,
							field: x,
						}) || {};
					return allowlist?.includes?.(parentField) || true;
				})
				?.map(({ fieldName }) =>
					decorateFieldWithColumnsState({
						tableConfigs: data?.[index]?.configs?.table,
						fieldName,
					}),
				)
				?.map((x) => ({
					...x,
					entityName: nestedField({ field: x, nestedFields })?.fieldName || index,
				})) || [],
		}) => {
			return {
				quickSearchFields,
				quickSearchEntities: uniq(quickSearchFields),
				primaryKeyField: decorateFieldWithColumnsState({
					tableConfigs: data?.[index]?.configs?.table,
					fieldName: data?.[index]?.configs?.extended?.find((x) => x.primaryKey)?.fieldName,
				}),
				nestedFields,
			};
		},
	),
);

const QuickSearchFieldsQuery = ({
	apiFetcher,
	primaryKeyField,
	queryFields,
	quickSearchEntities,
	quickSearchFields,
	render,
}) => {
	return render({
		apiFetcher,
		enabled: primaryKeyField && quickSearchFields?.length,
		primaryKeyField,
		queryFields: queryFields || quickSearchFields,
		quickSearchEntities,
		quickSearchFields,
	});
};

export default enhance(QuickSearchFieldsQuery);
