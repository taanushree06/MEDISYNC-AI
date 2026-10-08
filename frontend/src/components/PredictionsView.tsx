import React, { useState } from 'react';
import { Prediction } from '../types';
import {
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Cpu,
  Clock,
  Layers,
  Info,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface PredictionsViewProps {
  predictions: Prediction[];
}

export const PredictionsView: React.FC<PredictionsViewProps> = ({ predictions }) => {
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(
    predictions[0]?.hospital_id || ''
  );

  const selectedPrediction =
    predictions.find((p) => p.hospital_id === selectedHospitalId) || predictions[0];

  // Prepare chart data from forecast_points
  const chartData = selectedPrediction?.forecast_points?.map((pt) => ({
    hour: `+${pt.hours_ahead}h`,
    stock: Math.round(pt.projected_stock),
    safety: selectedPrediction.safety_stock,
  })) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderLeft: '4px solid #06b6d4',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(6, 182, 212, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#06b6d4',
            }}
          >
            <Cpu size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', color: '#fff' }}>
              Predictive Shortage Forecasting Engine
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Multi-horizon linear trend regression with dynamic consumption variance modeling
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
          <Info size={15} />
          <span>Forecast Horizon: 12 Simulated Hours</span>
        </div>
      </div>

      {/* Main Split: Left Selector & Summary, Right Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1.5rem' }}>
        {/* Hospital Selector List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Facility Risk Projections
          </h3>

          {predictions.map((p) => {
            const isSelected = (selectedPrediction?.hospital_id || '') === p.hospital_id;
            const hours = p.hours_to_shortage;
            const isCritical = hours !== null && hours < 3;
            const isWarning = hours !== null && hours < 8;

            return (
              <div
                key={p.hospital_id}
                onClick={() => setSelectedHospitalId(p.hospital_id)}
                className="glass-panel"
                style={{
                  padding: '1rem',
                  cursor: 'pointer',
                  border: isSelected
                    ? '1px solid #06b6d4'
                    : isCritical
                    ? '1px solid rgba(244, 63, 94, 0.4)'
                    : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'var(--bg-card)',
                  boxShadow: isSelected ? '0 0 15px rgba(6, 182, 212, 0.15)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
                    {p.hospital_name || p.hospital_id}
                  </div>
                  {isCritical ? (
                    <span className="badge badge-critical">Critical</span>
                  ) : isWarning ? (
                    <span className="badge badge-warning">Warning</span>
                  ) : (
                    <span className="badge badge-normal">Stable</span>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '0.65rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <span style={{ color: '#94a3b8' }}>
                    Stock: <strong style={{ color: '#fff' }}>{Math.round(p.current_stock)}</strong>
                  </span>
                  <span style={{ color: '#94a3b8' }}>
                    Depletion: <strong style={{ color: '#fb7185' }}>-{(p.predicted_consumption_rate || p.projected_hourly_depletion || 0).toFixed(1)}/h</strong>
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '0.78rem',
                  }}
                >
                  <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} /> Time to Shortage:
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: isCritical ? '#fb7185' : isWarning ? '#fbbf24' : '#34d399',
                    }}
                  >
                    {hours !== null ? `${hours.toFixed(1)} hrs` : '> 24 hrs'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Forecast Chart Panel */}
        {selectedPrediction && (
          <div
            className="glass-panel"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>
                    {selectedPrediction.hospital_name} — 12-Hour Trajectory
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Current Stock: {Math.round(selectedPrediction.current_stock)} cyl | Safety Threshold:{' '}
                    {selectedPrediction.safety_stock} cyl
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Algorithm Model</div>
                  <div style={{ fontSize: '0.85rem', color: '#22d3ee', fontWeight: 600 }}>
                    {selectedPrediction.model_type || 'Linear Trend Estimator'}
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div style={{ height: '320px', width: '100%', marginTop: '1.5rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="hour" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0d1322',
                        borderColor: 'rgba(6, 182, 212, 0.4)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.8rem',
                      }}
                    />
                    <ReferenceLine
                      y={selectedPrediction.safety_stock}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      label={{
                        value: `Min Safety Limit (${selectedPrediction.safety_stock})`,
                        fill: '#ef4444',
                        fontSize: 11,
                        position: 'insideBottomRight',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="stock"
                      name="Projected Stock"
                      stroke="#06b6d4"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#06b6d4' }}
                      activeDot={{ r: 7, fill: '#22d3ee', stroke: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Diagnostic Footer */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginTop: '1.25rem',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: '0.8rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b' }}>Estimated Depletion:</span>
                <div style={{ color: '#fff', fontWeight: 600, marginTop: '0.15rem' }}>
                  {(selectedPrediction.predicted_consumption_rate || selectedPrediction.projected_hourly_depletion || 0).toFixed(2)} cylinders / hr
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Critical Threshold Breach:</span>
                <div
                  style={{
                    color:
                      selectedPrediction.hours_to_shortage && selectedPrediction.hours_to_shortage < 3
                        ? '#fb7185'
                        : '#34d399',
                    fontWeight: 700,
                    marginTop: '0.15rem',
                  }}
                >
                  {selectedPrediction.hours_to_shortage
                    ? `In ${selectedPrediction.hours_to_shortage.toFixed(1)} simulated hours`
                    : 'Safe buffer maintained'}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Action Recommendation:</span>
                <div style={{ color: '#22d3ee', fontWeight: 600, marginTop: '0.15rem' }}>
                  {selectedPrediction.shortage_predicted
                    ? 'Rebalance Transfer Required'
                    : 'Monitor Baseline Steady'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
