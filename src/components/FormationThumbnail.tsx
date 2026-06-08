// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { boundsFromCones } from "../lib/geometry";
import type { FormationDefinition } from "../types";

export default function FormationThumbnail({
  formation,
  size = 52,
  rotationDeg = 0,
}: {
  formation: FormationDefinition;
  size?: number;
  rotationDeg?: number;
}) {
  const { cones, key } = formation;
  // Physical radius of the pylon foot (30 x 30 cm base)
  const CONE_RADIUS_M = 0.15;
  const pad = size * 0.13;
  const markerId = `th-arr-${key}-${rotationDeg}`;
  const mid = size / 2;

  if (cones.length === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <defs>
          <marker id={markerId} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <polygon points="0 0,5 2.5,0 5" fill="#475569" />
          </marker>
        </defs>
        <g transform={`rotate(${rotationDeg},${mid},${mid})`}>
          <line
            x1={size * 0.1} y1={mid}
            x2={size * 0.8} y2={mid}
            stroke="#475569" strokeWidth={2}
            markerEnd={`url(#${markerId})`}
          />
        </g>
      </svg>
    );
  }

  const b = boundsFromCones(cones);
  // Expand bounds by one cone radius on each side so physically touching cones appear touching
  const bw = Math.max(b.width + 2 * CONE_RADIUS_M, 2 * CONE_RADIUS_M);
  const bh = Math.max(b.height + 2 * CONE_RADIUS_M, 2 * CONE_RADIUS_M);
  const usable = size - 2 * pad;
  const s = Math.min(usable / bw, usable / bh);
  const pylonR = Math.max(1.5, CONE_RADIUS_M * s);
  const ox = pad + (usable - bw * s) / 2;
  const oy = pad + (usable - bh * s) / 2;

  const px = (x: number) => ox + (x - b.minX + CONE_RADIUS_M) * s;
  const py = (y: number) => oy + (y - b.minY + CONE_RADIUS_M) * s;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <g transform={`rotate(${rotationDeg},${mid},${mid})`}>
        {formation.areaColor && formation.areaLabel && cones.length > 0 && (() => {
          const nonSensor = cones.filter((c) => c.kind !== "sensor");
          if (nonSensor.length === 0) return null;
          const ax = Math.min(...nonSensor.map((c) => c.x));
          const ay = Math.min(...nonSensor.map((c) => c.y));
          const aw = Math.max(...nonSensor.map((c) => c.x)) - ax;
          const ah = Math.max(...nonSensor.map((c) => c.y)) - ay;
          return (
            <g key="area">
              <rect
                x={px(ax)} y={py(ay)}
                width={aw * s} height={ah * s}
                rx={2}
                fill={`${formation.areaColor}55`}
                stroke={formation.areaColor}
                strokeWidth={1}
              />
              <text
                x={px(ax) + (aw * s) / 2}
                y={py(ay) + (ah * s) / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(6, size * 0.13)}
                fontWeight="700"
                fill="#1e293b"
              >
                {formation.areaLabel}
              </text>
            </g>
          );
        })()}
        {cones.map((c, i) => {
          const cx = px(c.x);
          const cy = py(c.y);
          if (c.kind === "sensor") {
            return <circle key={i} cx={cx} cy={cy} r={pylonR * 0.7} fill="#0f172a" />;
          }
          if (c.kind === "lying") {
            return (
              <polygon
                key={i}
                points={`${cx},${cy - pylonR} ${cx - pylonR * 0.85},${cy + pylonR * 0.6} ${cx + pylonR * 0.85},${cy + pylonR * 0.6}`}
                fill="#334155"
                transform={`rotate(${c.angleDeg ?? 0},${cx},${cy})`}
              />
            );
          }
          return (
            <rect
              key={i}
              x={cx - pylonR} y={cy - pylonR}
              width={pylonR * 2} height={pylonR * 2}
              rx={1}
              fill="#f97316"
              stroke="#9a3412"
              strokeWidth={0.5}
            />
          );
        })}
      </g>
    </svg>
  );
}
