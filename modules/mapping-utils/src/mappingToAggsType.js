import { flattenDeep } from 'lodash';
import esToAggTypeMap from './esToAggTypeMap';

// add two underscores after a value if it's truthy (not an empty string)
// used to create fields representing es paths
// why? because graphql fields cannot contain dots
// diagnoses.treatments 👎
// vs
// diagnoses__treatments 👍
type TappendUnderscores = (a: string) => string;
let appendUnderscores: TappendUnderscores = x => (x ? x + '__' : '');

let mappingToAggsType = (properties, parent = '') => {
  return flattenDeep(
    Object.entries(properties)
      .filter(
        ([field, data]) =>
          (data.type && data.type !== 'nested') || data.properties,
      )
      .map(
        ([field, data]) =>
          data.type && data.type !== 'nested'
            ? `${appendUnderscores(parent) + field}: ${
                esToAggTypeMap[data.type]
              }`
            : mappingToAggsType(
                data.properties,
                appendUnderscores(parent) + field,
              ),
      ),
  );
};
export default mappingToAggsType;
