// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type React from "react";

export function mobileDrawerStyle(side: "left" | "right", open: boolean): React.CSSProperties {
  return {
    position: "fixed", top: 0, bottom: 0, [side]: 0,
    width: "min(85vw, 320px)",
    background: "#f1f5f9", zIndex: 160,
    overflowY: "auto", minHeight: 0,
    display: "grid", gap: 12, alignContent: "start",
    padding: 14, boxSizing: "border-box",
    boxShadow: side === "left" ? "4px 0 24px rgba(0,0,0,0.18)" : "-4px 0 24px rgba(0,0,0,0.18)",
    transform: open ? "translateX(0)" : `translateX(${side === "left" ? "-110%" : "110%"})`,
    transition: "transform 0.25s ease",
  };
}

export const card: React.CSSProperties = {
  background: "white",
  borderRadius: 16,
  padding: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

export const outlineBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  width: "100%", borderRadius: 10,
  border: "1px solid #cbd5e1", background: "white",
  padding: "7px 10px", cursor: "pointer", fontSize: 12,
  boxSizing: "border-box",
};

export const dangerBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  width: "100%", borderRadius: 10,
  border: "1px solid #fecaca", background: "white",
  padding: "7px 10px", cursor: "pointer", fontSize: 12,
  color: "#b91c1c", boxSizing: "border-box",
};

export const numInput: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", display: "block",
  marginTop: 3, padding: "5px 8px", borderRadius: 7,
  border: "1px solid #cbd5e1", fontSize: 13,
};

export const divider: React.CSSProperties = {
  width: 1, height: 22, background: "#e2e8f0", flexShrink: 0,
};

export function toolBtn(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    borderRadius: 9, border: active ? "2px solid #2F6C40" : "1px solid #cbd5e1",
    background: active ? "var(--c-primary-bg)" : "white",
    padding: "6px 12px", cursor: "pointer",
    color: active ? "var(--c-primary)" : "#475569",
    fontWeight: active ? 700 : 400,
    fontSize: 12,
  };
}

export function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    borderRadius: 8, border: "1px solid #e2e8f0",
    background: disabled ? "#f8fafc" : "white",
    padding: 6, cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "#cbd5e1" : "#475569",
    width: 30, height: 30, flexShrink: 0,
  };
}

export function badge(type: "error" | "warning"): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    background: type === "error" ? "#fff1f2" : "#fffbeb",
    border: `1px solid ${type === "error" ? "#fecaca" : "#fde68a"}`,
    borderRadius: 8, padding: "3px 9px",
    fontSize: 12, fontWeight: 700,
    color: type === "error" ? "#b91c1c" : "#92400e",
    flexShrink: 0,
  };
}

export const iconBtnLabel: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  borderRadius: 9, border: "1px solid #cbd5e1", background: "white",
  padding: "6px 10px", cursor: "pointer",
  color: "#475569", fontSize: 12, flexShrink: 0,
};
