import { extendTheme } from '@mui/joy/styles';

/**
 * Two looks for the app:
 * - 'paper' (default): for the Daylight DC-1's reflective, monochrome LivePaper screen.
 *   Black on white, state shown by borders/weight/icons rather than color, no shadows,
 *   no blurred backdrops, larger type and touch targets.
 * - 'color': the original terracotta/sage palette (same sizing).
 * The choice is per device (localStorage), see ThemeChoiceContext.
 */
export type ThemeChoice = 'paper' | 'color';

// Sizing shared by both looks: bigger type and 44px+ touch targets.
const fontSize = {
  xs: '0.875rem',
  sm: '1rem',
  md: '1.125rem',
  lg: '1.25rem',
  xl: '1.375rem',
  xl2: '1.625rem',
  xl3: '2rem',
  xl4: '2.5rem',
};

const sizing = {
  JoyButton: {
    styleOverrides: {
      root: ({ ownerState }: { ownerState: { size?: string } }) => ({
        minHeight: ownerState.size === 'sm' ? 40 : ownerState.size === 'lg' ? 52 : 44,
      }),
    },
  },
  JoyIconButton: {
    styleOverrides: {
      root: ({ ownerState }: { ownerState: { size?: string } }) => ({
        minHeight: ownerState.size === 'sm' ? 40 : 44,
        minWidth: ownerState.size === 'sm' ? 40 : 44,
      }),
    },
  },
  JoyInput: { styleOverrides: { root: { minHeight: 44 } } },
  JoySelect: { styleOverrides: { root: { minHeight: 44 } } },
  JoyCheckbox: { defaultProps: { size: 'lg' as const } },
  JoyRadio: { defaultProps: { size: 'lg' as const } },
};

const colorTheme = extendTheme({
  fontSize,
  colorSchemes: {
    light: {
      palette: {
        primary: {
          50: '#fef2f1', 100: '#fde3e0', 200: '#fcc9c5', 300: '#f8a39a', 400: '#f27063',
          500: '#BB5C4F', 600: '#a34034', 700: '#88342a', 800: '#712d25', 900: '#5f2822',
        },
        neutral: {
          50: '#f5f7f4', 100: '#e9ede7', 200: '#d4dbd1', 300: '#b3c0af', 400: '#8fa188',
          500: '#5C7658', 600: '#4a5f46', 700: '#3d4e3a', 800: '#344131', 900: '#2d382a',
        },
        success: {
          50: '#f4f8f3', 100: '#e8f1e5', 200: '#d1e3cc', 300: '#AEC8A4', 400: '#8fb37f',
          500: '#6f9a5f', 600: '#5a7d4c', 700: '#4a653f', 800: '#3e5335', 900: '#34462d',
        },
        background: {
          body: '#EFE4D2', surface: '#ffffff', level1: '#f9f5ed', level2: '#f3ebe0', level3: '#e8dccb',
        },
      },
    },
  },
  components: sizing,
});

// One ink, one paper, one light grey for pressed/selected fills. Every palette maps to it,
// so "danger" or "success" never relies on hue (the DC-1 shows none).
const ink = '#000';
const paper = '#fff';
const tint = '#e6e6e6'; // the only fill, for hover/pressed/soft
const greys = {
  50: '#f7f7f7', 100: '#eeeeee', 200: '#e6e6e6', 300: '#bdbdbd', 400: '#8a8a8a',
  500: '#000000', 600: '#000000', 700: '#000000', 800: '#000000', 900: '#000000',
};
const inkPalette = {
  ...greys,
  plainColor: ink,
  plainHoverBg: tint,
  plainActiveBg: '#d0d0d0',
  plainDisabledColor: '#8a8a8a',
  outlinedColor: ink,
  outlinedBorder: ink,
  outlinedHoverBg: tint,
  outlinedActiveBg: '#d0d0d0',
  outlinedDisabledColor: '#8a8a8a',
  outlinedDisabledBorder: '#bdbdbd',
  softColor: ink,
  softBg: tint,
  softHoverBg: '#d6d6d6',
  softActiveBg: '#c6c6c6',
  softDisabledColor: '#8a8a8a',
  softDisabledBg: '#f2f2f2',
  solidColor: paper,
  solidBg: ink,
  solidHoverBg: '#262626',
  solidActiveBg: '#404040',
  solidDisabledColor: '#ffffff',
  solidDisabledBg: '#8a8a8a',
};

const noShadow = { boxShadow: 'none' };
const noBlurBackdrop = { backdrop: { backdropFilter: 'none', backgroundColor: 'rgba(0, 0, 0, 0.35)' } };

const statusMarks: Record<string, string> = { danger: '!', warning: '!', success: '✓' };
const statusBox = (color?: string) => {
  const mark = color ? statusMarks[color] : undefined;
  return {
    ...noShadow,
    border: `${color === 'danger' ? 3 : 2}px solid ${ink}`,
    backgroundColor: paper,
    color: ink,
    fontWeight: 500,
    ...(mark && {
      '&::before': {
        content: `"${mark}"`,
        flex: 'none',
        width: 24,
        height: 24,
        borderRadius: '50%',
        backgroundColor: ink,
        color: paper,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
      },
    }),
  };
};

