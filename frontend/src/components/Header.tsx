import React from 'react';
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Radio,
  MapPin,
  TrendingDown,
  Sparkles,
  Truck,
  FileText,
  BarChart2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { SimulationStatus } from '../types';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  status: SimulationStatus | null;
  isWsConnected: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onOpenEmergencyModal: () => void;
  recommendationsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  status,
  isWsConnected,
  onStart,
  onPause,
  onResume,
  onReset,
  onOpenEmergencyModal,
  recommendationsCount,
}) => {
  const isRunning = status?.running ?? false;

  const tabs = [
    { id: 'overview', label: 'Network Overview', icon: Activity },
    { id: 'map', label: 'Regional Map', icon: MapPin },
    { id: 'predictions', label: 'ML Forecasting', icon: TrendingDown },
    {
      id: 'recommendations',
      label: 'AI Rebalancing',
      icon: Sparkles,
      badge: recommendationsCount > 0 ? recommendationsCount : undefined,
    },
    { id: 'transfers', label: 'Logistics Fleet', icon: Truck },
    { id: 'ledger', label: 'Audit Ledger', icon: FileText },
    { id: 'evaluation', label: 'Model Quality', icon: BarChart2 },
  ];

  const formatSimTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <div className="nav-brand">
          <div className="nav-brand-logo">
            <Activity size={22} className="text-white" />
          </div>
          <div className="nav-brand-text">
            <h1>
              MediSync AI
              <span className="badge badge-normal" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
                HN-AI-05
              </span>
            </h1>
            <div className="tagline">Intelligent Cross-Hospital Rebalancer</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setCurrentTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    style={{
                      background: '#f43f5e',
                      color: 'white',
                      fontSize: '0.65rem',
                      borderRadius: '9999px',
                      padding: '0.1rem 0.4rem',
                      fontWeight: 700,
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Controls & Sim Status */}
        <div className="nav-controls">
          {/* Sim Status Pill */}
          <div className="sim-capsule">
            <span className={`pulse-indicator ${isRunning ? 'active' : ''}`} />
            <span style={{ fontSize: '0.75rem', color: isRunning ? '#34d399' : '#94a3b8', fontWeight: 600 }}>
              {isRunning ? 'SIM RUNNING' : 'SIM PAUSED'}
            </span>
            <div style={{ height: '14px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={13} style={{ color: '#06b6d4' }} />
              <span className="sim-clock-time">{formatSimTime(status?.simulation_time || status?.simulated_time)}</span>
            </div>
          </div>

          {/* Quick Sim Controls */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {isRunning ? (
              <button className="btn btn-secondary btn-sm" onClick={onPause} title="Pause Simulation">
                <Pause size={14} />
              </button>
            ) : status?.paused ? (
              <button className="btn btn-primary btn-sm" onClick={onResume} title="Resume Simulation">
                <Play size={14} />
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={onStart} title="Start Simulation">
                <Play size={14} />
              </button>
            )}

            <button className="btn btn-secondary btn-sm" onClick={onReset} title="Reset Simulation Data">
              <RotateCcw size={14} />
            </button>

            <button
              className="btn btn-danger btn-sm"
              onClick={onOpenEmergencyModal}
              title="Trigger Emergency Crisis Surge"
            >
              <AlertTriangle size={14} />
              <span>Surge</span>
            </button>
          </div>

          {/* WS Status Dot */}
          <div
            title={isWsConnected ? 'WebSocket Live Feed Connected' : 'WebSocket Disconnected (Polling)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.35rem 0.5rem',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: '0.7rem',
              color: isWsConnected ? '#34d399' : '#f59e0b',
            }}
          >
            <Radio size={12} />
            <span>{isWsConnected ? 'LIVE' : 'OFFLINE'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
