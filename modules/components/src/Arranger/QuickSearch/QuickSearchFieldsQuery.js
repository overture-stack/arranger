import { capitalize, uniqBy } from 'lodash';
import { compose, withProps } from 'recompose';
import { withQuery } from '../../Query';

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
      extendedFields: { data, loading, error },
      nestedFields = data?.[index]?.extended?.filter(x => x.type === 'nested'),
      quickSearchFields = data?.[index]?.extended
        ?.filter(x => x.quickSearchEnabled)
        ?.map(({ field }) =>
          data?.[index]?.columnsState?.state?.columns?.find(
            y => y.field === field,
          ),
        )
        ?.map(x => ({
          ...x,
          displayName:
            nestedField({ field: x, nestedFields })?.displayName || index,
          nestedPath: nestedField({ field: x, nestedFields })?.field || '',
          gqlField: x.field.split('.').join('__'),
          query: x.query || x.field,
          jsonPath: x.jsonPath || `$.${x.field}`,
        })) || [],
    }) => ({
      quickSearchFields,
      quickSearchEntities: uniqBy(
        quickSearchFields.map(({ nestedPath, displayName }) => ({
          nestedPath,
          displayName,
        })),
        'nestedPath',
      ),
      primaryKeyField: data?.[index]?.extended?.find(x => x.primaryKey),
      nestedFields,
    }),
  ),
);

const QuickSearchFieldsQuery = ({
  render,
  quickSearchFields,
  quickSearchEntities,
  primaryKeyField,
  nestedFields,
}) =>
  render({
    quickSearchFields,
    quickSearchEntities,
    primaryKeyField,
    nestedFields,
    enabled: primaryKeyField && quickSearchFields?.length,
  });

export default enhance(QuickSearchFieldsQuery);
