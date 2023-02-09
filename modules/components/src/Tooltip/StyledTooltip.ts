import { css } from '@emotion/react';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import TooltipProperties from './types';

/**
 * @param tooltipVisibilty: Use it to provide conditional display
 */
const StyledTooltip = styled('div', {
	shouldForwardProp: isPropValid,
})<TooltipProperties>`
	${({ theme: { tooltipAlign = 'top', tooltipText = '', tooltipVisibility = 'hover' } }) => {
		if (tooltipText && typeof tooltipText === 'string') {
			const isLongEnough = tooltipText.length > 6;
			const isBottom = tooltipAlign.includes('bottom');
			const isLeft = tooltipAlign.includes('left');
			const isRight = tooltipAlign.includes('right');
			const isTop = tooltipAlign.includes('top');

			const visibleByDefault = ['always'].includes(tooltipVisibility);
			const visibleOnHover = ['always', 'hover'].includes(tooltipVisibility);

			const arrowBorder = isBottom
				? 'transparent transparent #d4b943 transparent'
				: isTop
				? '#d4b943 transparent transparent transparent'
				: isLeft
				? 'transparent transparent transparent #d4b943'
				: 'transparent #d4b943 transparent transparent'; // isRight
			const arrowX = isBottom || isTop ? '-50%' : isLeft ? '-100%' : '0'; // isRight
			const arrowY = isTop ? '-0.8rem' : isBottom ? '0.8rem' : 0; // isRight
			const mainX =
				isBottom || isTop
					? isLeft && isLongEnough
						? 'calc(10px - 95%)'
						: isRight && isLongEnough
						? 'calc(-10px - 5%)'
						: '-50%' // short or centred
					: isLeft
					? 'calc(-100% - 1.2rem)'
					: '1.2rem'; // isRight
			const mainY = isTop ? 'calc(-1.1rem - 70%)' : isBottom ? 'calc(1.1rem + 70%)' : 0;

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
					content: '${tooltipText}';
					display: block;
					font-size: 13px;
					font-weight: normal;
					padding: 3px;
					text-align: left;
					transform: translate(${mainX}, ${mainY});
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
