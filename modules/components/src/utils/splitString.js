const QUOTE = '"';

const buildDelimiterMatchers = (split) => {
	const delimiters = new Set((split || []).filter((value) => value !== '\\s'));
	const splitOnWhitespace = (split || []).includes('\\s');

	return {
		isDelimiter: (char) => delimiters.has(char) || (splitOnWhitespace && /\s/.test(char)),
	};
};

export default ({ str, split = [','] }) => {
	if (!str) {
		return [];
	}

	const { isDelimiter } = buildDelimiterMatchers(split);
	const parts = [];
	let current = '';
	let inQuotes = false;

	for (const char of str) {
		if (char === QUOTE) {
			inQuotes = !inQuotes;
			continue;
		}

		if (!inQuotes && isDelimiter(char)) {
			const trimmed = current.trim();
			if (trimmed) {
				parts.push(trimmed);
			}
			current = '';
			continue;
		}

		current += char;
	}

	const trimmed = current.trim();
	if (trimmed) {
		parts.push(trimmed);
	}

	return parts;
};