const paperTheme = extendTheme({
  fontSize,
  fontWeight: { sm: 400, md: 500, lg: 600, xl: 700 },
  radius: { xs: '2px', sm: '4px', md: '6px', lg: '8px', xl: '12px' },
  shadow: { xs: 'none', sm: 'none', md: 'none', lg: 'none', xl: 'none' },
  focus: {
    default: { outlineOffset: 2, outline: `3px solid ${ink}` },
  },
  colorSchemes: {
    light: {
      shadowRing: '0 0 #000',
      shadowChannel: '0 0 0',
      palette: {
        primary: inkPalette,
        neutral: inkPalette,
        success: inkPalette,
        warning: inkPalette,
        danger: inkPalette,
        text: { primary: ink, secondary: '#1a1a1a', tertiary: '#333333', icon: ink },
        background: {
          body: paper, surface: paper, popup: paper, level1: paper, level2: '#f2f2f2', level3: tint,
          tooltip: ink, backdrop: 'rgba(0, 0, 0, 0.35)',
        },
        divider: ink,
        focusVisible: ink,
      },
    },
  },
  components: {
    ...sizing,
    JoyModal: { styleOverrides: noBlurBackdrop },
    // Panels appear in place instead of sliding (the slide smears on the reflective screen)
    JoyDrawer: { styleOverrides: { ...noBlurBackdrop, root: { '--Drawer-transitionDuration': '0ms' } } },
    JoySheet: { styleOverrides: { root: noShadow } },
    JoyCard: {
      styleOverrides: {
        root: ({ ownerState }: { ownerState: { variant?: string } }) => ({
          ...noShadow,
          ...(ownerState.variant !== 'solid' && ownerState.variant !== 'plain' && { borderWidth: 2, borderColor: ink, backgroundColor: paper }),
        }),
      },
    },
    JoyModalDialog: { styleOverrides: { root: { ...noShadow, border: `2px solid ${ink}` } } },
    JoyMenu: { styleOverrides: { root: { ...noShadow, border: `2px solid ${ink}` } } },
    JoyButton: {
      styleOverrides: {
        root: ({ ownerState }: { ownerState: { size?: string; variant?: string } }) => ({
          minHeight: ownerState.size === 'sm' ? 40 : ownerState.size === 'lg' ? 52 : 44,
          fontWeight: 600,
          ...(ownerState.variant === 'outlined' && { borderWidth: 2 }),
          ...(ownerState.variant === 'soft' && { boxShadow: `inset 0 0 0 1px ${ink}` }),
        }),
      },
    },
    JoyIconButton: {
      styleOverrides: {
        root: ({ ownerState }: { ownerState: { size?: string; variant?: string } }) => ({
          minHeight: ownerState.size === 'sm' ? 40 : 44,
          minWidth: ownerState.size === 'sm' ? 40 : 44,
          ...(ownerState.variant === 'outlined' && { borderWidth: 2 }),
          ...(ownerState.variant === 'soft' && { boxShadow: `inset 0 0 0 1px ${ink}` }),
        }),
      },
    },
    JoyInput: { styleOverrides: { root: { minHeight: 44, ...noShadow, borderWidth: 2, '--Input-focusedThickness': '3px' } } },
    JoyTextarea: { styleOverrides: { root: { ...noShadow, borderWidth: 2, '--Textarea-focusedThickness': '3px' } } },
    JoySelect: { styleOverrides: { root: { minHeight: 44, ...noShadow, borderWidth: 2, '--Select-focusedThickness': '3px' }, listbox: { ...noShadow, border: `2px solid ${ink}` } } },
    JoyCheckbox: {
      defaultProps: { size: 'lg' as const },
      styleOverrides: { checkbox: { borderWidth: 2, borderColor: ink } },
    },
    JoyRadio: {
      defaultProps: { size: 'lg' as const },
      styleOverrides: { radio: { borderWidth: 2, borderColor: ink } },
    },
    JoyChip: {
      styleOverrides: {
        root: ({ ownerState }: { ownerState: { variant?: string } }) => ({
          ...(ownerState.variant !== 'solid' && { boxShadow: `inset 0 0 0 1.5px ${ink}`, backgroundColor: paper }),
        }),
      },
    },
    // Alerts and toasts all share one ink, so the kind is spelled out with a leading mark
    JoyAlert: { styleOverrides: { root: ({ ownerState }: { ownerState: { color?: string } }) => statusBox(ownerState.color) } },
    JoyLinearProgress: { styleOverrides: { root: { color: ink, backgroundColor: paper, border: `1.5px solid ${ink}` } } },
    JoyDivider: { styleOverrides: { root: { '--Divider-thickness': '1.5px' } } },
    JoyTooltip: { styleOverrides: { root: noShadow } },
    JoySnackbar: { styleOverrides: { root: ({ ownerState }: { ownerState: { color?: string } }) => statusBox(ownerState.color) } },
    JoyTabs: { styleOverrides: { root: { backgroundColor: 'transparent' } } },
  },
});

export const themes = { paper: paperTheme, color: colorTheme };
