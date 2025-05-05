import type { FC } from 'react';

import { DEBUG } from './config.js';

const getDisplayName = <P extends object>(Component: P) => {
	const displayName = (Component as FC<P>)?.displayName ?? (Component as FC<P>)?.name;

	displayName || (DEBUG && console.log("Component doesn't have a name", Component));

	return displayName ?? 'UnnamedComponent';
};

export default getDisplayName;
