import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  getHospitals,
  getPredictions,
  getRecommendations,
  getTransfers,
  getEvents,
  getAnalytics,
  getSimulationStatus,
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  resetSimulation,
  triggerEmergency,
  generateRecommendations,
  approveRecommendation,
  cancelRecommendation,
  dispatchTransfer,
  completeTransfer,
  checkHealth,
  type BackendHealth,
} from './services/api';
import { useMediSyncWebSocket, WSMessage } from './services/websocket';
import {
  Hospital,
  Prediction,
  Recommendation,
  Transfer,
  SimulationEvent,
  Analytics,
  SimulationStatus,
} from './types';
import { Header } from './components/Header';
import { EmergencyModal } from './components/EmergencyModal';
import { MetricCards } from './components/MetricCards';
import { HospitalGrid } from './components/HospitalGrid';
import { RecommendationsView } from './components/RecommendationsView';
import { TransfersView } from './components/TransfersView';
import { LedgerView } from './components/LedgerView';
import { EvaluationView } from './components/EvaluationView';
import { Activity, Bell, CheckCircle2, ShieldAlert } from 'lucide-react';

const RegionalMap = lazy(() => import('./components/RegionalMap').then(module => ({ default: module.RegionalMap })));
const PredictionsView = lazy(() => import('./components/PredictionsView').then(module => ({ default: module.PredictionsView })));

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [simStatus, setSimStatus] = useState<SimulationStatus | null>(null);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'alert' | 'info' } | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [operatorAccessOpen, setOperatorAccessOpen] = useState(false);
  const [operatorToken, setOperatorToken] = useState('');
  const fetchInFlight = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'alert' | 'info' = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // Master fetch function
  const fetchAllData = useCallback(async () => {
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      const [h, p, r, t, e, a, s, health] = await Promise.allSettled([
        getHospitals(), getPredictions(), getRecommendations(), getTransfers(),
        getEvents(40), getAnalytics(), getSimulationStatus(), checkHealth(),
      ]);
      if (h.status === 'fulfilled') setHospitals(h.value);
      if (p.status === 'fulfilled') setPredictions(p.value);
      if (r.status === 'fulfilled') setRecommendations(r.value);
      if (t.status === 'fulfilled') setTransfers(t.value);
      if (e.status === 'fulfilled') setEvents(e.value);
      if (a.status === 'fulfilled') setAnalytics(a.value);
      if (s.status === 'fulfilled') setSimStatus(s.value);
      setBackendHealth(health.status === 'fulfilled' ? health.value : null);
      const complete = [h, p, r, t, e, a, s, health].every(result => result.status === 'fulfilled');
      setConnectionError(complete ? null : 'Some live data could not be refreshed. Showing the last available readings.');
      if (complete) setLastUpdated(new Date());
    } finally {
      fetchInFlight.current = false;
      setLoading(false);
    }
  }, []);

  // Real-time WebSocket handler
  const handleWsMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.type === 'stock_update') {
        // Real-time stock telemetry from the simulation engine
        if (msg.hospitals && Array.isArray(msg.hospitals)) {
          setHospitals((prev) => {
            // Merge live stock data into existing hospital objects
            const map = new Map(prev.map((h) => [h.hospital_id, h]));
            for (const upd of msg.hospitals) {
              const existing = map.get(upd.hospital_id);
              if (existing) {
                map.set(upd.hospital_id, {
                  ...existing,
                  current_stock: upd.current_stock,
                  consumption_rate: upd.consumption_rate,
                  status: upd.status as any,
                });
              }
            }
            return Array.from(map.values());
          });
        }
        if (msg.simulation_time) {
          setSimStatus((prev) =>
            prev ? { ...prev, simulated_time: msg.simulation_time } : prev
          );
        }
      } else if (msg.type === 'threshold_breach') {
        showToast(
          `⚠️ Safety Breach Alert: ${msg.hospital_name || 'Hospital'} stock dropped below threshold!`,
          'alert'
        );
        fetchAllData();
      } else if (msg.type === 'emergency_surge') {
        showToast(`🚨 Surge Detected: ${msg.hospital_name} consumption spiked!`, 'alert');
        fetchAllData();
      } else if (msg.type === 'simulation_reset') {
        showToast('Simulation reset to baseline state.', 'info');
        fetchAllData();
      } else if (
        msg.type === 'recommendation_generated' ||
        msg.type === 'transfer_approved' ||
        msg.type === 'transfer_dispatched' ||
        msg.type === 'transfer_completed' ||
        msg.type === 'emergency_update'
      ) {
        fetchAllData();
      }
    },
    [fetchAllData, showToast]
  );

  const { isConnected: isWsConnected } = useMediSyncWebSocket(handleWsMessage);

  // Initial load and periodic polling fallback
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => {
      fetchAllData();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // Simulation controls
  const handleStartSim = async () => {
    try {
      const status = await startSimulation();
      setSimStatus(status);
      showToast('Simulation started. Real-time consumption active.', 'success');
    } catch (err: any) {
      showToast(`Failed to start: ${err.message}`, 'alert');
    }
  };

  const handlePauseSim = async () => {
    try {
      const status = await pauseSimulation();
      setSimStatus(status);
      showToast('Simulation paused.', 'info');
    } catch (err: any) {
      showToast(`Failed to pause: ${err.message}`, 'alert');
    }
  };

  const handleResumeSim = async () => {
    try {
      const status = await resumeSimulation();
      setSimStatus(status);
      showToast('Simulation resumed.', 'success');
    } catch (err: any) {
      showToast(`Failed to resume: ${err.message}`, 'alert');
    }
  };

  const handleResetSim = async () => {
    try {
      const status = await resetSimulation();
      setSimStatus(status);
      await fetchAllData();
      showToast('Simulation reset to baseline state.', 'info');
    } catch (err: any) {
      showToast(`Failed to reset: ${err.message}`, 'alert');
    }
  };

  const handleTriggerSurge = async (hospitalId: string, multiplier: number) => {
    try {
      const res = await triggerEmergency(hospitalId, multiplier);
      setSimStatus(res.status);
      showToast(
        `Surge triggered (${multiplier}x)! Rebalancing transfer recommendations generated.`,
        'alert'
      );
      await fetchAllData();
      setCurrentTab('recommendations');
    } catch (err: any) {
      showToast(`Failed to trigger surge: ${err.message}`, 'alert');
    }
  };

  // Rebalance actions
  const handleApproveRec = async (id: string) => {
    try {
      await approveRecommendation(id);
      showToast('Transfer recommendation approved & reserved!', 'success');
      await fetchAllData();
    } catch (err: any) {
      showToast(`Approval failed: ${err.message}`, 'alert');
    }
  };

  const handleCancelRec = async (id: string) => {
    try {
      await cancelRecommendation(id);
      showToast('Recommendation dismissed.', 'info');
      await fetchAllData();
    } catch (err: any) {
      showToast(`Dismissal failed: ${err.message}`, 'alert');
    }
  };

  const handleDispatchXfer = async (id: string) => {
    try {
      await dispatchTransfer(id);
      showToast('Transport vehicle dispatched to destination!', 'success');
      await fetchAllData();
    } catch (err: any) {
      showToast(`Dispatch failed: ${err.message}`, 'alert');
    }
  };

  const handleCompleteXfer = async (id: string) => {
    try {
      await completeTransfer(id);
      showToast('Delivery verified! Stock successfully replenished.', 'success');
      await fetchAllData();
    } catch (err: any) {
      showToast(`Completion failed: ${err.message}`, 'alert');
    }
  };

  return (
    <div className="app-container">
      {/* Toast Alert */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '24px',
            zIndex: 1000,
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            background:
              toast.type === 'alert'
                ? 'rgba(244, 63, 94, 0.95)'
                : toast.type === 'success'
                ? 'rgba(16, 185, 129, 0.95)'
                : 'rgba(6, 182, 212, 0.95)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.85rem',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            animation: 'fadeIn 0.25s ease',
          }}
        >
          {toast.type === 'alert' ? (
            <ShieldAlert size={18} />
          ) : toast.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <Bell size={18} />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        status={simStatus}
        isWsConnected={isWsConnected}
        onStart={handleStartSim}
        onPause={handlePauseSim}
        onResume={handleResumeSim}
        onReset={handleResetSim}
        onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
        recommendationsCount={recommendations.filter((r) => r.status === 'proposed').length}
      />

      {/* Main Content Area */}
      <main className="main-content">
        <section className="command-hero" aria-label="Network command center">
          <div className="hero-copy">
            <span className="hero-eyebrow"><Activity size={14} /> REGIONAL COMMAND CENTER <span className="demo-label">SIMULATED</span></span>
            <h2>Every hospital.<br /><span>One connected network.</span></h2>
            <p>Anticipate oxygen shortages. Coordinate resources. Keep your network one step ahead.</p>
            <div className="connection-chips" aria-live="polite">
              <span className={`connection-chip ${backendHealth?.persistent ? 'connected' : 'attention'}`}>
                <span className={`pulse-indicator ${backendHealth?.persistent ? 'active' : ''}`} />
                {loading ? 'Connecting to backend…' : backendHealth?.persistent ? 'MongoDB · persistent storage' : backendHealth?.storage_mode === 'mongomock' ? 'Demo memory · not persistent' : 'Backend unavailable'}
              </span>
              <span className="connection-chip">{isWsConnected ? 'Live telemetry' : 'Polling telemetry'}</span>
              {backendHealth?.operator_auth_required && <button className="btn btn-secondary btn-sm" onClick={() => setOperatorAccessOpen(true)}>Operator access</button>}
              {lastUpdated && <span className="sync-time">Updated {lastUpdated.toLocaleTimeString()}</span>}
            </div>
          </div>
          <div className="network-orbit" aria-hidden="true">
            <div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" />
            <div className="orbit-sweep" /><div className="orbit-core"><Activity size={38} /></div>
            {[0, 1, 2, 3, 4, 5].map(i => <span key={i} className={`orbit-node node-${i}`} />)}
            <span className="orbit-caption">{hospitals.length || '—'} FACILITIES / ONE NETWORK</span>
          </div>
        </section>
        {connectionError && <div className="connection-banner" role="status"><ShieldAlert size={18} /><span>{connectionError}</span><button className="btn btn-secondary btn-sm" onClick={fetchAllData}>Retry</button></div>}
        {loading && <div className="loading-state" role="status"><span className="loading-bar" />Loading your healthcare network…</div>}
        <div key={currentTab} className="view-transition">
        <Suspense fallback={<div className="loading-state" role="status">Loading this view…</div>}>
        {currentTab === 'overview' && (
          <div>
            <MetricCards analytics={analytics} />

            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>Metropolitan Healthcare Network Matrix</h2>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Live monitoring of 6 key hospitals across Delhi NCR with safety buffers and consumption telemetry
                </p>
              </div>
            </div>

            <HospitalGrid
              hospitals={hospitals}
              onTriggerSurge={handleTriggerSurge}
              onSelectHospital={() => setCurrentTab('map')}
            />
          </div>
        )}

        {currentTab === 'map' && (
          <RegionalMap
            hospitals={hospitals}
            transfers={transfers}
            recommendations={recommendations}
            onTriggerSurge={handleTriggerSurge}
          />
        )}

        {currentTab === 'predictions' && <PredictionsView predictions={predictions} />}

        {currentTab === 'recommendations' && (
          <RecommendationsView
            recommendations={recommendations}
            onApprove={handleApproveRec}
            onCancel={handleCancelRec}
            onRefresh={async () => {
              try {
                await generateRecommendations();
                await fetchAllData();
              } catch (err: any) {
                showToast(`Could not refresh recommendations: ${err.message}`, 'alert');
              }
            }}
          />
        )}

        {currentTab === 'transfers' && (
          <TransfersView
            transfers={transfers}
            onDispatch={handleDispatchXfer}
            onComplete={handleCompleteXfer}
          />
        )}

        {currentTab === 'ledger' && <LedgerView events={events} />}

        {currentTab === 'evaluation' && <EvaluationView evaluation={analytics?.evaluation} />}
        </Suspense>
        </div>
      </main>

      {operatorAccessOpen && (
        <div className="operator-overlay">
          <section className="glass-panel operator-dialog" role="dialog" aria-modal="true" aria-labelledby="operator-title">
            <h2 id="operator-title">Operator access</h2>
            <p>Enter the operator token from your Render service’s secret settings to control this simulation. Access lasts for this browser tab.</p>
            <form onSubmit={event => {
              event.preventDefault();
              if (operatorToken.trim()) sessionStorage.setItem('medisync_operator_token', operatorToken.trim());
              else sessionStorage.removeItem('medisync_operator_token');
              setOperatorToken('');
              setOperatorAccessOpen(false);
              showToast('Operator access updated. Try your action again.', 'info');
            }}>
              <label htmlFor="operator-token">Operator token</label>
              <input id="operator-token" type="password" autoComplete="off" autoFocus value={operatorToken} onChange={event => setOperatorToken(event.target.value)} />
              <div className="operator-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setOperatorToken(''); setOperatorAccessOpen(false); }}>Cancel</button>
                <button type="button" className="btn btn-secondary" onClick={() => { sessionStorage.removeItem('medisync_operator_token'); setOperatorToken(''); setOperatorAccessOpen(false); }}>Clear access</button>
                <button type="submit" className="btn btn-primary">Save access</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Emergency Surge Modal */}
      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        hospitals={hospitals}
        onTriggerSurge={handleTriggerSurge}
      />

      {/* Footer */}
      <footer
        style={{
          marginTop: '2rem',
          padding: '1.5rem 2rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          color: '#64748b',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={14} color="#06b6d4" />
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>MediSync AI</span>
          <span>— Intelligent Cross-Hospital Resource Rebalancing System</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              background: 'rgba(139, 92, 246, 0.1)',
              color: '#c084fc',
              fontSize: '0.7rem',
              fontWeight: 600,
            }}
          >
            HACK NEXUS | HN-AI-05
          </span>
          <span>React • FastAPI • MongoDB • Gemini AI • sklearn</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
