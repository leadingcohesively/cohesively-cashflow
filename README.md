# Cohesively Cashflow — Reisterrassen (Beta)

**Transparenz → Entscheidungsfähigkeit → finanzielle Souveränität.**

Ein bewusstes Finanz-Tool: kein Tracker, kein Budget-Polizist. Es macht sichtbar,
wohin dein Geld fließt — und operationalisiert deine Ziele über drei Terrassen:
**Schutz → Sicherheit → Freiheit.**

## Für Testerinnen & Tester

1. Link öffnen (oder `index.html` doppelklicken — läuft komplett ohne Server)
2. Der geführte Einstieg (~15 Min) nimmt dich mit durch Haushalt → Konten → Einnahmen → Fixkosten → Ziele
3. Ausgaben erfasst du unterwegs über **＋ Erfassen** (oder Taste `n`)

**Wichtig zu deinen Daten:**
- Alles bleibt **lokal in deinem Browser** — nichts wird an einen Server geschickt
- Gleicher Browser + gleiches Gerät nötig; „Browserdaten löschen“ löscht auch deine Einträge
- Deshalb: Unter **Daten → Daten exportieren** regelmäßig ein Backup ziehen (JSON-Datei)
- Beim Feedback kannst du die Export-Datei mitschicken — nur wenn du magst

## Technik

Vanilla HTML/CSS/JS, kein Build, keine Abhängigkeiten. Vier Dateien:
`index.html`, `styles.css`, `data.js` (Datenschicht + fiktive Beispieldaten), `app.js` (Logik & Views).
