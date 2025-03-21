import type { Permutations, RecursivePartial } from '#utils/types.js';

// To be used in components.
export interface TooltipThemeProperties {
	tooltipAlign:
		| Permutations<'bottom' | 'left'>
		| Permutations<'bottom' | 'right'>
		| Permutations<'top' | 'left'>
		| Permutations<'top' | 'right'>;
	tooltipFontColor: string;
	tooltipText: string | false;
	tooltipVisibility: 'always' | 'hover' | 'never';
}

export default interface TooltipProps {
	theme?: RecursivePartial<TooltipThemeProperties>;
}
