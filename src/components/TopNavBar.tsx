import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export const TopNavBar = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
  ];

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setShowLangMenu(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="hidden md:flex fixed top-0 right-0 w-[calc(100%-16rem)] h-16 glass-panel justify-end items-center px-8 z-40 shadow-sm">
      <div className="flex items-center space-x-4">
        {/* Language Switcher, Notifications, etc. */}
        <button 
          className="text-on-surface/70 hover:bg-surface-container-highest p-2 rounded-full transition-colors focus:ring-2 focus:ring-primary/20"
          title={t('notifications')}
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button 
          className="text-on-surface/70 hover:bg-surface-container-highest p-2 rounded-full transition-colors focus:ring-2 focus:ring-primary/20"
          title={t('messages')}
        >
          <span className="material-symbols-outlined">mail</span>
        </button>
        
        {/* Language Switcher */}
        <div className="relative" ref={langMenuRef}>
          <button 
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="text-on-surface/70 hover:bg-surface-container-highest p-2 rounded-full transition-colors focus:ring-2 focus:ring-primary/20 flex items-center justify-center"
            title={t('language')}
          >
            <span className="material-symbols-outlined">language</span>
          </button>
          
          {showLangMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden py-1">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-container-high transition-colors flex items-center space-x-3 ${
                    i18n.language.startsWith(lang.code) ? 'text-primary font-bold bg-primary/5' : 'text-on-surface'
                  }`}
                >
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative" ref={userMenuRef}>
          <div 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-low cursor-pointer outline outline-2 outline-surface-container-low hover:outline-primary/30 transition-all"
          >
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuARRebqbHieEmiIJRBFPnMXkkoEbkex5xyW5aVBcy5UewncPNXRsHBA3nSAoLzhQ-PSdsf8pHpuT2gjPSGWrID-ns_vQewv5g8h7mN7qrZd8FGI8HHJ15UKyjBOPBcnGMVpbrjU8W60zye5wOE9Pfllhm4Ra72A-D22fIJInkfMaqupqYeHHnLMqVUgo1of9DvbIh-jrINcvADGUAICPpzzgluR_cO6prPkTd8pZESeKPqN6wqBKAgCT9fSQJGhRaCx58OqHw042aWD"
              alt="Consultant avatar"
              className="w-full h-full object-cover"
            />
          </div>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden py-1">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-error hover:bg-error/5 transition-colors flex items-center space-x-3"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                <span>Sair da conta</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
