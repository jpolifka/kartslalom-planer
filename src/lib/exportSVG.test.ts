// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateTrackSVG, exportPDF, resolveWmsExportImage } from "./exportSVG";

// PDF-Mocks: jsPDF und svg2pdf.js brauchen keine echten Browser-APIs
vi.mock("jspdf", () => {
  class MockJsPDF {
    internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
    setFont()  { return this; }
    setFontSize() { return this; }
    setTextColor() { return this; }
    setDrawColor() { return this; }
    text() { return this; }
    line() { return this; }
    save() { return this; }
    svg() { return Promise.resolve(); }
  }
  return { jsPDF: MockJsPDF };
});
vi.mock("svg2pdf.js", () => ({ default: () => undefined }));

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));
vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: mockGetSession } },
  functionsUrl: (name: string) => `https://fn.test/functions/v1/${name}`,
}));

import type { PlacedFormation } from "../types";
import type { PdfMapConfig } from "./exportSVG";

const snap = {
  cones: [
    { id: "c1", x: 0, y: 0, kind: "standing" as const, angleDeg: 0 },
    { id: "c2", x: 1, y: 0, kind: "standing" as const, angleDeg: 0 },
  ],
  arrows: [],
  label: "Mein Slalom-Bogen",
};

function customItem(extra: Partial<PlacedFormation> = {}): PlacedFormation {
  return {
    id: "pf1", key: "custom",
    x: 5, y: 5, rotationDeg: 0, direction: "none",
    customFormationId: "cf-deleted",
    customSnapshot: snap,
    ...extra,
  };
}

// H5: SVG-Export mit gelöschter Quelle — customSnapshot muss ausreichen
describe("generateTrackSVG mit customSnapshot", () => {
  it("wirft keinen Fehler wenn Quelle gelöscht (nur customSnapshot vorhanden)", () => {
    expect(() =>
      generateTrackSVG(18, 36, [customItem()], [])
    ).not.toThrow();
  });

  it("SVG enthält den Snapshot-Label als Text", () => {
    const svg = generateTrackSVG(18, 36, [customItem()], []);
    expect(svg).toContain("Mein Slalom-Bogen");
  });

  it("SVG enthält Cones aus dem Snapshot", () => {
    const svg = generateTrackSVG(18, 36, [customItem()], []);
    // stehendes Pylone = rect-Element (kein circle)
    expect(svg).toContain("<rect");
  });

  it("wirft keinen Fehler bei fehlendem Snapshot (Fallback-Platzhalter)", () => {
    const item: PlacedFormation = {
      id: "pf2", key: "custom",
      x: 3, y: 3, rotationDeg: 0, direction: "none",
    };
    expect(() =>
      generateTrackSVG(18, 36, [item], [])
    ).not.toThrow();
  });

  it("Fallback-Platzhalter enthält Warnung im Label", () => {
    const item: PlacedFormation = {
      id: "pf2", key: "custom",
      x: 3, y: 3, rotationDeg: 0, direction: "none",
    };
    const svg = generateTrackSVG(18, 36, [item], []);
    expect(svg).toContain("Unbekanntes Hindernis");
  });

  it("rotiertes customSnapshot wird ohne Fehler gerendert", () => {
    expect(() =>
      generateTrackSVG(18, 36, [customItem({ rotationDeg: 45 })], [])
    ).not.toThrow();
  });

  it("gemischter Track (standard + custom) wird korrekt gerendert", () => {
    const standard: PlacedFormation = {
      id: "pf3", key: "singlePylon",
      x: 2, y: 2, rotationDeg: 0, direction: "none",
    };
    expect(() =>
      generateTrackSVG(18, 36, [standard, customItem()], [])
    ).not.toThrow();
  });

  it("SVG ist valides XML (öffnet und schließt svg-Tag)", () => {
    const svg = generateTrackSVG(18, 36, [customItem()], []);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("</svg>");
  });
});

// PNG-Export nutzt generateTrackSVG() mit background="transparent" wieder,
// statt einer eigenen Rendering-Pipeline.
describe("generateTrackSVG mit background-Parameter", () => {
  it("zeichnet standardmäßig einen weißen Hintergrund", () => {
    const svg = generateTrackSVG(18, 36, [customItem()], []);
    expect(svg).toContain('fill="white"');
  });

  it("lässt bei background=\"transparent\" kein weißes Hintergrundrechteck einfügen", () => {
    const svg = generateTrackSVG(18, 36, [customItem()], [], null, "transparent");
    expect(svg).not.toContain('fill="white"');
  });

  it("bei background=\"transparent\" fehlen Raster, Rand und m-Beschriftung (sauberes Overlay)", () => {
    const svg = generateTrackSVG(18, 36, [customItem()], [], null, "transparent");
    expect(svg).not.toContain("#e2e8f0");
    expect(svg).not.toContain("#cbd5e1");
    expect(svg).not.toContain('stroke="#0f172a" stroke-width="3"');
    expect(svg).not.toContain('<g font-family="Arial,sans-serif" font-size=');
  });

  it("bei background=\"white\" sind Raster/Rand/Beschriftung weiterhin vorhanden", () => {
    const svg = generateTrackSVG(18, 36, [customItem()], []);
    expect(svg).toContain("#e2e8f0");
    expect(svg).toContain("#cbd5e1");
    expect(svg).toContain('stroke="#0f172a" stroke-width="3"');
  });

  it("Raster ist ohne Kartenhintergrund gedämpft (opacity 0.35, nicht voll deckend)", () => {
    const svg = generateTrackSVG(18, 36, [customItem()], []);
    expect(svg).toContain('stroke="#e2e8f0" stroke-width="1" opacity="0.35"');
  });
});

