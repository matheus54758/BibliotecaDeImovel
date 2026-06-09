import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useUserTier } from "../hooks/useUserTier";

export const Dashboard = () => {
  const { t } = useTranslation();
  const { tier, counts, loading: tierLoading, refresh } = useUserTier();
  const [activities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPricing, setShowPricing] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string, qr_code_base64: string, copy_paste: string } | null>(null);

  useEffect(() => {
    // Only set loading false when both dashboard and tier data are ready
    if (!tierLoading) {
      setLoading(false);
    }
  }, [tierLoading]);

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
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-md w-full sunken-shadow relative text-center">
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
            {t('dashboard.title')}
          </h2>
          <p className="text-on-surface/70 font-body text-lg">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-full font-label text-sm font-bold uppercase tracking-widest ${tier === 'paid' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
            {tier === 'paid' ? 'Paid Plan' : 'Free Plan'}
          </div>
          {tier === 'free' && (
            <button 
              onClick={() => setShowPricing(true)}
              className="bg-tertiary text-on-tertiary px-6 py-2 rounded-full font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">workspace_premium</span>
              {t('freemium.upgrade_now')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <MetricCard title={t('dashboard.metrics.total_builders')} value={counts.builders} icon="engineering" />
        <MetricCard title={t('dashboard.metrics.active_projects')} value={counts.developments} icon="apartment" />
        <MetricCard title={t('dashboard.metrics.new_leads')} value={0} icon="groups" />
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
