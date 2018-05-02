import { startCase } from 'lodash';
import flattenMapping from './flattenMapping';

export const extendFields = fields =>
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
    ...rest,
  }));

export default mapping => extendFields(flattenMapping(mapping));
