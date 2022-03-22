import { startCase } from 'lodash';
import flattenMapping from './flattenMapping';

export const extendFields = (fields) =>
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
    rangeStep: ['double', 'float', 'half_float', 'scaled_float'].includes(type) ? 0.01 : 1,
    ...rest,
  }));

export default (mapping) => extendFields(flattenMapping(mapping));
