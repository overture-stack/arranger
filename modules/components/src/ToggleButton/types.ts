import type { SerializedStyles } from '@emotion/react';
import type { FC, HTMLProps } from 'react';

import type { ThemedButtonProps } from '#Button/types.js';
import type { RecursivePartial } from '#utils/types.js';

export interface Option {
	disabled?: boolean;
	title?: FC<{ toggleStatus?: string } | undefined>;
	value: string;
}

export interface ToggleButtonThemeProps extends ThemedButtonProps {
	OptionCSS: SerializedStyles;
}

export default interface Props extends Omit<HTMLProps<HTMLButtonElement>, 'onChange'> {
	onChange?: ({ value }: { value: string }) => any;
	options: Option[];
	theme?: RecursivePartial<ToggleButtonThemeProps>;
	value: string;
}
