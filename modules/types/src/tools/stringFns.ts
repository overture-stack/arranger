export const stringToBool = (str = '', fallback = false) => {
	if (str === undefined) {
		return fallback;
	}

	const lowercasedStr = (str || '').toLocaleLowerCase();
	return lowercasedStr === 'true' || lowercasedStr === '1';
};

export const stringToNumber = (str = '', fallback?: number) => {
	const parsed = str ? Number(str) : NaN;
	return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Parses JSON string into array or returns default of empty array
 *
 * @param str valid JSON string (hopefully)
 * @returns parsed array from string, a fallback value, or an empty array
 */
export const stringToArray = (str = '', fallback: unknown[] = []) => {
	try {
		const parsed = str && JSON.parse(str);
		if (Array.isArray(parsed)) {
			return parsed;
		}
	} catch (err) {
		console.error('Issue in types/stringToArray\n', err);
	}

	return fallback;
};
