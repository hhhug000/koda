import { useEffect, useState } from 'react';
import * as Monaco from 'monaco-editor';

export const useMonacoTheme = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Fetch Monaco theme JSON from backend
        const response = await fetch('http://localhost:5174/api/theme/default/monaco');
        const themeData = await response.json();

        // Use Monaco's native defineTheme
        Monaco.editor.defineTheme('koda-theme', themeData);
        console.log('Monaco theme loaded successfully');
        setIsReady(true);
      } catch (error) {
        console.error('Failed to load Monaco theme:', error);
        setIsReady(false);
      }
    };

    loadTheme();
  }, []);

  return isReady;
};

export default useMonacoTheme;
