import { startCase } from 'lodash'
import mappingToAggsType from './mappingToAggsType';

export default mapping =>
  mappingToAggsType(mapping)
    .map(field => field.split(':').map(x => x.trim()))
    .map(([field, type]) => ({
      field,
      type,
      displayName: startCase(field.replace(/__/g, ' ')),
      active: false,
      allowedValues: [],
      restricted: false,
    }));
