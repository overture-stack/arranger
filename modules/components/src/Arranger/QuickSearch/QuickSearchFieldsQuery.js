import { capitalize, uniq } from 'lodash';
import { compose, withProps } from 'recompose';

import { withQuery } from '../../Query';

import { decorateFieldWithColumnsState } from './QuickSearchQuery';

const nestedField = ({ field, nestedFields }) =>
  nestedFields.find(
    (nestedField) => nestedField.fieldName === field.fieldName.split('.').slice(0, -1).join('.'),
  );

const enhance = compose(
  withQuery(({ index }) => ({
    key: 'extendedFields',
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
      index,
      whitelist,
      extendedFields: { data, loading, error },
      nestedFields = data?.[index]?.configs?.extended?.filter((field) => field.type === 'nested'),
      quickSearchFields = data?.[index]?.configs?.extended
        ?.filter((field) => field.quickSearchEnabled)
        ?.filter((field) => {
          const {
            fieldName: parentFieldName = '', // defaults to "" because a root field would have no parent, and therefor no name.
          } =
            nestedField({
              nestedFields,
              fieldName: field,
            }) || {};
          return whitelist ? whitelist.includes(parentFieldName) : true;
        })
        ?.map(({ fieldName }) =>
          decorateFieldWithColumnsState({
            tableConfigs: data?.[index]?.configs?.table,
            fieldName,
          }),
        )
        ?.map((field) => ({
          ...field,
          entityName: nestedField({ field, nestedFields })?.displayName || index,
        })) || [],
    }) => {
      return {
        quickSearchFields,
        quickSearchEntities: uniq(quickSearchFields.map((x) => x.entityName)),
        primaryKeyField: decorateFieldWithColumnsState({
          tableConfigs: data?.[index]?.configs?.tableConfigs,
          fieldName: data?.[index]?.configs?.extended?.find((x) => x.primaryKey)?.fieldName,
        }),
        nestedFields, // TODO: unused?
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
