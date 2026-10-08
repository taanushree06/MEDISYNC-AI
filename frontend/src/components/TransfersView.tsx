import React, { useState } from 'react';
import { Transfer } from '../types';
import {
  Truck,
  CheckCircle2,
  ArrowRight,
  Send,
  PackageCheck,
} from 'lucide-react';

interface TransfersViewProps {
  transfers: Transfer[];
  onDispatch: (id: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
}

export const TransfersView: React.FC<TransfersViewProps> = ({
  transfers,
  onDispatch,
  onComplete,
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleDispatch = async (id: string) => {
    setLoadingId(id);
    try {
      await onDispatch(id);
    } finally {
      setLoadingId(null);
    }
  };

  const handleComplete = async (id: string) => {
    setLoadingId(id);
    try {
      await onComplete(id);
    } finally {
      setLoadingId(null);
    }
  };

  const activeTransfers = transfers.filter(
    (t) => t.status === 'approved' || t.status === 'in_transit'
  );
  const completedTransfers = transfers.filter((t) => t.status === 'completed');

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
          borderLeft: '4px solid #38bdf8',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <Truck size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>
              Inter-Hospital Logistics Operations
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Conserved mass resource tracking — physical transit verification and delivery signoff
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
          <div style={{ color: '#38bdf8', fontWeight: 600 }}>
            {activeTransfers.length} Active Shipments
          </div>
          <div style={{ color: '#10b981', fontWeight: 600 }}>
            {completedTransfers.length} Completed Hand-offs
          </div>
        </div>
      </div>

      {/* Active Dispatches */}
      <div>
        <h3
          style={{
            fontSize: '0.95rem',
            color: '#94a3b8',
            marginBottom: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Active Logistics Operations
        </h3>

        {activeTransfers.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '0.85rem',
            }}
          >
            No active transport vehicles currently dispatched. Approve recommendations to schedule transfers.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activeTransfers.map((t) => {
              const isApproved = t.status === 'approved';
              const isInTransit = t.status === 'in_transit';
              const isLoading = loadingId === t.transfer_id;

              return (
                <div
                  key={t.transfer_id}
                  className="glass-panel"
                  style={{
                    padding: '1.25rem 1.5rem',
                    border: isInTransit
                      ? '1px solid rgba(56, 189, 248, 0.4)'
                      : '1px solid var(--border-subtle)',
                    background: isInTransit ? 'rgba(56, 189, 248, 0.05)' : 'var(--bg-card)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    {/* Route Details */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                          ORIGIN
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                          {t.source_hospital_name}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: '#38bdf8',
                            background: 'rgba(56, 189, 248, 0.15)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                          }}
                        >
                          {t.quantity} cyl
                        </span>
                        <ArrowRight size={18} color="#38bdf8" />
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          ~{t.estimated_transport_minutes} min
                        </span>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#fb7185', fontWeight: 600 }}>
                          DESTINATION
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                          {t.destination_hospital_name}
                        </div>
                      </div>
                    </div>

                    {/* Step Lifecycle Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: isApproved ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          color: isApproved ? '#fbbf24' : '#38bdf8',
                          border: `1px solid ${isApproved ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <span className={`pulse-indicator ${isInTransit ? 'active' : ''}`} />
                        {isInTransit ? 'IN TRANSIT (DISPATCHED)' : 'APPROVED (READY AT DOCK)'}
                      </div>

                      {/* Action buttons */}
                      {isApproved && (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={isLoading}
                          onClick={() => handleDispatch(t.transfer_id)}
                        >
                          <Send size={13} />
                          {isLoading ? 'Dispatching...' : 'Dispatch Vehicle'}
                        </button>
                      )}

                      {isInTransit && (
                        <button
                          className="btn btn-success btn-sm"
                          disabled={isLoading}
                          onClick={() => handleComplete(t.transfer_id)}
                        >
                          <PackageCheck size={14} />
                          {isLoading ? 'Confirming...' : 'Confirm Delivery'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Transfers Table */}
      {completedTransfers.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              color: '#94a3b8',
              marginBottom: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Completed Delivery History
          </h3>

          <div
            className="glass-panel"
            style={{
              padding: '1rem',
              overflowX: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Transfer ID</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Donor Hospital</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Recipient Hospital</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Quantity</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Dispatched At</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Completed At</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {completedTransfers.map((c) => (
                  <tr
                    key={c.transfer_id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#fff' }}
                  >
                    <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', color: '#06b6d4' }}>
                      {c.transfer_id.slice(0, 12)}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>{c.source_hospital_name}</td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>{c.destination_hospital_name}</td>
                    <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#38bdf8' }}>
                      +{c.quantity} cyl
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#94a3b8' }}>
                      {c.dispatched_at ? new Date(c.dispatched_at).toLocaleTimeString() : '--'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#94a3b8' }}>
                      {c.completed_at ? new Date(c.completed_at).toLocaleTimeString() : '--'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <span className="badge badge-normal">
                        <CheckCircle2 size={12} /> Delivered
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
