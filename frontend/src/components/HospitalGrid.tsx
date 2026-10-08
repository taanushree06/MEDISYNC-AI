import React from 'react';
import { Hospital } from '../types';
import {
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  Zap,
  MapPin,
  Clock,
  Shield,
  Truck,
} from 'lucide-react';

interface HospitalGridProps {
  hospitals: Hospital[];
  onTriggerSurge: (hospitalId: string, multiplier: number) => Promise<void>;
  onSelectHospital?: (hospital: Hospital) => void;
}

export const HospitalGrid: React.FC<HospitalGridProps> = ({
  hospitals,
  onTriggerSurge,
  onSelectHospital,
}) => {
  const getTrendIcon = (trend: string) => {
    if (trend === 'declining') return <TrendingDown size={14} style={{ color: '#fb7185' }} />;
    if (trend === 'rising') return <TrendingUp size={14} style={{ color: '#34d399' }} />;
    return <Minus size={14} style={{ color: '#94a3b8' }} />;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'critical') {
      return (
        <span className="badge badge-critical">
          <span className="pulse-indicator critical" />
          Critical Risk
        </span>
      );
    }
    if (status === 'warning') {
      return (
        <span className="badge badge-warning">
          <span className="pulse-indicator" style={{ backgroundColor: '#f59e0b' }} />
          Warning
        </span>
      );
    }
    return (
      <span className="badge badge-normal">
        <span className="pulse-indicator active" />
        Safe Buffer
      </span>
    );
  };

  return (
    <div className="grid-cols-3">
      {hospitals.map((h) => {
        const stock = Math.round(h.current_stock);
        const capacity = h.total_capacity;
        const safety = h.minimum_safety_stock;
        const percent = Math.min(100, Math.round((stock / capacity) * 100));
        const safetyPercent = Math.round((safety / capacity) * 100);

        const isCritical = h.status === 'critical';
        const isWarning = h.status === 'warning';

        const barColor = isCritical ? '#f43f5e' : isWarning ? '#f59e0b' : '#06b6d4';

        return (
          <div
            key={h.hospital_id}
            className={`glass-panel glass-panel-hover ${isCritical ? 'glow-rose' : ''}`}
            style={{
              padding: '1.4rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              cursor: onSelectHospital ? 'pointer' : 'default',
              borderColor: isCritical
                ? 'rgba(244, 63, 94, 0.4)'
                : isWarning
                ? 'rgba(245, 158, 11, 0.3)'
                : 'var(--border-subtle)',
            }}
            onClick={() => onSelectHospital?.(h)}
          >
            {/* Header info */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', color: '#fff', marginBottom: '0.2rem' }}>
                    {h.name}
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                    }}
                  >
                    <MapPin size={12} color="#06b6d4" />
                    <span>{h.location}</span>
                  </div>
                </div>
                {getStatusBadge(h.status)}
              </div>

              {/* Stock numbers */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginTop: '1.2rem',
                  marginBottom: '0.4rem',
                }}
              >
                <div>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.75rem',
                      fontWeight: 700,
                      color: isCritical ? '#fb7185' : '#fff',
                    }}
                  >
                    {stock}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: '0.35rem' }}>
                    / {capacity} cyl
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Shield size={12} color="#64748b" /> Min Safety: {safety}
                  </span>
                </div>
              </div>

              {/* Visual Capacity Bar with Safety Threshold Marker */}
              <div style={{ position: 'relative', margin: '0.5rem 0 1.25rem' }}>
                <div className="progress-bar-bg" style={{ height: '9px' }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
                {/* Safety marker pin */}
                <div
                  title={`Minimum Safety Stock Threshold (${safety} units)`}
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    left: `${safetyPercent}%`,
                    width: '2px',
                    height: '17px',
                    backgroundColor: '#ef4444',
                    boxShadow: '0 0 6px #ef4444',
                    zIndex: 2,
                  }}
                />
              </div>

              {/* Stats metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>
                    Consumption Rate
                  </div>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      marginTop: '0.15rem',
                    }}
                  >
                    {h.consumption_rate.toFixed(1)} cyl/h
                    {getTrendIcon(h.stock_trend)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>
                    Time to Depletion
                  </div>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color:
                        h.hours_to_shortage !== null && h.hours_to_shortage < 3
                          ? '#fb7185'
                          : h.hours_to_shortage !== null && h.hours_to_shortage < 6
                          ? '#fbbf24'
                          : '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      marginTop: '0.15rem',
                    }}
                  >
                    <Clock size={13} />
                    {h.hours_to_shortage !== null
                      ? `${h.hours_to_shortage.toFixed(1)} hrs`
                      : '> 24 hrs'}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom action bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '1.25rem',
                paddingTop: '0.85rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {h.incoming_replenishment > 0 ? (
                  <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Truck size={12} /> +{h.incoming_replenishment} en route
                  </span>
                ) : (
                  <span>No inbound transfers</span>
                )}
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onTriggerSurge(h.hospital_id, 3.0);
                }}
                title="Simulate sudden 3x demand spike"
                style={{
                  fontSize: '0.72rem',
                  padding: '0.25rem 0.6rem',
                  borderColor: 'rgba(244, 63, 94, 0.3)',
                  color: '#fb7185',
                }}
              >
                <Zap size={12} />
                Surge 3x
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
