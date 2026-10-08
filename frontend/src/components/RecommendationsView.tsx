import React, { useState } from 'react';
import { Recommendation } from '../types';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
  RotateCw,
  Bot,
} from 'lucide-react';

interface RecommendationsViewProps {
  recommendations: Recommendation[];
  onApprove: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  recommendations,
  onApprove,
  onCancel,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'all' | 'proposed' | 'approved' | 'completed'>('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const filteredRecs = recommendations.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const handleApprove = async (id: string) => {
    setLoadingId(id);
    try {
      await onApprove(id);
    } finally {
      setLoadingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setLoadingId(id);
    try {
      await onCancel(id);
    } finally {
      setLoadingId(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    if (urgency === 'critical') return <span className="badge badge-critical">Critical Urgency</span>;
    if (urgency === 'high') return <span className="badge badge-critical">High Priority</span>;
    if (urgency === 'medium') return <span className="badge badge-warning">Medium Priority</span>;
    return <span className="badge badge-normal">Routine</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner with Action Controls */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderLeft: '4px solid #8b5cf6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc',
              boxShadow: '0 0 15px rgba(139, 92, 246, 0.25)',
            }}
          >
            <Sparkles size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Gemini AI Cross-Hospital Rebalance Engine
              <span className="badge badge-ai" style={{ fontSize: '0.7rem' }}>
                Gemini 2.0 Flash
              </span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Multi-criteria donor matching ensuring mathematical safety buffers and transit feasibility
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Status Filter */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '8px',
              padding: '0.2rem',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {(['all', 'proposed', 'approved'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  background: filter === tab ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                  color: filter === tab ? '#fff' : '#94a3b8',
                  border: 'none',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RotateCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>Generate Rebalance</span>
          </button>
        </div>
      </div>

      {/* Recommendations Cards List */}
      {filteredRecs.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '3rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h3 style={{ color: '#fff', fontSize: '1.15rem' }}>Network Equilibrium Maintained</h3>
          <p style={{ color: '#94a3b8', maxWidth: '480px', fontSize: '0.85rem' }}>
            All 6 medical centers currently have adequate oxygen reserve buffers. No inter-hospital
            rebalancing transfers required at this simulated timestamp.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={handleRefresh}>
            Run Diagnostic Scan
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredRecs.map((rec) => {
            const isProposed = rec.status === 'proposed';
            const isLoading = loadingId === rec.recommendation_id;

            return (
              <div
                key={rec.recommendation_id}
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  border: isProposed
                    ? '1px solid rgba(139, 92, 246, 0.4)'
                    : '1px solid var(--border-subtle)',
                  background: isProposed
                    ? 'linear-gradient(180deg, rgba(20, 28, 48, 0.85) 0%, rgba(13, 19, 34, 0.95) 100%)'
                    : 'var(--bg-card)',
                }}
              >
                {/* Top Row: Donor -> Recipient + Urgency */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Donor Card */}
                    <div
                      style={{
                        padding: '0.65rem 1rem',
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 600 }}>
                        SURPLUS DONOR
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                        {rec.source_hospital_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Stock: {Math.round(rec.source_current_stock)} cyl
                      </div>
                    </div>

                    {/* Arrow with transfer quantity */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: '#22d3ee',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          background: 'rgba(6, 182, 212, 0.15)',
                          border: '1px solid rgba(6, 182, 212, 0.3)',
                        }}
                      >
                        +{rec.quantity} Cylinders
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#06b6d4' }}>
                        <ArrowRight size={20} />
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Clock size={11} /> {rec.estimated_transport_minutes} mins
                      </div>
                    </div>

                    {/* Recipient Card */}
                    <div
                      style={{
                        padding: '0.65rem 1rem',
                        borderRadius: '10px',
                        background: 'rgba(244, 63, 94, 0.08)',
                        border: '1px solid rgba(244, 63, 94, 0.3)',
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', color: '#fb7185', fontWeight: 600 }}>
                        RECIPIENT FACILITY
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                        {rec.destination_hospital_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Current: {Math.round(rec.destination_current_stock)} cyl
                        {rec.destination_hours_to_shortage !== undefined && (
                          <span style={{ color: '#fb7185', marginLeft: '0.35rem' }}>
                            ({rec.destination_hours_to_shortage.toFixed(1)}h left)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    {getUrgencyBadge(rec.urgency)}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: isProposed ? '#c084fc' : '#34d399',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      Status: {rec.status}
                    </span>
                  </div>
                </div>

                {/* Gemini AI Rationale Deep Dive */}
                <div
                  style={{
                    padding: '1.1rem 1.25rem',
                    borderRadius: '12px',
                    background: 'rgba(139, 92, 246, 0.07)',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(139, 92, 246, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#c084fc',
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#c084fc',
                        letterSpacing: '0.04em',
                        marginBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      GEMINI AI CLINICAL RATIONALE & SAFETY VALIDATION
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {rec.explanation || (
                        <span>
                          Transfer recommendation created to prevent impending depletion at{' '}
                          {rec.destination_hospital_name}. Donor {rec.source_hospital_name} retains
                          adequate safety stock above minimum threshold.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Human-in-the-Loop Operator Decision Bar */}
                {isProposed && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <ShieldCheck size={14} color="#10b981" />
                      <span>Mathematical donor safety invariant verified. Human authorization required.</span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={isLoading}
                        onClick={() => handleCancel(rec.recommendation_id)}
                      >
                        <XCircle size={14} />
                        Dismiss
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isLoading}
                        onClick={() => handleApprove(rec.recommendation_id)}
                      >
                        <CheckCircle size={14} />
                        {isLoading ? 'Authorizing...' : 'Approve & Allocate'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
