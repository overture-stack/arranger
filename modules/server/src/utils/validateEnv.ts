export const validatePositiveNumber = (name: string, str: string | undefined) => {
	const value = Number(str || '');
	if (value > 0) {
		return value;
	} else {
		throw Error(`${name} value is invalid.`);
	}
};
