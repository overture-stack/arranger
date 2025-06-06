import { zip, isEmpty } from 'lodash';
import { useRef } from 'react';

const colourTheme = ['#D9367C', '#045093', '#F95D31'];

const ColoursHash = ({ keys, theme }) => {
	// TODO: arrays unequal lengths - repeat? lighten/darken?
	const zipped = zip(keys, theme);
	const hash = new Map(zipped);

	return {
		getColors: ({ data }) => {
			// const h = hash.get(key);
			console.log('x1', hash, data, hash.get(data.key));
			return hash.get(data.key);
		},
	};
};

export const useColors = ({ keys, theme }) => {
	const hash = useRef({});

	if (isEmpty(keys)) {
		return undefined;
	} else if (isEmpty(hash.current)) {
		const ks = keys.map((d) => d.key || '');
		console.log('ks', ks, keys);
		hash.current = ColoursHash({ keys: ks, theme });
	}

	console.log('xxx', hash.current);
	return hash.current;
};
