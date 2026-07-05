// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React from "react";

export function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 16 }}>
      <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{title}</h4>
      <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{children}</div>
    </section>
  );
}

export function ImprintContent() {
  const ul: React.CSSProperties = { margin: "4px 0", paddingLeft: 20 };
  const link: React.CSSProperties = { color: "var(--c-primary)" };
  return (
    <div>
      <HelpSection title="Angaben gemäß § 5 DDG / Verantwortlicher nach § 18 Abs. 2 MStV">
        Jens Polifka<br />
        In der Maar 31<br />
        56598 Rheinbrohl<br />
        E-Mail: <a href="mailto:jens@polifka.info" style={link}>jens@polifka.info</a>
      </HelpSection>

      <h3 id="datenschutz" style={{ margin: "26px 0 0", fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
        Datenschutzerklärung
      </h3>

      <HelpSection title="1. Verantwortlicher">
        Verantwortlich für die Datenverarbeitung auf dieser Website ist:
        <p style={{ margin: "6px 0" }}>
          Jens Polifka<br />
          In der Maar 31<br />
          56598 Rheinbrohl<br />
          E-Mail: <a href="mailto:jens@polifka.info" style={link}>jens@polifka.info</a>
        </p>
      </HelpSection>

      <HelpSection title="2. Allgemeine Hinweise">
        Der Schutz Ihrer personenbezogenen Daten ist mir ein wichtiges Anliegen.
        Diese Datenschutzerklärung informiert darüber, welche Daten beim Besuch
        dieser Website verarbeitet werden und zu welchen Zwecken dies geschieht.
        <p style={{ margin: "6px 0 0" }}>
          Diese Website dient der Bereitstellung eines Kartslalom-Streckenplaners.
          Die Nutzung der Anwendung ist grundsätzlich ohne Registrierung möglich.
        </p>
      </HelpSection>

      <HelpSection title="3. Hosting und Server-Logfiles">
        Beim Aufruf dieser Website werden durch den Hostinganbieter automatisch
        Informationen in sogenannten Server-Logfiles erfasst. Dies sind insbesondere:
        <ul style={ul}>
          <li>IP-Adresse des aufrufenden Geräts</li>
          <li>Datum und Uhrzeit des Zugriffs</li>
          <li>aufgerufene Seite oder Datei</li>
          <li>Browsertyp und Browserversion</li>
          <li>verwendetes Betriebssystem</li>
          <li>Referrer-URL (sofern vom Browser übermittelt)</li>
          <li>übertragene Datenmenge</li>
        </ul>
        Die Verarbeitung dieser Daten erfolgt zur technischen Bereitstellung der
        Website, zur Gewährleistung der Systemsicherheit sowie zur Fehleranalyse.
        <p style={{ margin: "6px 0 0" }}>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Das berechtigte Interesse
          liegt in einem sicheren und störungsfreien Betrieb der Website.
        </p>
      </HelpSection>

      <HelpSection title="4. Nutzung von OpenStreetMap">
        Diese Website verwendet Kartendaten von OpenStreetMap (OSM).
        <p style={{ margin: "6px 0" }}>
          Beim Laden der Karten werden Kartendaten von Servern der OpenStreetMap
          Foundation abgerufen. Dabei wird Ihre IP-Adresse an die Server von
          OpenStreetMap übermittelt, da dies technisch erforderlich ist.
        </p>
        <p style={{ margin: "6px 0" }}>
          Anbieter:<br />
          OpenStreetMap Foundation<br />
          St John's Innovation Centre<br />
          Cowley Road<br />
          Cambridge CB4 0WS<br />
          Vereinigtes Königreich
        </p>
        <p style={{ margin: "6px 0" }}>
          Die Nutzung erfolgt im Interesse einer benutzerfreundlichen Darstellung
          von Karten und Streckenverläufen.
        </p>
        <p style={{ margin: "6px 0" }}>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
        </p>
        <p style={{ margin: "6px 0 0" }}>
          Weitere Informationen zum Datenschutz bei OpenStreetMap finden Sie unter:{" "}
          <a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noreferrer" style={link}>
            osmfoundation.org/wiki/Privacy_Policy
          </a>
        </p>
      </HelpSection>

      <HelpSection title="5. Nutzung von Cloudflare">
        Diese Website nutzt Dienste von Cloudflare zur Verbesserung der Sicherheit
        und Verfügbarkeit der Website.
        <p style={{ margin: "6px 0" }}>
          Anbieter:<br />
          Cloudflare, Inc.<br />
          101 Townsend Street<br />
          San Francisco, CA 94107<br />
          USA
        </p>
        Cloudflare verarbeitet technische Informationen wie insbesondere:
        <ul style={ul}>
          <li>IP-Adresse</li>
          <li>Browserinformationen</li>
          <li>Geräteinformationen</li>
          <li>Zeitpunkt des Zugriffs</li>
          <li>sicherheitsrelevante Verbindungsdaten</li>
        </ul>
        Cloudflare kann zudem technische Schutzmechanismen einsetzen, um
        automatisierte Angriffe und missbräuchliche Zugriffe zu erkennen und
        abzuwehren.
        <p style={{ margin: "6px 0" }}>
          Die Nutzung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Das
          berechtigte Interesse besteht in der sicheren Bereitstellung und dem
          Schutz der Website vor Angriffen und Missbrauch.
        </p>
        <p style={{ margin: "6px 0 0" }}>
          Weitere Informationen:{" "}
          <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer" style={link}>
            cloudflare.com/privacypolicy
          </a>
        </p>
      </HelpSection>

      <HelpSection title="6. Verarbeitung von Streckendaten">
        <strong>Gast-Modus (ohne Anmeldung):</strong> Die erstellten Streckenpläne
        werden ausschließlich lokal im Browser gespeichert (localStorage). Es werden
        keine Streckendaten an den Betreiber übermittelt.
        <p style={{ margin: "6px 0 0" }}>
          <strong>Mit Account (angemeldet):</strong> Streckenpläne werden in der
          Cloud gespeichert (Supabase, siehe Abschnitt 7). Dabei werden die
          Streckendaten (Formationen, Kartenausschnitt, Einstellungen) sowie
          Metadaten (Titel, Zeitstempel) an den Server übertragen und dort
          gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO
          (Vertragserfüllung).
        </p>
      </HelpSection>

      {/*
        PROD-RISK / Rechtlicher Hinweis: Text unten spiegelt den Umzug von
        Supabase Cloud (Auftragsverarbeiter Supabase Inc., Singapur, Hosting
        AWS eu-central-1) auf selbst betriebene, self-hosted Supabase-Software
        auf eigener Infrastruktur (Deutschland). Vom Nutzer bestätigt: kein
        Auftragsverarbeiter mehr für diesen Teil, stattdessen eigener Betrieb.
        Trotzdem vor Live-Schaltung juristisch gegenprüfen lassen (z. B. ob
        eine AV-Vereinbarung mit Cloudflare für den Zero-Trust-Tunnel nötig
        ist) - das hier ist kein Ersatz für eine anwaltliche Prüfung.
      */}
      <HelpSection title="7. Speicherung von Konto- und Streckendaten (self-hosted)">
        Für registrierte Nutzer werden Authentifizierung und Cloud-Speicherung über
        die selbst betriebene Open-Source-Software Supabase bereitgestellt. Es findet
        keine Auftragsverarbeitung durch die Supabase Inc. statt — die Software läuft
        auf eigener Serverinfrastruktur des Betreibers.
        <p style={{ margin: "6px 0" }}>
          Betreiber der Infrastruktur:<br />
          Jens Polifka<br />
          In der Maar 31<br />
          56598 Rheinbrohl<br />
          Deutschland
        </p>
        <p style={{ margin: "6px 0" }}>
          Der Zugriff auf den Server erfolgt über einen Cloudflare-Tunnel
          (Cloudflare Zero Trust) — siehe Abschnitt 5 zur Nutzung von Cloudflare.
        </p>
        <p style={{ margin: "6px 0" }}>
          Bei der Registrierung und Anmeldung per Magic Link wird die E-Mail-Adresse
          verarbeitet. Gespeichert werden außerdem die erstellten Streckenpläne sowie
          das gewählte Nutzerprofil (Tarif). Die Datenhaltung erfolgt in Deutschland.
        </p>
        <p style={{ margin: "6px 0 0" }}>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
        </p>
      </HelpSection>

      <HelpSection title="8. Kontolöschung und Inaktivitätsregel">
        <strong>Kontolöschung auf Anfrage (Art. 17 DSGVO):</strong> Über den Bereich
        „Einstellungen" in der Anwendung können Sie Ihr Konto jederzeit selbst löschen.
        Dabei werden Ihr Benutzerprofil, alle gespeicherten Streckenpläne sowie Ihre
        Authentifizierungsdaten unwiderruflich und vollständig gelöscht (Hard Delete).
        Eine Wiederherstellung ist nicht möglich. Alternativ können Sie die Löschung
        per E-Mail an{" "}
        <a href="mailto:jens@polifka.info" style={link}>jens@polifka.info</a> beantragen.
        <p style={{ margin: "8px 0" }}>
          <strong>Automatische Deaktivierung bei Inaktivität:</strong> Um Daten nicht
          länger als notwendig vorzuhalten, werden Konten nach längerem Nichtgebrauch
          automatisch deaktiviert:
        </p>
        <ul style={ul}>
          <li>
            <strong>Nach 150 Tagen</strong> Inaktivität: erste Erinnerungsmail an
            die hinterlegte E-Mail-Adresse
          </li>
          <li>
            <strong>Nach 170 Tagen</strong> Inaktivität: zweite Erinnerungsmail mit
            Hinweis auf die bevorstehende Deaktivierung
          </li>
          <li>
            <strong>Nach 180 Tagen</strong> Inaktivität: Konto wird deaktiviert;
            Profil und Streckendaten werden nicht mehr zugänglich gemacht. Eine
            Reaktivierung ist nicht automatisch möglich — bitte wenden Sie sich an{" "}
            <a href="mailto:jens@polifka.info" style={link}>jens@polifka.info</a>.
          </li>
        </ul>
        <p style={{ margin: "6px 0 0" }}>
          Inaktivität bedeutet, dass kein Login und keine Datenänderung stattgefunden
          hat. Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO
          (berechtigtes Interesse an Datensparsamkeit gemäß Art. 5 Abs. 1 lit. e DSGVO).
        </p>
      </HelpSection>

      <HelpSection title="9. Kontaktaufnahme per E-Mail">
        Wenn Sie per E-Mail Kontakt aufnehmen, werden die von Ihnen übermittelten
        Daten ausschließlich zur Bearbeitung Ihrer Anfrage verwendet.
        <p style={{ margin: "6px 0" }}>
          Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO.
          Sofern die Kontaktaufnahme auf den Abschluss oder die Durchführung eines
          Vertrags abzielt, erfolgt die Verarbeitung zusätzlich auf Grundlage von
          Art. 6 Abs. 1 lit. b DSGVO.
        </p>
        <p style={{ margin: "6px 0 0" }}>
          Die Daten werden nicht ohne Ihre Einwilligung an Dritte weitergegeben.
        </p>
      </HelpSection>

      <HelpSection title="10. Ihre Rechte">
        Sie haben im Rahmen der geltenden gesetzlichen Bestimmungen das Recht auf:
        <ul style={ul}>
          <li>Auskunft über Ihre gespeicherten Daten (Art. 15 DSGVO)</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
          <li>Löschung Ihrer Daten (Art. 17 DSGVO) — siehe Abschnitt 8</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO) — Datenexport in den Einstellungen</li>
          <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
        </ul>
        Zur Ausübung Ihrer Rechte können Sie sich jederzeit an die oben genannte
        Kontaktadresse wenden.
      </HelpSection>

      <HelpSection title="11. Beschwerderecht bei einer Aufsichtsbehörde">
        Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde über die
        Verarbeitung Ihrer personenbezogenen Daten zu beschweren.
        <p style={{ margin: "6px 0 0" }}>
          Zuständig ist insbesondere die Datenschutzaufsichtsbehörde Ihres
          gewöhnlichen Aufenthaltsortes, Ihres Arbeitsplatzes oder des Orts des
          mutmaßlichen Verstoßes.
        </p>
      </HelpSection>

      <HelpSection title="12. Änderungen dieser Datenschutzerklärung">
        Ich behalte mir vor, diese Datenschutzerklärung anzupassen, sofern dies
        aufgrund technischer oder rechtlicher Änderungen erforderlich wird.
        <p style={{ margin: "10px 0 0", color: "#94a3b8", fontSize: 12 }}>
          Stand: Juni 2026
        </p>
      </HelpSection>
    </div>
  );
}
