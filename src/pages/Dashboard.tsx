import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";

export const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const [metrics, setMetrics] = useState({ builders: 0, projects: 0, leads: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch counts filtered by user_id
        const { count: builderCount } = await supabase
          .from('builders')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        const { count: projectCount } = await supabase
          .from('developments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        
        setMetrics({
          builders: builderCount || 0,
          projects: projectCount || 0,
          leads: 0, // Placeholder
        });
        setActivities([]);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="p-8 text-on-surface/50 font-body">{t('dashboard.updating')}</div>;
  }

  return (
    <>
      <div className="mb-12">
        <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight mb-2">
          {t('dashboard.title')}
        </h2>
        <p className="text-on-surface/70 font-body text-lg">
          {t('dashboard.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <MetricCard title={t('dashboard.metrics.total_builders')} value={metrics.builders} icon="engineering" />
        <MetricCard title={t('dashboard.metrics.active_projects')} value={metrics.projects} icon="apartment" />
        <MetricCard title={t('dashboard.metrics.new_leads')} value={metrics.leads} icon="groups" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="bg-surface-container-low rounded-xl p-8">
          <h3 className="text-2xl font-headline font-bold text-on-surface mb-8">{t('dashboard.recent_activities')}</h3>
          <div className="space-y-6">
            {activities.length > 0 ? (
              activities.map((act) => (
                <ActivityItem 
                  key={act.id}
                  title={act.type} 
                  desc={act.description} 
                  time={new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                  icon="description" 
                  iconColor="text-primary" 
                  bgColor="bg-primary/10"
                />
              ))
            ) : (
              <p className="text-on-surface/50 text-sm italic">{t('dashboard.no_activities')}</p>
            )}
          </div>
        </div>

        <div className="space-y-12">
          <div className="relative h-full min-h-[300px] rounded-xl overflow-hidden shadow-sm group">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuARfqYK0_5hhdnG0x7Z8Q0XZ0lla3gZZakkJrLNPJRz9j8pUUFNkNti6OXzuHJ9cYZfjrYt-Zi0UC7Yb_HEEtIr-PAu4-phI8BMNj1eh4vj28zzi9EI8tvTTglgAVRtW1Y5tzweh_WDsbicnBg4ykskWyro-sNA93Ty4-Mf8NcRcJ2N1zqScK8-mVMRdxEToL0WDczgLQ4LWJu_J-P2lfgU1hd1cUHIyP16IwjCIhE7nmydcpc5jyUIF3JDQQMtsyUPaP9NGLRySvWL"
              alt="Featured Property"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-on-surface/80 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 p-6 glass-panel border-t border-white/10 m-4 rounded-lg">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs font-bold text-primary tracking-wider uppercase mb-1">{t('dashboard.featured_label')}</p>
                  <h4 className="text-xl font-headline font-bold text-on-surface">{t('dashboard.featured_title')}</h4>
                </div>
                <button className="bg-white/20 hover:bg-white/30 text-primary p-2 rounded-full backdrop-blur-md transition-colors">
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const MetricCard = ({ title, value, icon }: any) => (
  <div className="bg-surface-container-lowest rounded-xl p-8 hover:bg-surface-bright transition-colors duration-300 relative overflow-hidden group sunken-shadow">
    <div className="relative z-10">
      <p className="text-on-surface/60 font-label text-sm uppercase tracking-wider mb-2">{title}</p>
      <p className="text-5xl font-headline font-bold text-on-surface mb-4">{value}</p>
    </div>
    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
      <span className="material-symbols-outlined text-9xl">{icon}</span>
    </div>
  </div>
);

const ActivityItem = ({ title, desc, time, icon, iconColor, bgColor }: any) => (
  <div className="flex items-start bg-surface-container-lowest p-5 rounded-lg hover:shadow-md transition-shadow">
    <div className={`${bgColor} p-3 rounded-full mr-4`}>
      <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
    </div>
    <div className="flex-1">
      <p className="font-body font-medium text-on-surface">{title}</p>
      <p className="text-sm text-on-surface/60 mt-1">{desc}</p>
    </div>
    <span className="text-xs text-on-surface/50 font-label">{time}</span>
  </div>
);

const MeetingItem = ({ date, month, title, time }: any) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between mb-4 border-b border-surface-container-high pb-4 last:border-0 last:pb-0">
      <div className="flex items-center">
        <div className="w-12 h-12 bg-surface-container-low rounded flex flex-col items-center justify-center mr-4">
          <span className="text-xs font-bold text-primary uppercase">{month}</span>
          <span className="text-lg font-bold text-on-surface leading-none">{date}</span>
        </div>
        <div>
          <p className="font-body font-semibold text-on-surface">{title}</p>
          <p className="text-sm text-on-surface/60">{time}</p>
        </div>
      </div>
      <button 
        className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors"
        title={t('common.more')}
      >
        <span className="material-symbols-outlined">more_vert</span>
      </button>
    </div>
  );
};
