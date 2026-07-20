// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";

// Passwortloser Login (Magic Link / OTP statt Passwort): kein Passwort-Reset-
// Flow, kein Passwort-Leak-Risiko, keine wiederverwendeten schwachen
// Passwörter — Supabase verschickt stattdessen einen einmaligen Link UND
// einen 8-stelligen Code in derselben Mail. Der Link ist der Normalfall,
// der Code ist der Fallback für den PKCE-Sonderfall (siehe unten).
export default function LoginPage() {
  const { session } = useAuthStore();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "verifying" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [otp, setOtp] = useState("");
  const authError = new URLSearchParams(window.location.search).get("auth_error");

  if (session) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      // Supabase liefert hier u. a. auch Rate-Limit-Fehler (zu viele
      // Anfragen für dieselbe E-Mail/IP in kurzer Zeit) als normale
      // error.message zurück — es gibt keine gesonderte Behandlung dafür,
      // die Meldung wird einfach 1:1 im Fehlerblock unten angezeigt.
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("verifying");
    setErrorMsg("");
    // Fallback für den Fall, dass der Magic-Link in einem anderen
    // Browser/Gerät geöffnet wird als dem, in dem der Code angefordert wurde
    // (PKCE braucht einen lokal gespeicherten code_verifier — siehe
    // AuthCallbackPage). Der 8-stellige OTP-Code aus derselben Mail
    // funktioniert dagegen browser-/geräteunabhängig.
    const { error } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: "email" });
    if (error) {
      setStatus("sent");
      setErrorMsg(error.message);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f1f5f9", color: "#0f172a", padding: 16,
    }}>
      <div style={{
        background: "white", borderRadius: 16, padding: 32,
        width: "min(380px, 100%)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        boxSizing: "border-box",
      }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800 }}>
          Kartslalom Streckenplaner
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
          Melde dich mit deiner E-Mail-Adresse an. Du erhältst einen Anmeldelink per E-Mail.
        </p>
        {authError === "pkce" && (
          <div style={{
            background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#92400e",
            marginBottom: 16,
          }}>
            <strong>Anmeldelink in anderem Browser geöffnet.</strong><br />
            Bitte fordere unten einen neuen Link an und gib den <strong>8-stelligen Code</strong> aus
            der E-Mail direkt hier ein — das funktioniert browserübergreifend.
          </div>
        )}

        {status === "sent" || status === "verifying" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#166534",
            }}>
              Anmeldelink wurde an <strong>{email}</strong> gesendet. Klicke auf den Link in der E-Mail
              oder gib den 8-stelligen Code ein.
              <br />
              Falls die E-Mail nicht ankommt: bitte auch im Spam- bzw. Junk-Ordner nachsehen.
            </div>
            <form onSubmit={handleOtpSubmit} style={{ display: "grid", gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                8-stelliger Code aus der E-Mail
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="12345678"
                  autoFocus
                  style={{
                    width: "100%", boxSizing: "border-box", display: "block",
                    marginTop: 4, padding: "9px 10px", borderRadius: 8,
                    border: "1px solid #cbd5e1", fontSize: 20, letterSpacing: "0.25em",
                    textAlign: "center",
                  }}
                />
              </label>
              {errorMsg && (
                <div style={{
                  background: "#fff1f2", border: "1px solid #fecaca",
                  borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#b91c1c",
                }}>
                  {errorMsg}
                </div>
              )}
              <button
                type="submit"
                disabled={status === "verifying" || otp.length < 8}
                style={{
                  borderRadius: 10, border: "none", background: "var(--c-primary)",
                  color: "white", padding: "10px 14px", fontSize: 14, fontWeight: 700,
                  cursor: (status === "verifying" || otp.length < 8) ? "not-allowed" : "pointer",
                  opacity: otp.length < 8 ? 0.6 : 1,
                }}
              >
                {status === "verifying" ? "Wird geprüft…" : "Code bestätigen"}
              </button>
            </form>
            <button
              onClick={() => { setStatus("idle"); setOtp(""); setErrorMsg(""); }}
              style={{
                background: "none", border: "none", color: "#64748b",
                fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0,
              }}
            >
              Andere E-Mail-Adresse verwenden
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
              E-Mail-Adresse
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@beispiel.de"
                style={{
                  width: "100%", boxSizing: "border-box", display: "block",
                  marginTop: 4, padding: "9px 10px", borderRadius: 8,
                  border: "1px solid #cbd5e1", fontSize: 14,
                }}
              />
            </label>
            {status === "error" && (
              <div style={{
                background: "#fff1f2", border: "1px solid #fecaca",
                borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#b91c1c",
              }}>
                {errorMsg}
              </div>
            )}
            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                borderRadius: 10, border: "none", background: "var(--c-primary)",
                color: "white", padding: "10px 14px", fontSize: 14, fontWeight: 700,
                cursor: status === "sending" ? "wait" : "pointer",
              }}
            >
              {status === "sending" ? "Wird gesendet…" : "Anmeldelink senden"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
