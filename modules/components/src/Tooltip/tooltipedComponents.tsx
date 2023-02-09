import { ComponentType } from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import StyledTooltip from './StyledTooltip';

const withTooltip = <Props extends object>(Component: ComponentType<Props>) => {
	return StyledTooltip.withComponent(Component);
};

type HTMLElementTagNames = keyof HTMLElementTagNameMap;

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
