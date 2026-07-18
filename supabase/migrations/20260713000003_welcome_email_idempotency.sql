-- Red-Team-Review 2026-07-13: Welcome-Mail-Idempotenz
--
-- send-welcome erlaubte bisher jeden Aufruf innerhalb der ersten 5 Minuten
-- nach Account-Erstellung (nur ein Alters-Check, keine Wiederholungssperre).
-- Jeder Aufrufer mit einem in diesem Fenster gültigen Bearer-Token konnte die
-- Function beliebig oft aufrufen und dadurch mehrfach Willkommens-Mails an
-- dieselbe Adresse auslösen (Resend-Kontingent, Spam, Absenderreputation).
-- Analog zu reminder_150_sent_at/reminder_170_sent_at: ein einmalig gesetztes
-- Sent-At-Feld macht den Versand atomar exactly-once (PATCH ... WHERE
-- welcome_email_sent_at IS NULL, siehe send-welcome/index.ts).

alter table public.profiles
  add column welcome_email_sent_at timestamptz;
