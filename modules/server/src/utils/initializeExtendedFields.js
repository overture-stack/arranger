import { flattenDeep } from 'lodash';

import replaceBy from './replaceBy';

const initializeExtendedFields = async ({ indexPrefix, fields, config, es }) => {
  const mergedFields = fields?.length
    ? replaceBy(fields, config.extended, (x, y) => x.field === y.field)
    : config.extended;

  let body = flattenDeep(
    mergedFields.map((f) => [
      {
        index: {
          _index: indexPrefix,
          _type: indexPrefix,
          _id: f.field,
        },
      },
      JSON.stringify(f),
    ]),
  );

  await es.bulk({ body });

  return mergedFields;
};

export default initializeExtendedFields;
