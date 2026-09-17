export const theme = {
  colors: {
    background: '#0D0D12',
    surface: '#1A1A22',
    surfaceHighlight: '#262632',
    primary: '#00F0FF', // Electric Blue accent
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0AB',
    border: '#2A2A36',
    tabBarBackground: '#12121A',
    tabBarInactive: '#6E6E7A',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    title: {
      fontSize: 24,
      fontWeight: 'bold' as const,
      color: '#FFFFFF',
    },
    subtitle: {
      fontSize: 16,
      color: '#A0A0AB',
    },
    body: {
      fontSize: 14,
      color: '#FFFFFF',
    },
  },
};

export type Theme = typeof theme;