// H5: PDF-Smoke-Test — Custom-Snapshot überlebt PDF-Erzeugung
describe("exportPDF mit customSnapshot (Smoke-Test)", () => {
  it("wirft keinen Fehler bei gelöschter Quellformation (nur Snapshot)", async () => {
    await expect(
      exportPDF(18, 36, [customItem()], [], null, "test.pdf")
    ).resolves.not.toThrow();
  });

  it("wirft keinen Fehler bei leerem Track", async () => {
    await expect(
      exportPDF(18, 36, [], [], null, "test.pdf")
    ).resolves.not.toThrow();
  });

  it("SVG-Container-Inhalt ist nicht leer (Snapshot-Geometrie vorhanden)", async () => {
    let capturedInnerHTML = "";
    const realAppendChild = document.body.appendChild.bind(document.body);
    const spy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      if (node instanceof HTMLElement) {
        capturedInnerHTML = node.innerHTML;
      }
      return realAppendChild(node);
    });

    await exportPDF(18, 36, [customItem()], [], null, "test.pdf");
    spy.mockRestore();

    expect(capturedInnerHTML).toContain("<svg");
    expect(capturedInnerHTML).toContain("Mein Slalom-Bogen");
  });

  it("PDF-Erzeugung mit Fallback-Platzhalter (kein Snapshot) wirft nicht", async () => {
    const itemWithoutSnapshot: import("../types").PlacedFormation = {
      id: "pf-nosnapshot", key: "custom",
      x: 5, y: 5, rotationDeg: 0, direction: "none",
    };
    await expect(
      exportPDF(18, 36, [itemWithoutSnapshot], [], null, "test.pdf")
    ).resolves.not.toThrow();
  });
});

describe("resolveWmsExportImage", () => {
  const wmsMapConfig: PdfMapConfig = {
    selection: { centerLat: 49.9929, centerLng: 8.2473, widthM: 40, heightM: 40, rotationDeg: 0 },
    providerId: "rlp_dop20",
    opacity: 0.5,
  };
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockGetSession.mockReset();
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    // jsdom kennt readAsDataURL nicht mit echten Bytes — Ergebnis reicht hier als Marker.
    vi.stubGlobal(
      "FileReader",
      class {
        onload: (() => void) | null = null;
        result = "data:image/jpeg;base64,Zm9v";
        readAsDataURL() {
          this.onload?.();
        }
      }
    );
  });

  it("liefert null für xyz-Provider (osm) ohne WMS-Auflösung", async () => {
    const result = await resolveWmsExportImage(
      { ...wmsMapConfig, providerId: "osm" },
      18,
      36
    );
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("Gast-Modus (keine Session): holt das Bild direkt vom WMS-Dienst und liefert eine data:-URI", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockFetch.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } })
    );

    const result = await resolveWmsExportImage(wmsMapConfig, 18, 36);

    expect(result).toBe("data:image/jpeg;base64,Zm9v");
    // Kein Proxy-Aufruf, direkter Fetch gegen die WMS-GetMap-URL
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("geo4.service24.rlp.de/wms/rp_dop20.fcgi");
  });

  it("Gast-Modus: fällt bei fehlgeschlagenem direktem Fetch auf die rohe Bild-URL zurück", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await resolveWmsExportImage(wmsMapConfig, 18, 36);

    expect(result).toContain("geo4.service24.rlp.de/wms/rp_dop20.fcgi");
  });

  it("Gast-Modus: fällt bei Nicht-200-Antwort auf die rohe Bild-URL zurück", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockFetch.mockResolvedValue(new Response("", { status: 500 }));

    const result = await resolveWmsExportImage(wmsMapConfig, 18, 36);

    expect(result).toContain("geo4.service24.rlp.de/wms/rp_dop20.fcgi");
  });

  it("Gast-Modus: fällt bei ungültigem Content-Type (kein image/*) auf die rohe Bild-URL zurück", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockFetch.mockResolvedValue(
      new Response("<ServiceExceptionReport/>", { status: 200, headers: { "content-type": "text/xml" } })
    );

    const result = await resolveWmsExportImage(wmsMapConfig, 18, 36);

    expect(result).toContain("geo4.service24.rlp.de/wms/rp_dop20.fcgi");
  });

  it("Gast-Modus: fällt bei zu großer Antwort auf die rohe Bild-URL zurück", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const oversized = new Uint8Array(16 * 1024 * 1024);
    mockFetch.mockResolvedValue(
      new Response(oversized, { status: 200, headers: { "content-type": "image/jpeg" } })
    );

    const result = await resolveWmsExportImage(wmsMapConfig, 18, 36);

    expect(result).toContain("geo4.service24.rlp.de/wms/rp_dop20.fcgi");
  });

  it("mit aktiver Session: löst das Bild über den map-background-image-Proxy auf", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "tok-123" } } });
    mockFetch.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

    const result = await resolveWmsExportImage(wmsMapConfig, 18, 36);

    expect(result).toBe("data:image/jpeg;base64,Zm9v");
    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://fn.test/functions/v1/map-background-image");
    expect((calledInit.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
  });
});
