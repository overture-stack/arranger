import _ from 'lodash';

const mapObjectValues = (obj, fn) =>
  _.mapValues(obj, x => (_.isObject(x) ? mapObjectValues(x, fn) : fn(x)));

export default mapObjectValues;
