import { capitalize } from 'lodash';

export default (type, mapping) =>
  Object.entries(mapping)
    .filter(([, metadata]) => (!metadata.type && metadata.properties) || metadata.type === 'nested')
    .map(
      ([fieldName]) => `
          ${fieldName}: ${type + capitalize(fieldName)}
        `,
    );
