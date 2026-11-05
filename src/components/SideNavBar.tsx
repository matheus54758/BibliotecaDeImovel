import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

export const SideNavBar = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const navItems = [
    { name: t('nav.overview'), icon: 'dashboard', path: '/' },
    { name: t('nav.project_developments'), icon: 'corporate_fare', path: '/project-developments' },
    { name: t('nav.developments'), icon: 'apartment', path: '/developments' },
    { name: 'Aluguéis', icon: 'real_estate_agent', path: '/rentals' },
    { name: t('nav.lands'), icon: 'landscape', path: '/lands' },
    { name: t('nav.construction'), icon: 'engineering', path: '/builders' },
    { name: t('nav.consultancy'), icon: 'business_center', path: '/consultancy' },
    { name: t('nav.clients'), icon: 'person_search', path: '/clients' },
    { name: 'Viabilidade (IPTU)', icon: 'explore', path: '/lot-analyzer' },
    { name: 'Personalização', icon: 'palette', path: '/settings/branding' },
  ];

  const isPathActive = (path: string) => {
    const currentPath = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const type = searchParams.get('type');
    
    if (path === '/') return currentPath === '/';
    
    // Projetos (Aba /project-developments)
    if (path === '/project-developments') {
      const isProjectCreation = currentPath === '/developments/new' && type === 'project';
      return currentPath.startsWith('/project-developments') || currentPath.startsWith('/projects') || isProjectCreation;
    }
    
    // Terrenos (Aba /lands)
    if (path === '/lands') {
      return currentPath.startsWith('/lands');
    }
    
    // Aluguéis (Aba /rentals)
    if (path === '/rentals') {
      return currentPath.startsWith('/rentals');
    }
    
    // Imóveis (Aba /developments)
    if (path === '/developments') {
      const isPropertyCreation = currentPath === '/developments/new' && type === 'property';
      return (currentPath.startsWith('/developments') && currentPath !== '/developments/new') || isPropertyCreation;
    }
    
    return currentPath.startsWith(path);
  };

  return (
    <nav className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-low py-5 z-50 border-r border-outline-variant/10">
      <div className="px-6 mb-5 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-on-surface font-headline">{t('nav.ledger')}</h1>
        <p className="text-xs text-on-surface/60 font-body mt-0.5">{t('nav.consultant_pro')}</p>
      </div>
      <div className="flex-1 px-3 pb-6 space-y-1 overflow-y-auto min-h-0">
        {navItems.map((item) => {
          const isActive = isPathActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center px-3.5 py-2.5 rounded-lg transition-colors font-label text-sm",
                isActive
                  ? "text-primary font-bold border-r-4 border-primary bg-surface-container-high"
                  : "text-on-surface/60 hover:bg-surface-container-high"
              )}
            >
              <span className="material-symbols-outlined mr-3 text-[20px] shrink-0">{item.icon}</span>
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
