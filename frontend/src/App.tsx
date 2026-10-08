import React, { useState, useEffect, useCallback } from 'react';
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
import { RegionalMap } from './components/RegionalMap';
import { PredictionsView } from './components/PredictionsView';
import { RecommendationsView } from './components/RecommendationsView';
import { TransfersView } from './components/TransfersView';
import { LedgerView } from './components/LedgerView';
import { EvaluationView } from './components/EvaluationView';
import { Activity, Bell, CheckCircle2, ShieldAlert } from 'lucide-react';

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

  const showToast = (message: string, type: 'success' | 'alert' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Master fetch function
  const fetchAllData = useCallback(async () => {
    try {
      const [h, p, r, t, e, a, s] = await Promise.all([
        getHospitals().catch(() => []),
        getPredictions().catch(() => []),
        getRecommendations().catch(() => []),
        getTransfers().catch(() => []),
        getEvents(40).catch(() => []),
        getAnalytics().catch(() => null),
        getSimulationStatus().catch(() => null),
      ]);

      if (h.length > 0) setHospitals(h);
      if (p.length > 0) setPredictions(p);
      setRecommendations(r);
      setTransfers(t);
      if (e.length > 0) setEvents(e);
      if (a) setAnalytics(a);
      if (s) setSimStatus(s);
    } catch {
      // Background retry handled by interval
    }
  }, []);

  // Real-time WebSocket handler
  const handleWsMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.type === 'tick') {
        if (msg.hospitals) setHospitals(msg.hospitals);
        if (msg.simulated_time && simStatus) {
          setSimStatus((prev) => (prev ? { ...prev, simulated_time: msg.simulated_time, current_tick: msg.tick } : prev));
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
      } else if (
        msg.type === 'recommendation_generated' ||
        msg.type === 'transfer_approved' ||
        msg.type === 'transfer_dispatched' ||
        msg.type === 'transfer_completed'
      ) {
        fetchAllData();
      }
    },
    [fetchAllData, simStatus]
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
              await generateRecommendations();
              await fetchAllData();
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
      </main>

      {/* Emergency Surge Modal */}
      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        hospitals={hospitals}
        onTriggerSurge={handleTriggerSurge}
      />
    </div>
  );
};

export default App;
