import React, { useState } from 'react';
import { AlertTriangle, X, Zap, Flame, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Hospital } from '../types';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  hospitals: Hospital[];
  onTriggerSurge: (hospitalId: string, multiplier: number) => Promise<void>;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onClose,
  hospitals,
  onTriggerSurge,
}) => {
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(
    hospitals[2]?.hospital_id || hospitals[0]?.hospital_id || 'hosp-003'
  );
  const [multiplier, setMultiplier] = useState<number>(3.0);
  const [scenarioName, setScenarioName] = useState<string>('Mass Casualty Incident');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const scenarios = [
    {
      name: 'Mass Casualty Incident',
      mult: 3.5,
      desc: 'Multi-vehicle collision / industrial incident causing sudden massive oxygen demand.',
      icon: Flame,
      color: '#f43f5e',
    },
    {
      name: 'Epidemic Respiratory Surge',
      mult: 2.5,
      desc: 'Seasonal viral pneumonia surge overburdening ICU ventilator capacity.',
      icon: ShieldAlert,
      color: '#f59e0b',
    },
    {
      name: 'Supply Chain Delay / Failure',
      mult: 2.0,
      desc: 'Delivery vendor cancellation forcing reliance solely on reserve buffer.',
      icon: Zap,
      color: '#06b6d4',
    },
  ];

  const handleSelectScenario = (name: string, mult: number) => {
    setScenarioName(name);
    setMultiplier(mult);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospitalId) return;

    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      await onTriggerSurge(selectedHospitalId, multiplier);
      setSuccessMsg(`Emergency surge successfully triggered! Rebalancing algorithms recalculating.`);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch {
      // Handled in parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '560px',
          width: '100%',
          backgroundColor: '#0d1322',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          boxShadow: '0 20px 50px rgba(244, 63, 94, 0.2)',
          padding: '1.75rem',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f43f5e 0%, #ea580c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(244, 63, 94, 0.4)',
            }}
          >
            <AlertTriangle size={22} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>Simulate Emergency Crisis</h2>
            <p style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
              Stress-test MediSync's AI shortage detection and donor rebalancer
            </p>
          </div>
        </div>

        {successMsg ? (
          <div
            style={{
              padding: '1.5rem',
              textAlign: 'center',
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
            }}
          >
            <CheckCircle2 size={36} style={{ margin: '0 auto 0.75rem' }} />
            <div style={{ fontWeight: 600 }}>{successMsg}</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Presets */}
            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                QUICK SCENARIO PRESETS
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {scenarios.map((sc) => {
                  const Icon = sc.icon;
                  const isSelected = scenarioName === sc.name;
                  return (
                    <div
                      key={sc.name}
                      onClick={() => handleSelectScenario(sc.name, sc.mult)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '10px',
                        background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                        border: isSelected ? `1px solid ${sc.color}` : '1px solid rgba(255, 255, 255, 0.06)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: `${sc.color}22`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: sc.color,
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
                          {sc.name} ({sc.mult}x Consumption)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{sc.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Target Hospital */}
            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                SELECT TARGET HOSPITAL
              </label>
              <select
                value={selectedHospitalId}
                onChange={(e) => setSelectedHospitalId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              >
                {hospitals.map((h) => (
                  <option key={h.hospital_id} value={h.hospital_id} style={{ background: '#0d1322', color: '#fff' }}>
                    {h.name} — Current: {Math.round(h.current_stock)} cyl ({h.location})
                  </option>
                ))}
              </select>
            </div>

            {/* Multiplier Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                  CONSUMPTION MULTIPLIER
                </label>
                <span style={{ fontSize: '0.85rem', color: '#fb7185', fontWeight: 700 }}>{multiplier}x</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="5.0"
                step="0.5"
                value={multiplier}
                onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#f43f5e', cursor: 'pointer' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={isSubmitting}
                style={{ minWidth: '140px' }}
              >
                {isSubmitting ? 'Surging...' : '🚨 Trigger Surge'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
