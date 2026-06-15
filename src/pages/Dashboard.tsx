import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useUserTier } from "../hooks/useUserTier";
import { formatCurrency } from "../lib/utils";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const Dashboard = () => {
  const { t } = useTranslation();
  const { tier, loading: tierLoading, refresh } = useUserTier();
  const [activities, setActivities] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    builders: 0,
    projects: 0,
    units: 0,
    properties: 0
  });
  const [loading, setLoading] = useState(true);
  const [showPricing, setShowPricing] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string, qr_code_base64: string, copy_paste: string } | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch Stats
        const [buildersRes, developmentsRes] = await Promise.all([
          supabase.from('builders').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('developments').select('id, parent_id, builder_id').eq('user_id', user.id)
        ]);

        const devData = developmentsRes.data || [];
        const projects = devData.filter(d => d.parent_id === null && d.builder_id !== null).length;
        const units = devData.filter(d => d.parent_id !== null).length;
        const properties = devData.filter(d => d.parent_id === null && d.builder_id === null).length;

        setStats({
          builders: buildersRes.count || 0,
          projects,
          units,
          properties
        });

        // 2. Fetch Revenue for Chart
        const { data: revenue } = await supabase
          .from('revenue_tracking')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        
        setRevenueData(revenue || []);

        // 3. Fetch Activities
        const recentActivities: any[] = [];

        // Latest Additions
        const { data: latestProp } = await supabase
          .from('developments')
          .select('id, title, created_at, hero_image_url, parent_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        latestProp?.forEach(p => {
          recentActivities.push({
            id: p.id,
            type: 'addition',
            label: p.parent_id ? 'Nova Unidade' : 'Novo Imóvel/Projeto',
            description: p.title,
            created_at: p.created_at,
            image: p.hero_image_url,
            icon: 'add_circle',
            color: 'bg-emerald-500/10 text-emerald-500'
          });
        });

        setActivities(recentActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    }

    if (!tierLoading) {
      setLoading(false);
      fetchDashboardData();
    }
  }, [tierLoading, t]);

  const chartData = {
    labels: revenueData.map(d => d.month_year.split(' de ')[0]), // Pega só o mês
    datasets: [
      {
        fill: true,
        label: 'Receita Mensal',
        data: revenueData.map(d => d.total_revenue),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        pointRadius: 6,
        pointBackgroundColor: 'rgb(59, 130, 246)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => formatCurrency(context.raw)
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatCurrency(value)
        },
        grid: { color: 'rgba(0,0,0,0.05)' }
      },
      x: { grid: { display: false } }
    }
  };

  // Polling para verificar se o pagamento foi aprovado
  useEffect(() => {
    let interval: any;
    if (pixData && tier === 'free') {
      interval = setInterval(() => {
        refresh();
      }, 5000); // Checa a cada 5 segundos
    }

    if (tier === 'paid' && pixData) {
      setPixData(null);
      alert("Pagamento aprovado! Seu acesso Premium foi liberado.");
    }

    return () => clearInterval(interval);
  }, [pixData, tier, refresh]);

  const handleUpgrade = async (priceId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priceId })
      });

      const { url, error } = await response.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (error) {
      console.error("Error creating checkout session:", error);
      alert("Falha ao iniciar processo de pagamento.");
    }
  };

  const handlePixUpgrade = async (priceId: string, amount: number, description: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setLoading(true);
      const { data, error } = await supabase.functions.invoke('create-mercadopago-payment', {
        body: { priceId, amount, description }
      });

      if (error) throw error;
      setPixData(data);
      setShowPricing(false);
    } catch (error) {
      console.error("Error creating PIX payment:", error);
      alert("Falha ao gerar código PIX.");
    } finally {
      setLoading(false);
    }
  };

  const handleShareShowcase = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const baseUrl = window.location.href.split('#')[0];
      const showcaseUrl = `${baseUrl}#/vitrine/${user.id}`;
      
      await navigator.clipboard.writeText(showcaseUrl);
      alert("Link da sua Vitrine copiado para a área de transferência!");
    } catch (err) {
      console.error("Erro ao copiar link:", err);
    }
  };

  if (loading) {
    return <div className="p-8 text-on-surface/50 font-body">{t('dashboard.updating')}</div>;
  }

  return (
    <>
      {showPricing && (
        <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-4xl w-full sunken-shadow relative">
            <button 
              onClick={() => setShowPricing(false)}
              className="absolute top-6 right-6 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <h2 className="text-3xl font-headline font-bold text-center mb-4">Escolha seu Plano</h2>
            <p className="text-on-surface-variant text-center mb-12">Libere todo o potencial do Lumis com nossos planos premium.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Plano Mensal */}
              <div className="bg-surface-container-low p-8 rounded-xl border border-surface-container-high flex flex-col h-full">
                <h3 className="text-xl font-headline font-bold mb-2">Plano Mensal</h3>
                <p className="text-3xl font-headline font-black text-primary mb-6">R$ 39,90<span className="text-sm font-normal text-on-surface-variant">/mês</span></p>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                    Construtoras Ilimitadas
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                    Imóveis Ilimitados
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                    Flexibilidade para cancelar
                  </li>
                </ul>
                <div className="space-y-3">
                  <button 
                    onClick={() => handleUpgrade('price_1TcE0jII9Ml3L1z01fvzbffM')}
                    className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">credit_card</span>
                    Cartão Mensal
                  </button>
                  <button 
                    onClick={() => handlePixUpgrade('monthly', 39.90, 'Plano Mensal - Lumis')}
                    className="w-full bg-surface-container-highest text-on-surface py-3 rounded-lg font-bold hover:opacity-80 transition-opacity flex items-center justify-center gap-2 border border-outline-variant"
                  >
                    <span className="material-symbols-outlined text-sm">qr_code</span>
                    Pagar com PIX
                  </button>
                </div>
              </div>

              {/* Plano Anual */}
              <div className="bg-primary/5 p-8 rounded-xl border-2 border-primary flex flex-col h-full relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Melhor Valor</div>
                <h3 className="text-xl font-headline font-bold mb-2">Plano Anual</h3>
                <p className="text-3xl font-headline font-black text-primary mb-6">R$ 399,90<span className="text-sm font-normal text-on-surface-variant">/ano</span></p>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                    Economia de 2 meses
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                    Tudo do plano mensal
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                    Suporte Prioritário
                  </li>
                </ul>
                <div className="space-y-3">
                  <button 
                    onClick={() => handleUpgrade('price_1TcE3oII9Ml3L1z0fSe97jVw')}
                    className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">credit_card</span>
                    Cartão Anual
                  </button>
                  <button 
                    onClick={() => handlePixUpgrade('annual', 399.90, 'Plano Anual - Lumis')}
                    className="w-full bg-surface-container-highest text-on-surface py-3 rounded-lg font-bold hover:opacity-80 transition-opacity flex items-center justify-center gap-2 border border-outline-variant"
                  >
                    <span className="material-symbols-outlined text-sm">qr_code</span>
                    Pagar com PIX
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {pixData && (
        <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-md w-full sunken-shadow relative text-center">
            <button 
              onClick={() => setPixData(null)}
              className="absolute top-6 right-6 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <h2 className="text-2xl font-headline font-bold mb-6">Pague com PIX</h2>
            
            <div className="bg-white p-4 rounded-xl inline-block mb-6 shadow-inner border border-outline-variant">
              <img 
                src={`data:image/jpeg;base64,${pixData.qr_code_base64}`} 
                alt="PIX QR Code" 
                className="w-48 h-48"
              />
            </div>
            
            <p className="text-sm text-on-surface/70 mb-4 font-body">Escaneie o QR Code acima ou copie o código abaixo:</p>
            
            <div className="bg-surface-container-low p-3 rounded-lg flex items-center gap-3 mb-6 border border-outline-variant">
              <code className="text-[10px] break-all flex-1 text-left font-mono">{pixData.copy_paste}</code>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(pixData.copy_paste);
                  alert("Código copiado!");
                }}
                className="p-2 bg-primary text-on-primary rounded-md shrink-0"
                title="Copiar código"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
              </button>
            </div>
            
            <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
              <p className="text-xs text-primary font-bold flex items-center justify-center gap-2 uppercase tracking-widest">
                <span className="material-symbols-outlined text-sm">sync</span>
                Aguardando Pagamento...
              </p>
              <p className="text-[10px] text-on-surface/50 mt-1">Sua conta será ativada automaticamente após o pagamento.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight mb-2">
            Dashboard
          </h2>
          <p className="text-on-surface/70 font-body text-lg">
            Bem-vindo de volta! Aqui está um resumo do seu portfólio.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleShareShowcase}
            className="flex items-center gap-2 px-6 py-2 rounded-full font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20 shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">share</span>
            Compartilhar Vitrine
          </button>
          <div className={`px-4 py-2 rounded-full font-label text-sm font-bold uppercase tracking-widest ${tier === 'paid' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
            {tier === 'paid' ? 'Premium' : 'Gratuito'}
          </div>
          {tier === 'free' && (
            <button 
              onClick={() => setShowPricing(true)}
              className="bg-tertiary text-on-tertiary px-6 py-2 rounded-full font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">workspace_premium</span>
              Fazer Upgrade
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <MetricCard title="Construtoras" value={stats.builders} icon="engineering" color="text-blue-500" />
        <MetricCard title="Empreendimentos" value={stats.projects} icon="apartment" color="text-indigo-500" />
        <MetricCard title="Unidades" value={stats.units} icon="meeting_room" color="text-emerald-500" />
        <MetricCard title="Imóveis" value={stats.properties} icon="home" color="text-amber-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-12">
        <div className="xl:col-span-2 bg-surface-container-lowest rounded-3xl p-8 sunken-shadow border border-outline-variant/10">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-headline font-bold text-on-surface">Desempenho de Vendas</h3>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Atualizado
            </div>
          </div>
          <div className="h-[300px] w-full">
            {revenueData.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-on-surface/30 italic">
                <span className="material-symbols-outlined text-4xl mb-2">bar_chart</span>
                Nenhuma venda registrada ainda
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl p-8 sunken-shadow border border-outline-variant/10">
          <h3 className="text-xl font-headline font-bold text-on-surface mb-8">Atividades Recentes</h3>
          <div className="space-y-6">
            {activities.length > 0 ? (
              activities.map((act) => (
                <ActivityItem 
                  key={act.id}
                  label={act.label}
                  desc={act.description} 
                  time={new Date(act.created_at).toLocaleDateString()} 
                  icon={act.icon} 
                  iconColor={act.color} 
                  image={act.image}
                />
              ))
            ) : (
              <p className="text-on-surface/50 text-sm italic">Nenhuma atividade recente</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const MetricCard = ({ title, value, icon, color }: any) => (
  <div className="bg-surface-container-lowest rounded-2xl p-6 hover:bg-surface-bright transition-all duration-300 relative overflow-hidden group sunken-shadow border border-outline-variant/10">
    <div className="relative z-10">
      <div className={`w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center mb-4 ${color}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <p className="text-on-surface-variant font-bold text-xs uppercase tracking-widest mb-1">{title}</p>
      <p className="text-3xl font-headline font-black text-on-surface">{value}</p>
    </div>
    <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:opacity-10 transition-all duration-500 group-hover:scale-110">
      <span className="material-symbols-outlined text-7xl">{icon}</span>
    </div>
  </div>
);

const ActivityItem = ({ label, desc, time, icon, iconColor, image }: any) => (
  <div className="flex items-start gap-4 group cursor-pointer">
    {image ? (
      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-sm border border-outline-variant/20">
        <img src={image} alt={desc} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
      </div>
    ) : (
      <div className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center bg-surface-container-high ${iconColor}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest">{label}</p>
      <p className="font-bold text-on-surface truncate group-hover:text-primary transition-colors">{desc}</p>
      <p className="text-[10px] text-on-surface/40 font-medium">{time}</p>
    </div>
  </div>
);
