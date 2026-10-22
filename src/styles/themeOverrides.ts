import { GlobalThemeOverrides } from 'naive-ui';

// Floating panels, on the same palette as the cards they sit over
const popover = {
  color: 'var(--blue)',
  textColor: 'var(--white)',
  borderRadius: '8px',
  fontSize: '0.875rem',
  padding: '8px 12px',
  boxShadow: '0 0 0 1px #354f6b, 0 4px 12px rgb(0 0 0 / 35%)',
};

export const themeOverrides: GlobalThemeOverrides = {
  common: {
    cardColor: 'rgba(41, 77, 115, 0.5)',
    fontSize: '1rem',
    lineHeight: '1.4',
  },
  Avatar: {
    color: 'transparent',
  },
  Card: {
    actionColor: 'transparent',
    borderRadius: '8px',
  },
  Drawer: {
    color: 'var(--dark-blue)',
  },
  Switch: {
    railColorActive: 'var(--success)',
  },
  Popover: popover,
  // Tooltips are popovers wearing their own theme
  Tooltip: { peers: { Popover: popover } },
  Checkbox: {
    colorChecked: 'var(--blue)',
    checkMarkColor: 'var(--success)',
    border: '1px solid var(--blue)',
    borderChecked: '1px solid var(--blue)',
  },
  Tabs: {
    tabFontSizeLarge: '1.12rem',
    tabFontWeight: '600',
    tabFontWeightActive: '600',
    tabColor: 'var(--blue)',
    tabTextColorLine: '--light-grey',
    tabTextColorHoverLine: 'var(--white)',
    tabTextColorActiveLine: 'var(--white)',
    tabBorderColor: 'var(--blue)',
    barColor: 'var(--white)',
  },
};
