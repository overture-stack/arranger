import { flattenDeep } from 'lodash';

import replaceBy from './replaceBy';

const initializeExtendedFields = async ({ indexPrefix, fields, config, esClient }) => {
  const mergedFields = fields?.length
    ? replaceBy(fields, config.extended, (x, y) => x.fieldName === y.fieldName)
    : config.extended;

  let body = flattenDeep(
    mergedFields.map((field) => [
      {
        index: {
          _index: indexPrefix,
          _type: indexPrefix,
          _id: field.fieldName,
        },
      },
      JSON.stringify(field),
    ]),
  );

  await esClient.bulk({ body });

  return mergedFields;
};

export default initializeExtendedFields;
