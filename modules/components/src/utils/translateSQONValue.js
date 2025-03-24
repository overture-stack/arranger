import formatNumber from '../utils/formatNumber.js';

export default (value) => {
	if (value === '__missing__') {
		return 'No Data';
	}

	return formatNumber(value);
};
