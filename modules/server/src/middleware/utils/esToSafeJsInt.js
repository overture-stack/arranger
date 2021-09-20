import { ES_MAX_LONG } from '../constants';

export default (x) => (Number.isInteger(x) && !Number.isSafeInteger(x) ? ES_MAX_LONG : x);
