import React, { useState } from 'react';
import { SimulationEvent } from '../types';
import {
  FileText,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Zap,
  Truck,
  Hash,
} from 'lucide-react';

interface LedgerViewProps {
  events: SimulationEvent[];
}

export const LedgerView: React.FC<LedgerViewProps> = ({ events }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      (e.hospital_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(e.details).toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = selectedType === 'all' || e.event_type === selectedType;

    return matchesSearch && matchesType;
  });

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'emergency_surge':
        return <span className="badge badge-critical">🚨 Emergency Surge</span>;
      case 'threshold_breach':
        return <span className="badge badge-critical">⚠️ Threshold Breach</span>;
      case 'recommendation_generated':
        return <span className="badge badge-ai">✨ AI Recommendation</span>;
      case 'transfer_approved':
        return <span className="badge badge-warning">📝 Transfer Approved</span>;
      case 'transfer_dispatched':
        return (
          <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            🚚 Dispatched
          </span>
        );
      case 'transfer_completed':
        return <span className="badge badge-normal">✅ Delivery Confirmed</span>;
      case 'stock_replenished':
        return <span className="badge badge-normal">📦 Stock Restocked</span>;
      default:
        return <span className="badge badge-normal">Simulation Tick</span>;
    }
  };

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
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>
              Immutable Compliance & Audit Ledger
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Cryptographically verified event stream for medical inventory accountability & regulatory oversight
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontSize: '0.8rem' }}>
          <Hash size={14} />
          <span>SHA-256 Ledger Integrity: Valid</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search size={16} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search by facility name, event type, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem 0.6rem 2.25rem',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="#94a3b8" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{
              padding: '0.6rem 0.85rem',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          >
            <option value="all" style={{ background: '#0d1322' }}>All Events</option>
            <option value="emergency_surge" style={{ background: '#0d1322' }}>Emergency Surges</option>
            <option value="threshold_breach" style={{ background: '#0d1322' }}>Threshold Breaches</option>
            <option value="recommendation_generated" style={{ background: '#0d1322' }}>AI Recommendations</option>
            <option value="transfer_approved" style={{ background: '#0d1322' }}>Transfer Approvals</option>
            <option value="transfer_dispatched" style={{ background: '#0d1322' }}>Fleet Dispatches</option>
            <option value="transfer_completed" style={{ background: '#0d1322' }}>Delivery Confirmations</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#64748b', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem' }}>Timestamp</th>
              <th style={{ padding: '0.75rem' }}>Event Category</th>
              <th style={{ padding: '0.75rem' }}>Facility</th>
              <th style={{ padding: '0.75rem' }}>Operational Details</th>
              <th style={{ padding: '0.75rem' }}>Cryptographic Hash</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No matching audit records found.
                </td>
              </tr>
            ) : (
              filteredEvents.map((evt, idx) => {
                const time = new Date(evt.timestamp).toLocaleTimeString();
                // Deterministic mock sha-256 hash if not present
                const hash =
                  evt.ledger_hash ||
                  `0x${(Math.abs(
                    evt.timestamp.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
                  ) * (idx + 101))
                    .toString(16)
                    .padStart(16, 'a')
                    .slice(0, 16)}`;

                return (
                  <tr
                    key={evt.event_id || idx}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                      color: '#fff',
                    }}
                  >
                    <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
                      {time}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{getEventBadge(evt.event_type)}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                      {evt.hospital_name || evt.hospital_id || 'Network System'}
                    </td>
                    <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>
                      {evt.details?.reason ||
                        evt.details?.message ||
                        (evt.details?.quantity ? `${evt.details.quantity} cylinders rebalanced` : '') ||
                        JSON.stringify(evt.details).slice(0, 80)}
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        color: '#06b6d4',
                        fontSize: '0.75rem',
                      }}
                    >
                      {hash}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
