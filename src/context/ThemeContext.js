import React, { createContext, useContext, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const colors = {
    // 主色调 - 蓝色系
    primary: '#2196F3',
    primaryDark: '#1976D2',
    primaryLight: '#BBDEFB',
    
    // 辅助色
    secondary: '#03DAC6',
    accent: '#FF4081',
    
    // 状态色
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
    
    // 背景色
    background: isDarkMode ? '#121212' : '#F5F5F5',
    surface: isDarkMode ? '#1E1E1E' : '#FFFFFF',
    
    // 文字色
    text: {
      primary: isDarkMode ? '#FFFFFF' : '#212121',
      secondary: isDarkMode ? '#B3B3B3' : '#757575',
      disabled: isDarkMode ? '#616161' : '#BDBDBD',
    },
    
    // 边框和分割线
    border: isDarkMode ? '#333333' : '#E0E0E0',
    divider: isDarkMode ? '#2A2A2A' : '#EEEEEE',
    
    // 阴影
    shadow: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  };

  const fonts = {
    regular: {
      fontFamily: 'System',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500',
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700',
    },
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
    },
  };

  const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  };

  const borderRadius = {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 50,
  };

  const theme = {
    colors,
    fonts,
    spacing,
    borderRadius,
    isDarkMode,
    setIsDarkMode,
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};