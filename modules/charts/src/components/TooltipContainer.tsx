import { css } from '@emotion/react';
import { PropsWithChildren } from 'react';

export const TooltipContainer = ({ children }: PropsWithChildren<{}>) => {
	return (
		<div
			css={css({
				fontFamily: 'Work Sans, sans-serif',
				fontSize: '11px',
				fontWeight: 'normal',
				fontStyle: 'normal',
				fontStretch: 'normal',
				lineHeight: '1.27',
				letterSpacing: 'normal',
				borderRadius: ' 2px',
				padding: '2px 4px',
				color: 'white',
				maxWidth: '100px',
				maxHeight: '100px',
				background: '#4f546d',

				'&:before': {
					content: '""',
					display: 'block',
					position: 'absolute',
					width: 0,
					height: 0,
					border: '5px solid transparent',
					pointerEvents: 'none',
					right: '50%',
					top: '100%',
					borderTopColor: '#4f546d',
					borderLeft: '5px solid transparent',
					borderRight: '5px solid transparent',
					marginLeft: '-5px',
				},
			})}
		>
			{children}
		</div>
	);
};
