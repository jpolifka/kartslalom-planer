// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildTrackPngBlob, pngFilenameFromTrackName } from "../api/renderTrackPng";
import type { PlacedFormation } from "../../../types";

function customItem(): PlacedFormation {
  return {
    id: "pf1", key: "singlePylon",
    x: 5, y: 5, rotationDeg: 0, direction: "none",
  };
}

describe("pngFilenameFromTrackName", () => {
  it("baut Dateinamen aus Streckennamen", () => {
    expect(pngFilenameFromTrackName("Mein Slalom")).toBe("kartslalom_Mein Slalom.png");
  });

  it("entfernt unzulässige Zeichen", () => {
    expect(pngFilenameFromTrackName('Test/<>:*?"')).toBe("kartslalom_Test.png");
  });

  it("fällt auf generischen Namen zurück wenn leer", () => {
    expect(pngFilenameFromTrackName("   ")).toBe("kartslalom.png");
  });
});

// jsdom rendert kein echtes Canvas — Context, toBlob und Image werden durch
// Fakes ersetzt, die nur den Ablauf (nicht das tatsächliche Rasterisieren) prüfen.
describe("buildTrackPngBlob", () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalImage = global.Image;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
      callback(new Blob(["fake-png"], { type: "image/png" }));
    };

    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    global.Image = FakeImage as unknown as typeof Image;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    global.Image = originalImage;
  });

  it("liefert einen PNG-Blob (weißer Hintergrund)", async () => {
    const blob = await buildTrackPngBlob(18, 36, [customItem()], [], "white");
    expect(blob.type).toBe("image/png");
  });

  it("liefert einen PNG-Blob (transparenter Hintergrund)", async () => {
    const blob = await buildTrackPngBlob(18, 36, [customItem()], [], "transparent");
    expect(blob.type).toBe("image/png");
  });

  it("wirft einen Fehler, wenn kein 2D-Kontext verfügbar ist", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    await expect(buildTrackPngBlob(18, 36, [customItem()], [], "white")).rejects.toThrow(
      "Canvas-2D-Kontext"
    );
  });

  it("wirft einen Fehler, wenn das SVG-Bild nicht geladen werden kann", async () => {
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    global.Image = FailingImage as unknown as typeof Image;

    await expect(buildTrackPngBlob(18, 36, [customItem()], [], "white")).rejects.toThrow(
      "konnte nicht als Bild geladen werden"
    );
  });
});
