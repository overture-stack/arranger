import { ThemeCommon } from '@/ThemeContext/types';
import { Permutations } from '@/utils/types';

// To be used in components.
interface TooltipThemeProperties {
	tooltipAlign:
		| Permutations<'bottom' | 'left'>
		| Permutations<'bottom' | 'right'>
		| Permutations<'top' | 'left'>
		| Permutations<'top' | 'right'>;
	tooltipVisibility: 'always' | 'hover' | 'never';
	tooltipText: string | false;
}

export default interface TooltipProperties {
	theme?: Partial<TooltipThemeProperties>;
}
