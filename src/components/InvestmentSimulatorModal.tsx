import { useState } from 'react';
import { formatCurrency } from '../lib/utils';

interface InvestmentSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: any;
}

export const InvestmentSimulatorModal = ({ isOpen, onClose, property }: InvestmentSimulatorModalProps) => {
  const [downPayment, setDownPayment] = useState(property.payment_entry || (property.price_starting_at * 0.2) || 0);
  const [installments, setInstallments] = useState(property.payment_installment_count || 36);
  const [monthlyCub, setMonthlyCub] = useState(property.cub_monthly_rate || 0.5); // 0.5% a.m. default
  const [appreciationValue, setAppreciationValue] = useState(property.sale_value_after_keys || (property.price_starting_at * 1.3) || 0);

  if (!isOpen) return null;

  // Calculos Financeiros
  const propertyPrice = property.price_starting_at || 0;
  const remainingBalanceBeforeCub = propertyPrice - downPayment;
  const monthlyInstallment = installments > 0 ? remainingBalanceBeforeCub / installments : 0;
  
  // Aproximação do CUB (Juros Compostos Simples sobre a parcela)
  const totalInstallmentPaid = Array.from({ length: installments }).reduce((acc: number, _, i) => {
    return acc + (monthlyInstallment * Math.pow(1 + (monthlyCub / 100), i + 1));
  }, 0) as number;

  const totalInvested = downPayment + totalInstallmentPaid;
  const grossProfit = appreciationValue - totalInvested;
  const roi = totalInvested > 0 ? (grossProfit / totalInvested) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden border border-outline-variant/20 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 p-6 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-headline font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined">trending_up</span>
              Simulador de Investimento
            </h2>
            <p className="text-emerald-200/80 text-sm font-body mt-1">
              Projeção de rentabilidade e alavancagem de capital.
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto">
          
          {/* Controls (Left) */}
          <div className="w-full md:w-1/3 border-r border-outline-variant/10 p-6 bg-surface-container-low/30 space-y-6">
            
            <div>
              <label className="block text-xs font-bold text-on-surface/60 uppercase tracking-wider mb-2">Entrada Inicial (R$)</label>
              <input 
                type="number" 
                className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface font-body focus:ring-2 focus:ring-emerald-500/50"
                value={downPayment}
                onChange={(e) => setDownPayment(Number(e.target.value))}
              />
              <p className="text-[10px] text-on-surface/40 mt-1 mt-1 text-right">{((downPayment / propertyPrice) * 100).toFixed(1)}% do VGV</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface/60 uppercase tracking-wider mb-2">Parcelas (Meses)</label>
              <input 
                type="number" 
                className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface font-body focus:ring-2 focus:ring-emerald-500/50"
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface/60 uppercase tracking-wider mb-2">Projeção CUB (% ao mês)</label>
              <input 
                type="number" 
                step="0.1"
                className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface font-body focus:ring-2 focus:ring-emerald-500/50"
                value={monthlyCub}
                onChange={(e) => setMonthlyCub(Number(e.target.value))}
              />
            </div>

            <div className="pt-4 border-t border-outline-variant/10">
              <label className="block text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">VGV na Entrega das Chaves (R$)</label>
              <input 
                type="number" 
                className="w-full bg-emerald-50 border-0 rounded-xl py-3 px-4 text-emerald-900 font-bold focus:ring-2 focus:ring-emerald-500/50"
                value={appreciationValue}
                onChange={(e) => setAppreciationValue(Number(e.target.value))}
              />
              <p className="text-[10px] text-on-surface/40 mt-2 leading-tight">
                Estime por quanto você conseguirá vender o imóvel pronto.
              </p>
            </div>

          </div>

          {/* Results (Right) */}
          <div className="w-full md:w-2/3 p-6 md:p-8 space-y-8 flex flex-col justify-center">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-surface-container-high p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150"></div>
                <p className="text-xs uppercase tracking-widest text-on-surface/50 font-bold mb-1 relative z-10">Total Desembolsado</p>
                <p className="text-3xl font-black text-on-surface relative z-10">{formatCurrency(totalInvested)}</p>
                <p className="text-xs text-on-surface/50 mt-2 relative z-10">Entrada + Parcelas corrigidas</p>
              </div>

              <div className="bg-emerald-900 p-6 rounded-2xl relative overflow-hidden group shadow-lg shadow-emerald-900/20">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150"></div>
                <p className="text-xs uppercase tracking-widest text-emerald-300 font-bold mb-1 relative z-10">Lucro Bruto Projetado</p>
                <p className="text-3xl font-black text-white relative z-10">{formatCurrency(grossProfit)}</p>
                <p className="text-xs text-emerald-200 mt-2 relative z-10">Na venda (Chaves)</p>
              </div>

            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 relative">
              <h3 className="text-sm font-bold text-on-surface mb-6 uppercase tracking-wider">Métricas de Alavancagem</h3>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-on-surface/60 font-medium">Retorno sobre o Capital (ROI)</span>
                    <span className="font-bold text-emerald-600">{roi.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-surface-container-high rounded-full h-3 overflow-hidden">
                    <div className="bg-emerald-500 h-3 rounded-full" style={{ width: `${Math.min(roi, 100)}%` }}></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/10">
                  <div>
                    <p className="text-xs text-on-surface/50 mb-1">Valor Presente da Unidade</p>
                    <p className="font-bold text-on-surface">{formatCurrency(propertyPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-on-surface/50 mb-1">Valorização Estimada</p>
                    <p className="font-bold text-primary">{(((appreciationValue / propertyPrice) - 1) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center mt-auto pt-4">
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-gradient-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity w-full md:w-auto"
              >
                Concluir Análise
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
