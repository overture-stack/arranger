import Button from '@/Button';
import MetaMorphicChild from '@/MetaMorphicChild';

import { SingleDownloadButtonProps } from './types';

const SingleDownloadButton = ({
	className,
	clickHandler,
	disabled,
	exporterLabel: Label = 'Download',
}: SingleDownloadButtonProps) => {
	return (
		<Button className={className} disabled={disabled || !clickHandler} onClick={clickHandler}>
			<MetaMorphicChild>{Label}</MetaMorphicChild>
		</Button>
	);
};

export default SingleDownloadButton;
