import { toNumber } from 'lodash-es';

export default (numOrString) => {
	const n = toNumber(numOrString);

	return isNaN(n) ? numOrString : n.toLocaleString();
};
