import Button from '#Button/index.js';
import MetaMorphicChild from '#MetaMorphicChild/index.js';

import type { SingleDownloadButtonProps } from './types.js';

const SingleDownloadButton = ({
	className,
	clickHandler,
	disabled,
	exporterLabel: Label = 'Download',
	theme,
}: SingleDownloadButtonProps) => {
	return (
		<Button className={className} disabled={disabled || !clickHandler} onClick={clickHandler} theme={theme}>
			<MetaMorphicChild>{Label}</MetaMorphicChild>
		</Button>
	);
};

export default SingleDownloadButton;
