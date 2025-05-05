import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import type { ComponentType } from 'react';

import StyledTooltip from './StyledTooltip.js';

const withTooltip = <Props extends object>(Component: ComponentType<Props>) => {
	return StyledTooltip.withComponent(Component);
};

type HTMLElementTagNames = keyof JSX.IntrinsicElements;

const addTooltip = (element: HTMLElementTagNames) =>
	withTooltip(
		styled(element, {
			shouldForwardProp: isPropValid,
		})``,
	);

export const TooltippedForm = addTooltip('form');
export const TooltippedInput = addTooltip('input');
export const TooltippedLI = addTooltip('li');

export default withTooltip;
