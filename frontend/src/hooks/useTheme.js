import { useEffect, useState } from 'react';

const useTheme = () => {
  const [theme, setTheme] = useState('default');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Get config from backend
        const configResponse = await fetch('http://localhost:5174/api/config');
        const config = await configResponse.json();
        const currentTheme = config.theme.current;
        
        setTheme(currentTheme);

        // Load theme CSS
        const cssResponse = await fetch(
          `http://localhost:5174/api/theme/${currentTheme}/css`
        );
        const css = await cssResponse.text();

        // Create style element and inject CSS
        const styleElement = document.createElement('style');
        styleElement.id = 'theme-styles';
        styleElement.textContent = css;
        document.head.appendChild(styleElement);

        console.log(`Theme '${currentTheme}' loaded successfully`);
      } catch (error) {
        console.error('Failed to load theme:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTheme();

    return () => {
      // Cleanup: remove theme styles on unmount
      const styleElement = document.getElementById('theme-styles');
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, []);

  return { theme, loading };
};

export default useTheme;
