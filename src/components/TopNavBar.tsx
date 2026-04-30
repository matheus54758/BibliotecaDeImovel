import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, NavLink, Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export const TopNavBar = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
  ];

  const navItems = [
    { name: t('nav.overview'), icon: 'dashboard', path: '/' },
    { name: t('nav.developments'), icon: 'apartment', path: '/developments' },
    { name: t('nav.construction'), icon: 'engineering', path: '/builders' },
    { name: t('nav.consultancy'), icon: 'business_center', path: '/consultancy' },
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
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] h-16 glass-panel flex justify-between md:justify-end items-center px-4 md:px-8 z-40 shadow-sm border-b border-surface-container-highest">
        {/* Mobile Logo & Menu Toggle */}
        <div className="flex items-center md:hidden">
          <button 
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 text-on-surface/70 hover:bg-surface-container-highest rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          <span className="ml-3 font-headline font-bold text-lg text-primary">{t('nav.ledger')}</span>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Notifications & Mail (hidden on very small screens) */}
          <div className="hidden sm:flex items-center space-x-2">
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
          </div>
          
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

      {/* Mobile Drawer */}
      <div 
        className={cn(
          "fixed inset-0 bg-on-background/40 backdrop-blur-sm z-[60] transition-opacity md:hidden",
          showMobileMenu ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setShowMobileMenu(false)}
      />
      
      <div 
        ref={mobileMenuRef}
        className={cn(
          "fixed top-0 left-0 h-full w-[280px] bg-surface-container-lowest z-[70] shadow-2xl transition-transform duration-300 md:hidden flex flex-col",
          showMobileMenu ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b border-surface-container-highest flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-primary font-headline">{t('nav.ledger')}</h1>
            <p className="text-xs text-on-surface/50 font-body">{t('nav.consultant_pro')}</p>
          </div>
          <button 
            onClick={() => setShowMobileMenu(false)}
            className="p-2 text-on-surface/50 hover:bg-surface-container-highest rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setShowMobileMenu(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center px-4 py-4 rounded-xl transition-all font-label",
                  isActive
                    ? "text-primary font-bold bg-primary/10 shadow-sm"
                    : "text-on-surface/60 hover:bg-surface-container-high"
                )
              }
            >
              <span className="material-symbols-outlined mr-4 text-2xl">{item.icon}</span>
              <span className="text-base">{item.name}</span>
            </NavLink>
          ))}
        </div>

        <div className="p-6 mt-auto border-t border-surface-container-highest">
          <Link to="/developments/new" onClick={() => setShowMobileMenu(false)}>
            <button className="w-full py-4 px-4 bg-primary text-on-primary rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined">add</span>
              {t('nav.new_development')}
            </button>
          </Link>
        </div>
      </div>
    </>
  );
};
