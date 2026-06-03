import { useMemo } from "react";
import { lngToGlobalX, latToGlobalY } from "../lib/geo";
import { areaSelectionToBounds } from "../lib/areaSelection";
import type { AreaSelection } from "../lib/areaSelection";

type Props = {
  selection: AreaSelection;
  canvasWidthPx: number;
  canvasHeightPx: number;
  satellite: boolean;
  opacity: number;
};

const TILE_SIZE = 256;

export default function MapBackground({ selection, canvasWidthPx, canvasHeightPx, satellite, opacity }: Props) {
  const { tiles, bgW, bgH } = useMemo(() => {
    const θ = (selection.rotationDeg * Math.PI) / 180;
    const cosT = Math.abs(Math.cos(θ));
    const sinT = Math.abs(Math.sin(θ));
    // Oversize background to cover rotated canvas corners
    const bgW = canvasWidthPx * cosT + canvasHeightPx * sinT;
    const bgH = canvasWidthPx * sinT + canvasHeightPx * cosT;

    const bounds = areaSelectionToBounds(selection);
    const lngSpan = Math.abs(bounds.lng2 - bounds.lng1);
    const zoom = Math.min(19, Math.max(1, Math.round(Math.log2((bgW * 360) / (TILE_SIZE * lngSpan)))));

    const gx1 = lngToGlobalX(bounds.lng1, zoom);
    const gy1 = latToGlobalY(bounds.lat1, zoom);
    const gx2 = lngToGlobalX(bounds.lng2, zoom);
    const gy2 = latToGlobalY(bounds.lat2, zoom);

    const scaleX = bgW / (gx2 - gx1);
    const scaleY = bgH / (gy2 - gy1);
    const n = Math.pow(2, zoom);

    const result = [];
    for (let ty = Math.floor(gy1 / TILE_SIZE); ty <= Math.ceil(gy2 / TILE_SIZE); ty++) {
      for (let tx = Math.floor(gx1 / TILE_SIZE); tx <= Math.ceil(gx2 / TILE_SIZE); tx++) {
        const wrappedTx = ((tx % n) + n) % n;
        const url = satellite
          ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${wrappedTx}`
          : `https://tile.openstreetmap.org/${zoom}/${wrappedTx}/${ty}.png`;
        result.push({
          key: `${tx}-${ty}`,
          url,
          left: (tx * TILE_SIZE - gx1) * scaleX,
          top: (ty * TILE_SIZE - gy1) * scaleY,
          width: TILE_SIZE * scaleX,
          height: TILE_SIZE * scaleY,
        });
      }
    }

    return { tiles: result, bgW, bgH };
  }, [selection, canvasWidthPx, canvasHeightPx, satellite]);

  const attribution = satellite ? "Esri, Maxar, Earthstar Geographics" : "© OpenStreetMap contributors";

  return (
    <div style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: (canvasWidthPx - bgW) / 2,
          top: (canvasHeightPx - bgH) / 2,
          width: bgW,
          height: bgH,
          overflow: "hidden",
          transform: `rotate(${-selection.rotationDeg}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        {tiles.map(({ key, url, left, top, width, height }) => (
          <img key={key} src={url} alt="" draggable={false} style={{ position: "absolute", left, top, width, height }} />
        ))}
        <div
          style={{
            position: "absolute", bottom: 2, right: 4, fontSize: 9,
            color: "rgba(0,0,0,0.6)", background: "rgba(255,255,255,0.7)",
            padding: "1px 4px", borderRadius: 3,
          }}
        >
          {attribution}
        </div>
      </div>
    </div>
  );
}
