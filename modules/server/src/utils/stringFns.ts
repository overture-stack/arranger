export const stringToBool = (str?: string) => {
	return (str || '').toLowerCase() === 'true';

export const stringToNumber = (str?: string) => Number(str || '');
