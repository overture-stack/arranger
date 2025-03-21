import type { FC } from 'react';

const getDisplayName = <P extends object>(Component: P) =>
	(Component as FC<P>)?.displayName || (Component as FC<P>)?.name || 'UnnamedComponent';

export default getDisplayName;
