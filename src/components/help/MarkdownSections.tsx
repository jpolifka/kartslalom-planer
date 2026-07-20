// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";

const bodyStyle: React.CSSProperties = { fontSize: 13, color: "#475569", lineHeight: 1.6 };
const kbdStyle: React.CSSProperties = {
  display: "inline-block", border: "1px solid #cbd5e1", borderBottom: "2px solid #cbd5e1",
  borderRadius: 5, padding: "1px 6px", fontSize: 12, fontFamily: "monospace",
  background: "#f8fafc", color: "#334155",
};

const mdComponents: Components = {
  h2: ({ children }) => (
    <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{children}</h4>
  ),
  p: ({ children }) => <p style={{ ...bodyStyle, margin: "0 0 8px" }}>{children}</p>,
  ul: ({ children }) => <ul style={{ ...bodyStyle, margin: "4px 0", paddingLeft: 20 }}>{children}</ul>,
  li: ({ children }) => <li>{children}</li>,
  code: ({ children }) => <span style={kbdStyle}>{children}</span>,
};

export default function MarkdownSections({ sections }: { sections: string[] }) {
  return (
    <>
      {sections.map((raw, i) => (
        <section key={i} style={{ marginTop: 16 }}>
          <ReactMarkdown components={mdComponents}>{raw}</ReactMarkdown>
        </section>
      ))}
    </>
  );
}
