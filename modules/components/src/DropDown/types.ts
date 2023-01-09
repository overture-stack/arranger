import { ThemedButtonProps } from '@/Button/types';
import { ThemeCommon } from '@/ThemeContext/types';

export interface DropDownThemeProps extends ThemedButtonProps {
  arrowColor: string;
  arrowTransition: string;

  // Child components
  ListWrapper: ThemeCommon.NonButtonThemeProps &
    ThemeCommon.BoxModelHoverProperties &
    ThemeCommon.FontHoverProperties & {
      maxHeight: string;
      width: string;
    };
  SelectionControls: ThemedButtonProps;
}

export interface DropDownProps extends ThemeCommon.CustomCSS {
  theme?: Partial<DropDownThemeProps>;
}
