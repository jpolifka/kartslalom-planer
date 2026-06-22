// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAuthStore } from "../store/authStore";
import { useTier } from "./useTier";

beforeEach(() => {
  useAuthStore.setState({ profile: null, session: null, isLoading: false });
});

describe("useTier", () => {
  it("free restrictions", () => {
    // No profile → defaults to free tier
    const { result } = renderHook(() => useTier());
    expect(result.current.tier).toBe("free");
    expect(result.current.trackLimit).toBe(3);
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.canUseSatellite).toBe(false);
    expect(result.current.canUsePolygonArea).toBe(false);
    expect(result.current.canShareLinks).toBe(false);
    expect(result.current.canUseVersionHistory).toBe(false);
  });
});
