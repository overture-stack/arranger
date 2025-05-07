export const stringToBool = (str?: string) => {
	return (str || '').toLowerCase() === 'true';
};

export const stringToNumber = (str?: string) => Number(str || '');

/**
 * Parses JSON string into array or returns default of empty array
 *
 * @param str valid JSON string
 * @returns parsed array from string or empty array
 */
export const stringToArray = (str?: string) => {
	try {
		const parsed = JSON.parse(str || '');
		return Array.isArray(parsed) ? parsed : [];
	} catch (e) {
		console.error(e);
		return [];
	}
};
