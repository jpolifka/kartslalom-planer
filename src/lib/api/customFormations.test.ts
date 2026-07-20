// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Unit: customFormations.ts — Error-Mapping via gemockte Supabase-RPC-Antworten

import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockRpc, mockFrom } = vi.hoisted(() => ({ mockRpc: vi.fn(), mockFrom: vi.fn() }));

vi.mock("../supabase", () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}));

import {
  createCustomFormation,
  updateCustomFormation,
  deleteCustomFormation,
  setDisplayName,
  fetchCustomFormations,
} from "./customFormations";

const BASE_PARAMS = {
  name: "Test",
  description: null,
  category: "individuell" as const,
  cones_json: [],
  arrows_json: [],
  default_direction: null,
  lichte_breite: null,
  duration_seconds: null,
  source_formation_key: null,
  source_custom_formation_id: null,
};

// Simuliert eine Postgres-exception-Message, wie sie eine SECURITY DEFINER RPC
// bei einer Regelverletzung wirft (z. B. Premium-Gate, Limit erreicht) — mapError()
// in customFormations.ts übersetzt diese Rohtexte in stabile Fehlercodes für die UI.
function rpcError(message: string) {
  return Promise.resolve({ data: null, error: { message } });
}

function rpcOk(data: unknown = null) {
  return Promise.resolve({ data, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("customFormations.ts: mapError — createCustomFormation", () => {
  it("premium_required → PREMIUM_REQUIRED", async () => {
    mockRpc.mockReturnValue(rpcError("premium_required"));
    await expect(createCustomFormation(BASE_PARAMS)).rejects.toThrow("PREMIUM_REQUIRED");
  });

  it("custom_formation_limit_reached → FORMATION_LIMIT_REACHED", async () => {
    mockRpc.mockReturnValue(rpcError("custom_formation_limit_reached"));
    await expect(createCustomFormation(BASE_PARAMS)).rejects.toThrow("FORMATION_LIMIT_REACHED");
  });

  it("too_many_cones → TOO_MANY_CONES", async () => {
    mockRpc.mockReturnValue(rpcError("too_many_cones"));
    await expect(createCustomFormation(BASE_PARAMS)).rejects.toThrow("TOO_MANY_CONES");
  });

  it("too_many_arrows → TOO_MANY_ARROWS", async () => {
    mockRpc.mockReturnValue(rpcError("too_many_arrows"));
    await expect(createCustomFormation(BASE_PARAMS)).rejects.toThrow("TOO_MANY_ARROWS");
  });

  it("invalid_name → INVALID_NAME", async () => {
    mockRpc.mockReturnValue(rpcError("invalid_name"));
    await expect(createCustomFormation(BASE_PARAMS)).rejects.toThrow("INVALID_NAME");
  });

  it("invalid_category → INVALID_CATEGORY", async () => {
    mockRpc.mockReturnValue(rpcError("invalid_category"));
    await expect(createCustomFormation(BASE_PARAMS)).rejects.toThrow("INVALID_CATEGORY");
  });

  it("not_authorized → NOT_AUTHORIZED", async () => {
    mockRpc.mockReturnValue(rpcError("not_authorized"));
    await expect(createCustomFormation(BASE_PARAMS)).rejects.toThrow("NOT_AUTHORIZED");
  });

  it("account_deleted → ACCOUNT_DELETED", async () => {
    mockRpc.mockReturnValue(rpcError("account_deleted"));
    await expect(createCustomFormation(BASE_PARAMS)).rejects.toThrow("ACCOUNT_DELETED");
  });

  it("unbekannter Fehler wird unverändert weitergegeben", async () => {
    mockRpc.mockReturnValue(rpcError("unknown_server_error"));
    await expect(createCustomFormation(BASE_PARAMS)).rejects.toThrow("unknown_server_error");
  });

  it("Erfolg gibt UUID zurück", async () => {
    mockRpc.mockReturnValue(rpcOk("abc-123"));
    await expect(createCustomFormation(BASE_PARAMS)).resolves.toBe("abc-123");
  });
});

describe("customFormations.ts: mapError — updateCustomFormation", () => {
  const UPDATE_PARAMS = {
    name: "Update", description: null, category: "individuell" as const,
    cones_json: [], arrows_json: [], default_direction: null,
    lichte_breite: null, duration_seconds: null,
  };

  it("invalid_lichte_breite → INVALID_LICHTE_BREITE", async () => {
    mockRpc.mockReturnValue(rpcError("invalid_lichte_breite"));
    await expect(updateCustomFormation("id-1", UPDATE_PARAMS)).rejects.toThrow("INVALID_LICHTE_BREITE");
  });

  it("invalid_duration_seconds → INVALID_DURATION_SECONDS", async () => {
    mockRpc.mockReturnValue(rpcError("invalid_duration_seconds"));
    await expect(updateCustomFormation("id-1", UPDATE_PARAMS)).rejects.toThrow("INVALID_DURATION_SECONDS");
  });

  it("invalid_cone_coordinates → INVALID_CONE_COORDINATES", async () => {
    mockRpc.mockReturnValue(rpcError("invalid_cone_coordinates"));
    await expect(updateCustomFormation("id-1", UPDATE_PARAMS)).rejects.toThrow("INVALID_CONE_COORDINATES");
  });

  it("Erfolg gibt void zurück (undefined)", async () => {
    mockRpc.mockReturnValue(rpcOk());
    await expect(updateCustomFormation("id-1", UPDATE_PARAMS)).resolves.toBeUndefined();
  });
});

describe("customFormations.ts: mapError — deleteCustomFormation", () => {
  it("not_authorized → NOT_AUTHORIZED", async () => {
    mockRpc.mockReturnValue(rpcError("not_authorized"));
    await expect(deleteCustomFormation("id-1")).rejects.toThrow("NOT_AUTHORIZED");
  });
});

describe("customFormations.ts: fetchCustomFormations", () => {
  // RLS erlaubt zusätzlich geteilte und Library-Formationen (is_library=true) —
  // ohne expliziten Owner-Filter würden diese fälschlich unter "Meine Hindernisse"
  // auftauchen (siehe PR #16).
  it("filtert explizit nach owner_id statt sich allein auf RLS zu verlassen", async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [{ id: "f1", owner_id: "user-123" }], error: null });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockFrom.mockReturnValue({ select: selectMock });

    const result = await fetchCustomFormations("user-123");

    expect(mockFrom).toHaveBeenCalledWith("custom_formations");
    expect(eqMock).toHaveBeenCalledWith("owner_id", "user-123");
    expect(orderMock).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(result).toEqual([{ id: "f1", owner_id: "user-123" }]);
  });
});

describe("customFormations.ts: setDisplayName Error-Mapping", () => {
  it("invalid_display_name → INVALID_DISPLAY_NAME", async () => {
    mockRpc.mockReturnValue(rpcError("invalid_display_name"));
    await expect(setDisplayName("X")).rejects.toThrow("INVALID_DISPLAY_NAME");
  });

  it("account_deleted → ACCOUNT_DELETED", async () => {
    mockRpc.mockReturnValue(rpcError("account_deleted"));
    await expect(setDisplayName("Name")).rejects.toThrow("ACCOUNT_DELETED");
  });

  it("null löscht Anzeigenamen ohne Fehler", async () => {
    mockRpc.mockReturnValue(rpcOk());
    await expect(setDisplayName(null)).resolves.toBeUndefined();
  });
});
