import { toNumber } from 'lodash';

export default numOrString => {
  const n = toNumber(numOrString);
  return isNaN(n) ? numOrString : n.toLocaleString();
};
