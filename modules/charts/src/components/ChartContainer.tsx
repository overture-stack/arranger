import { css } from '@emotion/react';
import { PropsWithChildren } from 'react';

/**
 * Use to render response chart correctly in container
 * first element is to set a relative position for the container to it's parent
 * second element is to our charts absolutely positioned in the container for svg elements to render correctly
 * don't pass in wrapper styles here, consumer should account for padding etc
 */
export const ChartContainer = ({ children, height }: PropsWithChildren<{ height?: any }>) => (
	<div css={css({ flex: 1, position: 'relative', height: '100%', width: '100%' })}>
		<div
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				width: '100%',
				height: height || '100%',
			}}
		>
			{children}
		</div>
	</div>
);
