import React, { useState } from 'react';
import { Hospital, Transfer, Recommendation } from '../types';
import {
  MapPin,
  Truck,
  Shield,
  Zap,
  Clock,
  ArrowRight,
  Activity,
  Layers,
} from 'lucide-react';

interface RegionalMapProps {
  hospitals: Hospital[];
  transfers: Transfer[];
  recommendations: Recommendation[];
  onTriggerSurge: (hospitalId: string, multiplier: number) => Promise<void>;
}

export const RegionalMap: React.FC<RegionalMapProps> = ({
  hospitals,
  transfers,
  recommendations,
  onTriggerSurge,
}) => {
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);

  // SVG coordinate transformation for Delhi NCT coordinates
  // Lat: 28.55 to 28.67
  // Lng: 77.15 to 77.25
  const minLat = 28.55;
  const maxLat = 28.67;
  const minLng = 77.16;
  const maxLng = 77.25;

  const width = 900;
  const height = 550;
  const padding = 70;

  const project = (lat: number, lng: number) => {
    const x = padding + ((lng - minLng) / (maxLng - minLng)) * (width - 2 * padding);
    // Invert lat for SVG y-axis
    const y = padding + ((maxLat - lat) / (maxLat - minLat)) * (height - 2 * padding);
    return { x, y };
  };

  // Pre-calculate positions
  const hospitalPositions: Record<string, { x: number; y: number }> = {};
  hospitals.forEach((h) => {
    hospitalPositions[h.hospital_id] = project(h.latitude, h.longitude);
  });

  // Active routes from recommendations or transfers
  const activeRoutes: Array<{
    sourceId: string;
    targetId: string;
    qty: number;
    isInTransit: boolean;
    label: string;
  }> = [];

  recommendations
    .filter((r) => r.status === 'proposed' || r.status === 'approved')
    .forEach((r) => {
      activeRoutes.push({
        sourceId: r.source_hospital_id,
        targetId: r.destination_hospital_id,
        qty: r.quantity,
        isInTransit: false,
        label: `${r.quantity} cyl (Proposed)`,
      });
    });

  transfers
    .filter((t) => t.status === 'in_transit')
    .forEach((t) => {
      activeRoutes.push({
        sourceId: t.source_hospital_id,
        targetId: t.destination_hospital_id,
        qty: t.quantity,
        isInTransit: true,
        label: `${t.quantity} cyl (In Transit)`,
      });
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Map Card */}
      <div
        className="glass-panel"
        style={{
          padding: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top Control Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={20} color="#06b6d4" />
              Regional Medical Logistics Topology
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Metropolitan Delhi NCT Health Corridor — Live Cross-Facility Dispatch Arcs
            </p>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span style={{ color: '#94a3b8' }}>Surplus Donor</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              <span style={{ color: '#94a3b8' }}>Warning</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f43f5e' }} />
              <span style={{ color: '#94a3b8' }}>Critical Shortage</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                style={{
                  width: '18px',
                  height: '2px',
                  backgroundColor: '#06b6d4',
                  boxShadow: '0 0 8px #06b6d4',
                }}
              />
              <span style={{ color: '#94a3b8' }}>Rebalancing Arc</span>
            </div>
          </div>
        </div>

        {/* Interactive SVG Canvas */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '520px',
            backgroundColor: '#0a0f1d',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* Subtle Grid Radar Background */}
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <defs>
              <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>

              <linearGradient id="transitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>

              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background Grid Lines */}
            {Array.from({ length: 9 }).map((_, i) => (
              <line
                key={`h-${i}`}
                x1={0}
                y1={i * 65}
                x2={width}
                y2={i * 65}
                stroke="rgba(255, 255, 255, 0.03)"
                strokeDasharray="4 4"
              />
            ))}
            {Array.from({ length: 14 }).map((_, i) => (
              <line
                key={`v-${i}`}
                x1={i * 65}
                y1={0}
                x2={i * 65}
                y2={height}
                stroke="rgba(255, 255, 255, 0.03)"
                strokeDasharray="4 4"
              />
            ))}

            {/* Static Regional Baseline Mesh (Transport Corridors) */}
            {hospitals.map((h1, i) =>
              hospitals.slice(i + 1).map((h2) => {
                const p1 = hospitalPositions[h1.hospital_id];
                const p2 = hospitalPositions[h2.hospital_id];
                if (!p1 || !p2) return null;
                return (
                  <line
                    key={`mesh-${h1.hospital_id}-${h2.hospital_id}`}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="rgba(255, 255, 255, 0.04)"
                    strokeWidth="1"
                  />
                );
              })
            )}

            {/* Active Rebalancing Transfer Arcs */}
            {activeRoutes.map((route, idx) => {
              const src = hospitalPositions[route.sourceId];
              const dst = hospitalPositions[route.targetId];
              if (!src || !dst) return null;

              // Quadratic Bezier control point offset for curved route
              const midX = (src.x + dst.x) / 2;
              const midY = (src.y + dst.y) / 2 - 40;
              const pathD = `M ${src.x} ${src.y} Q ${midX} ${midY} ${dst.x} ${dst.y}`;

              return (
                <g key={`route-${idx}`}>
                  {/* Glowing background arc */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={route.isInTransit ? '#38bdf8' : '#06b6d4'}
                    strokeWidth="3"
                    strokeDasharray={route.isInTransit ? '6 4' : 'none'}
                    filter="url(#glow)"
                    opacity="0.8"
                  />
                  {/* Route label at midpoint */}
                  <rect
                    x={midX - 45}
                    y={midY - 12}
                    width="90"
                    height="20"
                    rx="10"
                    fill="#0d1322"
                    stroke="rgba(6, 182, 212, 0.5)"
                    strokeWidth="1"
                  />
                  <text
                    x={midX}
                    y={midY + 2}
                    fill="#22d3ee"
                    fontSize="10"
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {route.label}
                  </text>
                </g>
              );
            })}

            {/* Hospital Nodes */}
            {hospitals.map((h) => {
              const pos = hospitalPositions[h.hospital_id];
              if (!pos) return null;

              const isCritical = h.status === 'critical';
              const isWarning = h.status === 'warning';
              const nodeColor = isCritical ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981';
              const isSelected = selectedHospital?.hospital_id === h.hospital_id;

              return (
                <g
                  key={h.hospital_id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedHospital(h)}
                >
                  {/* Outer Pulsing Wave for Warning/Critical */}
                  {(isCritical || isWarning) && (
                    <circle
                      r="24"
                      fill="none"
                      stroke={nodeColor}
                      strokeWidth="1.5"
                      opacity="0.5"
                    >
                      <animate
                        attributeName="r"
                        values="18;34;18"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.8;0;0.8"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Selection Ring */}
                  {isSelected && (
                    <circle
                      r="22"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                  )}

                  {/* Main Node Circle */}
                  <circle
                    r="15"
                    fill="#0d1322"
                    stroke={nodeColor}
                    strokeWidth="3"
                    filter="url(#glow)"
                  />

                  {/* Inner Stock Ratio Core */}
                  <circle
                    r="8"
                    fill={nodeColor}
                  />

                  {/* Hospital Name & Stock Tag */}
                  <g transform="translate(0, 30)">
                    <rect
                      x="-65"
                      y="-12"
                      width="130"
                      height="24"
                      rx="6"
                      fill="rgba(13, 19, 34, 0.9)"
                      stroke="rgba(255, 255, 255, 0.1)"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fill="#fff"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {h.name.split(' ')[0]} ({Math.round(h.current_stock)} cyl)
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Selected Hospital Floating Inspector Card */}
          {selectedHospital && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                width: '280px',
                padding: '1.25rem',
                backgroundColor: 'rgba(13, 19, 34, 0.95)',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                zIndex: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ color: '#fff', fontSize: '0.95rem' }}>{selectedHospital.name}</h4>
                <button
                  onClick={() => setSelectedHospital(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '1rem',
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                {selectedHospital.location} (28.6°N, 77.2°E)
              </div>

              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: '#94a3b8' }}>Stock Level:</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>
                    {Math.round(selectedHospital.current_stock)} / {selectedHospital.total_capacity}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: '#94a3b8' }}>Safety Buffer:</span>
                  <span style={{ color: '#fb7185', fontWeight: 600 }}>
                    {selectedHospital.minimum_safety_stock} cyl
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: '#94a3b8' }}>Consumption:</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>
                    {selectedHospital.consumption_rate.toFixed(1)} cyl/hr
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: '#94a3b8' }}>Shortage Countdown:</span>
                  <span
                    style={{
                      color:
                        selectedHospital.hours_to_shortage && selectedHospital.hours_to_shortage < 3
                          ? '#fb7185'
                          : '#34d399',
                      fontWeight: 700,
                    }}
                  >
                    {selectedHospital.hours_to_shortage
                      ? `${selectedHospital.hours_to_shortage.toFixed(1)} hrs`
                      : 'Safe'}
                  </span>
                </div>
              </div>

              <button
                className="btn btn-danger btn-sm"
                style={{ width: '100%', marginTop: '0.85rem' }}
                onClick={() => onTriggerSurge(selectedHospital.hospital_id, 3.0)}
              >
                <Zap size={13} />
                Trigger 3x Emergency
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
