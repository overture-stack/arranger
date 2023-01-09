import { ThemeCommon } from '@/ThemeContext/types';

export interface ArrowIconThemeProps extends ThemeCommon.CustomCSS {
  disabledFill: string;
  fill: string;
  size: string | number;
  transition: string;
}

export default interface Props extends Partial<ArrowIconThemeProps> {
  disabled?: boolean;
  isTreeJoint?: boolean;
  pointUp?: boolean;
}
