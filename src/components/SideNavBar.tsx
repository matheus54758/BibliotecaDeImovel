import { NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

export const SideNavBar = () => {
  const { t } = useTranslation();

  const navItems = [
    { name: t('nav.overview'), icon: 'dashboard', path: '/' },
    { name: t('nav.developments'), icon: 'apartment', path: '/developments' },
    { name: t('nav.construction'), icon: 'engineering', path: '/builders' },
    { name: t('nav.consultancy'), icon: 'business_center', path: '/consultancy' },
  ];

  return (
    <nav className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-low py-8 z-50">
      <div className="px-8 mb-12">
        <h1 className="text-xl font-bold tracking-tight text-on-surface font-headline">{t('nav.ledger')}</h1>
        <p className="text-sm text-on-surface/60 font-body">{t('nav.consultant_pro')}</p>
      </div>
      <div className="flex-1 px-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center px-4 py-3 transition-colors font-label",
                isActive
                  ? "text-primary font-bold border-r-4 border-primary bg-surface-container-high"
                  : "text-on-surface/60 hover:bg-surface-container-high"
              )
            }
          >
            <span className="material-symbols-outlined mr-3">{item.icon}</span>
            {item.name}
          </NavLink>
        ))}
      </div>
      <div className="px-6 mt-auto">
        <Link to="/developments/new">
          <button className="w-full py-3 px-4 bg-gradient-primary text-on-primary rounded-md font-label font-medium hover:opacity-90 transition-opacity text-center">
            {t('nav.new_development')}
          </button>
        </Link>
      </div>
    </nav>
  );
};
