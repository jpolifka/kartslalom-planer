// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useMemo } from "react";
import { computeMapRenderLayout } from "../lib/mapRender";
import type { AreaSelection } from "../lib/areaSelection";
import type { MapProviderId } from "../lib/mapProviders";

type Props = {
  selection: AreaSelection;
  canvasWidthPx: number;
  canvasHeightPx: number;
  providerId: MapProviderId;
  opacity: number;
};

export default function MapBackground({ selection, canvasWidthPx, canvasHeightPx, providerId, opacity }: Props) {
  const layout = useMemo(
    () => computeMapRenderLayout({ selection, providerId, opacity }, canvasWidthPx, canvasHeightPx),
    [selection, canvasWidthPx, canvasHeightPx, providerId, opacity]
  );

  return (
    <div style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: layout.left,
          top: layout.top,
          width: layout.bgW,
          height: layout.bgH,
          overflow: "hidden",
          transform: `rotate(${-selection.rotationDeg}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        {layout.kind === "xyz" ? (
          layout.tiles.map(({ url, x, y, w, h }) => (
            <img key={`${x}-${y}`} src={url} alt="" draggable={false} style={{ position: "absolute", left: x, top: y, width: w, height: h }} />
          ))
        ) : (
          <img
            src={layout.imageUrl}
            alt=""
            draggable={false}
            style={{ position: "absolute", left: 0, top: 0, width: layout.bgW, height: layout.bgH }}
          />
        )}
        <div
          style={{
            position: "absolute", bottom: 2, right: 4, fontSize: 9,
            color: "rgba(0,0,0,0.6)", background: "rgba(255,255,255,0.7)",
            padding: "1px 4px", borderRadius: 3,
          }}
        >
          {layout.attribution}
        </div>
      </div>
    </div>
  );
}
