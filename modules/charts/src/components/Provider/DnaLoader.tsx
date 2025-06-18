import { css } from '@emotion/react';
import range from 'lodash/range';

const dotsCount = 5;

export const DnaLoader = () => (
	<div
		css={css`
			display: flex;
			flex: 1;
			align-items: center;
			justify-content: center;

			div:nth-of-type(odd) {
				position: absolute;
			}
			div:nth-of-type(even) {
				width: ${dotsCount * 10}px;
			}
			span {
				display: inline-block;
				position: relative;
				width: 10px;
				height: 10px;
				background-color: white;
				border-radius: 50%;
				transform: scale(0, 0);
			}

			${range(1, dotsCount + 1).map(
				(i) => css`
					div:nth-of-type(odd) span:nth-of-type(${i}) {
						animation: animateFirstDots 0.8s ease-in-out infinite;
						animation-direction: alternate;
						animation-delay: ${i * 0.2}s;
					}
					div:nth-of-type(even) span:nth-of-type(${i}) {
						animation: animateSecondDots 0.8s ease-in-out infinite;
						animation-direction: alternate-reverse;
						animation-delay: ${i * 0.2}s;
					}
				`,
			)}

			@keyframes animateFirstDots {
				0% {
					transform: translateY(200%) scale(0.7, 0.7);
					background-color: #24dbb4;
				}
				100% {
					transform: translateY(-200%) scale(1, 1);
					background-color: #0774d3;
				}
			}
			@keyframes animateSecondDots {
				0% {
					transform: translateY(200%) scale(0.7, 0.7);
					background-color: #f95d31;
				}
				100% {
					transform: translateY(-200%) scale(1, 1);
					background-color: #fea430;
				}
			}
		`}
	>
		<div>
			{range(0, dotsCount).map((i) => (
				<span key={i} />
			))}
		</div>
		<div>
			{range(0, dotsCount).map((i) => (
				<span key={i} />
			))}
		</div>
	</div>
);
