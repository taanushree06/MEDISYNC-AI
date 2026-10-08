import React from 'react';
import { Package, AlertOctagon, Sparkles, Truck, ShieldAlert, Cpu } from 'lucide-react';
import { Analytics } from '../types';

interface MetricCardsProps {
  analytics: Analytics | null;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ analytics }) => {
  const totalStock = analytics ? Math.round(analytics.total_stock) : 0;
  const atRisk = analytics?.hospitals_at_risk ?? 0;
  const activeRecs = analytics?.active_recommendations ?? 0;
  const activeTransfers = analytics?.total_transfers_active ?? 0;
  const completedTransfers = analytics?.total_transfers_completed ?? 0;
  const predictedShortages = analytics?.predicted_shortages ?? 0;
  const accuracy = analytics?.evaluation?.shortage_detection_accuracy != null
    ? `${(analytics.evaluation.shortage_detection_accuracy * 100).toFixed(1)}%`
    : analytics?.evaluation?.mae != null
    ? `MAE ${analytics.evaluation.mae.toFixed(1)}`
    : 'Awaiting evaluation';

  const cards = [
    {
      title: 'NETWORK RESERVE',
      value: `${totalStock} Cylinders`,
      subtext: `Across ${analytics?.total_hospitals ?? '—'} metropolitan facilities`,
      icon: Package,
      color: '#06b6d4',
      glow: 'glow-teal',
    },
    {
      title: 'AT-RISK FACILITIES',
      value: `${atRisk} Hospital${atRisk === 1 ? '' : 's'}`,
      subtext: atRisk > 0 ? `Critical buffer threshold breach` : `All facilities within safety buffer`,
      icon: atRisk > 0 ? AlertOctagon : ShieldAlert,
      color: atRisk > 0 ? '#f43f5e' : '#10b981',
      glow: atRisk > 0 ? 'glow-rose' : '',
    },
    {
      title: 'PREDICTED SHORTAGES (<8H)',
      value: `${predictedShortages} Forecasted`,
      subtext: `ML early-warning • ${accuracy} benchmark`,
      icon: Cpu,
      color: predictedShortages > 0 ? '#f59e0b' : '#34d399',
      glow: predictedShortages > 0 ? 'glow-amber' : '',
    },
    {
      title: 'AI REBALANCE RECOMMENDATIONS',
      value: `${activeRecs} Pending`,
      subtext: `Safety-checked resource transfers`,
      icon: Sparkles,
      color: '#8b5cf6',
      glow: activeRecs > 0 ? 'glow-purple' : '',
    },
    {
      title: 'ACTIVE FLEET LOGISTICS',
      value: `${activeTransfers} In Transit`,
      subtext: `${completedTransfers} deliveries completed`,
      icon: Truck,
      color: '#38bdf8',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem',
      }}
    >
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={`glass-panel glass-panel-hover ${c.glow || ''}`}
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Top Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  letterSpacing: '0.06em',
                  color: '#94a3b8',
                  fontWeight: 600,
                }}
              >
                {c.title}
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: `${c.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: c.color,
                }}
              >
                <Icon size={18} />
              </div>
            </div>

            {/* Main Value */}
            <div style={{ marginTop: '0.85rem' }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#fff',
                  lineHeight: 1.2,
                }}
              >
                {c.value}
              </div>
              <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.35rem' }}>
                {c.subtext}
              </div>
            </div>

            {/* Bottom Accent line */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: `linear-gradient(90deg, ${c.color} 0%, transparent 100%)`,
                opacity: 0.8,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
