import { Outlet } from 'react-router-dom';
import { SideNavBar } from '../components/SideNavBar';
import { TopNavBar } from '../components/TopNavBar';

export const DashboardLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <SideNavBar />
      <div className="md:ml-64">
        <TopNavBar />
        <main className="pt-24 px-8 pb-12 min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
