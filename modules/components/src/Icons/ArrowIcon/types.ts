import { ThemeCommon } from '@/ThemeContext/types';

export interface ArrowIconThemeProps extends ThemeCommon.CustomCSS {
  fill: string;
  size: string | number;
  transition: string;
}

export default interface Props extends Partial<ArrowIconThemeProps> {
  isTreeJoint?: boolean;
  pointUp?: boolean;
}
