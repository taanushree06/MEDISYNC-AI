import React from 'react';
import { ModelEvaluation } from '../types';
import {
  BarChart2,
  CheckCircle2,
  Cpu,
  Target,
  Zap,
  TrendingUp,
} from 'lucide-react';

interface EvaluationViewProps {
  evaluation: ModelEvaluation | null | undefined;
}

export const EvaluationView: React.FC<EvaluationViewProps> = ({ evaluation }) => {
  const mae = evaluation?.mae != null ? evaluation.mae.toFixed(2) : '—';
  const rmse = evaluation?.rmse != null ? evaluation.rmse.toFixed(2) : '—';
  const accuracy = evaluation?.shortage_detection_accuracy != null
    ? (evaluation.shortage_detection_accuracy * 100).toFixed(1)
    : '—';
  const leadTime = evaluation?.lead_time_hours_avg != null
    ? evaluation.lead_time_hours_avg.toFixed(1)
    : '—';
  const samples = evaluation?.sample_count ?? 0;
  const modelVersion = evaluation?.model_version || 'linear-depletion-v1';
  const hasRealData = evaluation != null && samples > 0;

  const metrics = [
    {
      label: 'SHORTAGE DETECTION RECALL',
      value: `${accuracy}%`,
      sub: 'Shown when measured by the backend',
      icon: Target,
      color: '#10b981',
    },
    {
      label: 'MEAN ABSOLUTE ERROR (MAE)',
      value: `${mae} cyl`,
      sub: 'Average deviation per hour predicted',
      icon: Cpu,
      color: '#06b6d4',
    },
    {
      label: 'ROOT MEAN SQUARE ERROR',
      value: `${rmse} cyl`,
      sub: 'Penalizes large consumption variance spikes',
      icon: TrendingUp,
      color: '#8b5cf6',
    },
    {
      label: 'AVERAGE LEAD WARNING TIME',
      value: `${leadTime} hrs`,
      sub: 'Advance window before safety stock breach',
      icon: Zap,
      color: '#f59e0b',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderLeft: '4px solid #10b981',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}
          >
            <BarChart2 size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>
              ML Forecast Model Quality & Accuracy Benchmarks
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Quantitative statistical validation computed against ground-truth simulation ticks
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            Validated over <strong style={{ color: '#fff' }}>{samples}</strong> test points
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem' }}>
            <span
              className="badge"
              style={{
                background: 'rgba(6, 182, 212, 0.15)',
                color: '#06b6d4',
              }}
            >
              {modelVersion}
            </span>
            <span
              className="badge"
              style={{
                background: hasRealData ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: hasRealData ? '#34d399' : '#fbbf24',
              }}
            >
              {hasRealData ? '● Live Evaluation' : '○ Awaiting simulation data'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI 4-Card Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '1rem',
        }}
      >
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={idx}
              className="glass-panel"
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderTop: `3px solid ${m.color}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                  {m.label}
                </span>
                <Icon size={18} color={m.color} />
              </div>
              <div style={{ marginTop: '0.85rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>
                  {m.value}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                  {m.sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Methodology and Confusion Matrix breakdown */}
      <div className="grid-cols-2">
        {/* Confusion Matrix Card */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#fff', marginBottom: '0.4rem' }}>
            Shortage Classification Evaluation
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
            Classification counts are not provided by the current backend. These metrics remain unmeasured.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                padding: '1rem',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
                TRUE POSITIVE
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '0.25rem 0' }}>
                —
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Shortages caught in advance
              </div>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
                TRUE NEGATIVE
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '0.25rem 0' }}>
                —
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Normal hospitals not disturbed
              </div>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600 }}>
                FALSE POSITIVE
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '0.25rem 0' }}>
                —
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Over-cautious alerts (benign)
              </div>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: '10px',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#fb7185', fontWeight: 600 }}>
                FALSE NEGATIVE
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '0.25rem 0' }}>
                —
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Missed shortage alerts
              </div>
            </div>
          </div>
        </div>

        {/* Algorithm Architecture Description */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#fff', marginBottom: '0.4rem' }}>
            Model Architecture & Safety Checks
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
            Multi-tiered hybrid forecasting and donor optimization architecture
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.825rem' }}>
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <CheckCircle2 size={16} color="#06b6d4" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#fff' }}>Sliding Window Linear Regression:</strong> Computes
                the continuous rate of cylinder depletion using up to 20 recent time checkpoints.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <CheckCircle2 size={16} color="#06b6d4" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#fff' }}>Donor Safety Invariant:</strong> No hospital can be
                selected as a donor unless its post-transfer stock exceeds 1.5x minimum safety buffer.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <CheckCircle2 size={16} color="#06b6d4" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#fff' }}>Geospatial Routing Optimization:</strong> Minimizes
                inter-hospital transport duration using metropolitan road travel estimates.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <CheckCircle2 size={16} color="#06b6d4" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#fff' }}>Gemini LLM Explanations:</strong> Generates human-understandable
                clinical justifications for healthcare administrative review.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
