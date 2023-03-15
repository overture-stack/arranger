import { css } from '@emotion/react';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import TooltipProps from './types';

/**
 * @param tooltipVisibilty: Use it to provide conditional display
 */
const StyledTooltip = styled('div', {
	shouldForwardProp: isPropValid,
})<TooltipProps>`
	${({
		theme: {
			tooltipAlign = 'top',
			tooltipFontColor = '#333',
			tooltipText = '',
			tooltipVisibility = 'hover',
		},
	}) => {
		if (tooltipText && typeof tooltipText === 'string') {
			const isBottom = tooltipAlign.includes('bottom');
			const isLeft = tooltipAlign.includes('left');
			const isRight = tooltipAlign.includes('right');
			const isTop = tooltipAlign.includes('top');

			// long enough to not remain centred over the arrow
			const isLongEnough = tooltipText.length > 6;

			const visibleByDefault = ['always'].includes(tooltipVisibility);
			const visibleOnHover = ['always', 'hover'].includes(tooltipVisibility);

			// Look and position of arrow
			const arrowBorder = isBottom
				? 'transparent transparent #d4b943 transparent'
				: isTop
				? '#d4b943 transparent transparent transparent'
				: isLeft
				? 'transparent transparent transparent #d4b943'
				: 'transparent #d4b943 transparent transparent'; // isRight
			const arrowX = isBottom || isTop ? '-50%' : isLeft ? '-100%' : '0'; // isRight
			const arrowY = isTop ? '-0.8rem' : isBottom ? '0.8rem' : 0; // isRight

			// position of box
			const boxX =
				isBottom || isTop
					? isLeft && isLongEnough
						? 'calc(10px - 95%)'
						: isRight && isLongEnough
						? 'calc(-10px - 5%)'
						: '-50%' // too short or left centred on purpose
					: isLeft
					? 'calc(-100% - 1.2rem)'
					: '1.2rem'; // isRight
			const boxY = isTop ? 'calc(-15px - 70%)' : isBottom ? 'calc(15px + 70%)' : 0;

			return css`
				position: relative;
				transition: 0s opacity;

				&:hover::after,
				&:hover::before {
					opacity: ${Number(visibleOnHover)};
					transition-delay: 0.3s;
				}

				&::after,
				&::before {
					cursor: default;
					left: 50%;
					opacity: ${Number(visibleByDefault)};
					position: absolute;
					transition: 0.1s;
					z-index: 100000;
				}

				&::before {
					background-color: #fef4c5;
					border: 1px solid #d4b943;
					border-radius: 2px;
					color: ${tooltipFontColor};
					content: '${tooltipText}';
					display: block;
					font-size: 13px;
					font-weight: normal;
					line-height: 15px;
					padding: 3px;
					text-align: left;
					transform: translate(${boxX}, ${boxY});
					white-space: pre;
				}

				&::after {
					border: 10px solid #d4b943;
					border-color: ${arrowBorder};
					content: '';
					transform: translate(${arrowX}, ${arrowY});
				}
			`;
		}
		return;
	}}
`;

export default StyledTooltip;
