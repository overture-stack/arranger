import { flattenDeep } from 'lodash';

import esToAggTypeMap from './esToAggTypeMap';

// add two underscores after a value if it's truthy (not an empty string)
// used to create fields representing es paths
// why? because graphql fields cannot contain dots
// diagnoses.treatments 👎
// vs
// diagnoses__treatments 👍
type TAppendUnderscores = (a: string) => string;
const appendUnderscores: TAppendUnderscores = (x) => (x ? x + '__' : '');

const mappingToAggsType = (properties, parent = '') =>
  flattenDeep(
    Object.entries(properties)
      .filter(([fieldName, data]) => data?.properties || data?.type)
      .map(([fieldName, data]) =>
        data?.properties
          ? mappingToAggsType(data.properties, appendUnderscores(parent) + fieldName)
          : `${appendUnderscores(parent) + fieldName}: ${esToAggTypeMap[data.type]}`,
      ),
  );

export default mappingToAggsType;
