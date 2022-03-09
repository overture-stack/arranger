import { common, blueGrey as grey, purple, red, orange, lightBlue as blue, green } from './colours';
import { deepMerge } from './utils';

export interface Color {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  A100: string;
  A200: string;
  A400: string;
  A700: string;
}

export const light = {
  // The colors used to style the text.
  text: {
    // The most important text.
    primary: 'rgba(0, 0, 0, 0.87)',
    // Secondary text.
    secondary: 'rgba(0, 0, 0, 0.6)',
    // Disabled text have even lower visual prominence.
    disabled: 'rgba(0, 0, 0, 0.38)',
  },
  // The color used to divide different elements.
  divider: 'rgba(0, 0, 0, 0.12)',
  // The background colors used to style the surfaces.
  // Consistency between these values is important.
  background: {
    paper: common.white,
    default: common.white,
  },
  // The colors used to style the action elements.
  action: {
    // The color of an active action like an icon button.
    active: 'rgba(0, 0, 0, 0.54)',
    // The color of an hovered action.
    hover: 'rgba(0, 0, 0, 0.04)',
    hoverOpacity: 0.04,
    // The color of a selected action.
    selected: 'rgba(0, 0, 0, 0.08)',
    selectedOpacity: 0.08,
    // The color of a disabled action.
    disabled: 'rgba(0, 0, 0, 0.26)',
    // The background color of a disabled action.
    disabledBackground: 'rgba(0, 0, 0, 0.12)',
    disabledOpacity: 0.38,
    focus: 'rgba(0, 0, 0, 0.12)',
    focusOpacity: 0.12,
    activatedOpacity: 0.12,
  },
};

export const dark = {
  text: {
    primary: common.white,
    secondary: 'rgba(255, 255, 255, 0.7)',
    disabled: 'rgba(255, 255, 255, 0.5)',
    icon: 'rgba(255, 255, 255, 0.5)',
  },
  divider: 'rgba(255, 255, 255, 0.12)',
  background: {
    paper: '#121212',
    default: '#121212',
  },
  action: {
    active: common.white,
    hover: 'rgba(255, 255, 255, 0.08)',
    hoverOpacity: 0.08,
    selected: 'rgba(255, 255, 255, 0.16)',
    selectedOpacity: 0.16,
    disabled: 'rgba(255, 255, 255, 0.3)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)',
    disabledOpacity: 0.38,
    focus: 'rgba(255, 255, 255, 0.12)',
    focusOpacity: 0.12,
    activatedOpacity: 0.24,
  },
};

const getDefaultError = (mode = 'light') =>
  mode === 'dark'
    ? {
        main: red[500],
        light: red[300],
        dark: red[700],
      }
    : {
        main: red[700],
        light: red[400],
        dark: red[800],
      };

const getDefaultInfo = (mode = 'light') =>
  mode === 'dark'
    ? {
        main: blue[400],
        light: blue[300],
        dark: blue[700],
      }
    : {
        main: blue[700],
        light: blue[500],
        dark: blue[900],
      };

const getDefaultPrimary = (mode = 'light') =>
  mode === 'dark'
    ? {
        main: grey[200],
        light: grey[50],
        dark: grey[400],
      }
    : {
        main: grey[700],
        light: grey[400],
        dark: grey[800],
      };

const getDefaultSecondary = (mode = 'light') =>
  mode === 'dark'
    ? {
        main: purple[200],
        light: purple[50],
        dark: purple[400],
      }
    : {
        main: purple[500],
        light: purple[300],
        dark: purple[700],
      };

const getDefaultSuccess = (mode = 'light') =>
  mode === 'dark'
    ? {
        main: green[400],
        light: green[300],
        dark: green[700],
      }
    : {
        main: green[800],
        light: green[500],
        dark: green[900],
      };

const getDefaultWarning = (mode = 'light') =>
  mode === 'dark'
    ? {
        main: orange[400],
        light: orange[300],
        dark: orange[700],
      }
    : {
        main: '#ed6c02', // closest to orange[800] that pass 3:1.
        light: orange[500],
        dark: orange[900],
      };

const blankDefaults = {
  mode: 'light',
  error: undefined,
  info: undefined,
  primary: undefined,
  secondary: undefined,
  success: undefined,
  warning: undefined,
};

export default function createPalette({ mode, ...other } = blankDefaults) {
  const paletteOutput = deepMerge(
    {
      common,
      mode,
      error: other.error || getDefaultError(mode),
      info: other.info || getDefaultInfo(mode),
      primary: other.primary || getDefaultPrimary(mode),
      secondary: other.secondary || getDefaultSecondary(mode),
      success: other.success || getDefaultSuccess(mode),
      warning: other.warning || getDefaultWarning(mode),
      grey,
      ...{ dark, light }[mode],
    },
    other,
  );

  return paletteOutput;
}

export * as colours from './colours';
