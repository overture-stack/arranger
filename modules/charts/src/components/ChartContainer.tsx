import { css } from '@emotion/react';
import { PropsWithChildren } from 'react';

/**
 * Use to render response chart correctly in container
 * TODO: revisit - is this needed ? grow charts to surrounding container as a lot of charts need fixed dimensions
 */
export const ChartContainer = ({ children, height, chartStyle }: PropsWithChildren<{ height?: any }>) => (
	<div css={css({ flex: 1, position: 'relative' }, chartStyle)}>
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
