import { startCase } from 'lodash';
import flattenMapping from './flattenMapping';

export default mapping =>
  flattenMapping(mapping).map(({ field, type }) => ({
    field,
    type,
    displayName: startCase(field.replace(/\./g, ' ')),
    active: false,
    isArray: false,
    primaryKey: false,
    quickSearchEnabled: false,
    unit: null,
    displayValues: {},
  }));
