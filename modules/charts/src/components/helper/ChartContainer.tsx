import { PropsWithChildren } from 'react';

/**
 * Use to render response chart correctly in container
 * TODO: revisit - is this needed ? grow charts to surrounding container as a lot of charts need fixed dimensions
 */
export const ChartContainer = ({ children, height }: PropsWithChildren<{ height?: any }>) => (
	<div style={{ flex: 1, position: 'relative' }}>
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
