import { capitalize, uniq } from 'lodash';
import { compose, withProps } from 'recompose';
import { withQuery } from '../../Query';

import { decorateFieldWithColumnsState } from './QuickSearchQuery';

const nestedField = ({ field, nestedFields }) =>
  nestedFields.find(
    x =>
      x.field ===
      field.field
        .split('.')
        .slice(0, -1)
        .join('.'),
  );

const enhance = compose(
  withQuery(({ index, projectId }) => ({
    projectId,
    key: 'extendedFields',
    query: `
      query ${capitalize(index)}ExtendedQuery {
        ${index} {
          extended
          columnsState {
            state {
              columns {
                field
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
      index,
      whitelist,
      extendedFields: { data, loading, error },
      nestedFields = data?.[index]?.extended?.filter(x => x.type === 'nested'),
      quickSearchFields = data?.[index]?.extended
        ?.filter(x => x.quickSearchEnabled)
        ?.filter(x => {
          const { field: parentField = '' } = //defaults to "" because a root field's parent would evaluate to such
            nestedField({
              nestedFields,
              field: x,
            }) || {};
          return whitelist ? whitelist.includes(parentField) : true;
        })
        ?.map(({ field }) =>
          decorateFieldWithColumnsState({
            columnsState: data?.[index]?.columnsState?.state,
            field,
          }),
        )
        ?.map(x => ({
          ...x,
          entityName:
            nestedField({ field: x, nestedFields })?.displayName || index,
        })) || [],
    }) => {
      return {
        quickSearchFields,
        quickSearchEntities: uniq(quickSearchFields.map(x => x.entityName)),
        primaryKeyField: decorateFieldWithColumnsState({
          columnsState: data?.[index]?.columnsState?.state,
          field: data?.[index]?.extended?.find(x => x.primaryKey)?.field,
        }),
        nestedFields,
      };
    },
  ),
);

const QuickSearchFieldsQuery = ({
  render,
  quickSearchFields,
  quickSearchEntities,
  primaryKeyField,
}) =>
  render({
    quickSearchFields,
    quickSearchEntities,
    primaryKeyField,
    enabled: primaryKeyField && quickSearchFields?.length,
  });

export default enhance(QuickSearchFieldsQuery);
