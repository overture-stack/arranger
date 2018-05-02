import { startCase } from 'lodash';
import flattenMapping from './flattenMapping';

export const extendFields = ({ fields, includeOriginal = false }) =>
  fields.map(({ field, type, ...rest }) => ({
    field,
    type,
    displayName: startCase(field.replace(/\./g, ' ')),
    active: false,
    isArray: false,
    primaryKey: false,
    quickSearchEnabled: false,
    unit: null,
    displayValues: {},
    ...(includeOriginal && { ...rest }),
  }));

export default mapping => extendFields({ fields: flattenMapping(mapping) });
