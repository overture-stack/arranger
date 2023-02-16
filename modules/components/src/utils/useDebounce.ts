import { useState, useEffect } from 'react';

const useDebounce = (value: any, delay = 500) => {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		// Set debouncedValue to value (passed in) after the specified delay
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [delay, value]);

	return debouncedValue;
};

export default useDebounce;
