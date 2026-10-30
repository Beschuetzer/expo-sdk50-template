export const MODAL_BLUR_VIEW_COLOR = '#000000bb';
const tintColorLight = '#2f95dc';
const tintColorDark = '#fff';
const buttonBackgrounds = [
  '#1769aa',
  '#18794e',
  '#6b3fa0',
  '#b42318',
  '#006d77',
  '#9a4d00',
  '#344e9b',
  '#a61b5b',
  '#475569',
  '#7a2e0e',
  '#365314',
  '#5b21b6',
  '#0e7490',
  '#86198f',
  '#1d4ed8',
] as const;

export const COLORS = {
  light: {
    buttonBackgrounds,
    text: '#000',
    background: '#fff',
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
    muted: '#888',
    selected: '#27AE60',
    disabled: '#ccc',
    border: '#ccc',
    noteBackground: '#FFFBEB',
  },
  dark: {
    buttonBackgrounds,
    text: '#fff',
    background: '#000',
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
    muted: '#888',
    selected: '#27AE60',
    disabled: '#ccc',
    border: '#222',
    noteBackground: '#FFFBEB',
  },
};
