// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState, useEffect } from "react";

// 860px: unterhalb dieser Breite passt das dreispaltige Editor-Layout
// (LeftSidebar 276px + Canvas + RightPanel 296px, siehe EditorPage-Grid) nicht
// mehr komfortabel nebeneinander — ab hier schaltet der Editor auf das
// Ein-Spalten-Layout mit Sidebars als ausklappbare mobile Schubladen um.
export const MOBILE_BREAKPOINT = 860;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    // matchMedia + change-Event statt eines resize-Listeners: feuert nur beim
    // Über-/Unterschreiten der Schwelle, nicht bei jedem Pixel Größenänderung.
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}
