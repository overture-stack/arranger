import { ES_MAX_LONG } from '#middleware/constants.js';

const isESValueSafeJSInt = (value) =>
(Number.isInteger(value) && !Number.isSafeInteger(value)
    ? ES_MAX_LONG
    : value);

export default isESValueSafeJSInt;
