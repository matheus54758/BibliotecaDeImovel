import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ThemeConfig {
  primary_color: string;
  banner_url: string | null;
  company_name: string | null;
}

interface ThemeContextType {
  theme: ThemeConfig;
  updateTheme: (newTheme: Partial<ThemeConfig>) => Promise<void>;
  loading: boolean;
}

const defaultTheme: ThemeConfig = {
  primary_color: '#D4AF37',
  banner_url: null,
  company_name: null,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTheme();
  }, []);

  useEffect(() => {
    // Aplicar cor primária globalmente via CSS Variable
    document.documentElement.style.setProperty('--color-primary', theme.primary_color);
    
    // Gerar uma versão mais escura para o container (exemplo simplificado: escurecendo 15%)
    // Em uma implementação real, usaríamos uma lib de cores, mas aqui vamos simular
    const containerColor = theme.primary_color === '#D4AF37' ? '#B8860B' : theme.primary_color;
    document.documentElement.style.setProperty('--color-primary-container', containerColor);
  }, [theme.primary_color]);

  async function fetchTheme() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('theme_config')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data?.theme_config) {
        setTheme({ ...defaultTheme, ...data.theme_config });
      }
    } catch (error) {
      console.error('Error fetching theme:', error);
    } finally {
      setLoading(false);
    }
  }

  const updateTheme = async (newTheme: Partial<ThemeConfig>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updatedTheme = { ...theme, ...newTheme };
      const { error } = await supabase
        .from('profiles')
        .update({ theme_config: updatedTheme })
        .eq('id', user.id);

      if (error) throw error;
      setTheme(updatedTheme);
    } catch (error) {
      console.error('Error updating theme:', error);
      throw error;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
