# LearnHarness Mobile v1.0.0

Adaptiver KI-Lerntutor für Android — die Mobile-Adaption von
[learnharness](https://github.com/amosblomqvist/learnharness) mit Gemini API,
gebaut nach dem UI-Design-System aus `design.md` (Dark Mode, Composer-Pill,
Model-Selector).

---

## 📲 Installation auf dem Galaxy S26 Ultra

1. **`LearnHarness-Mobile-v1.0.0.apk`** auf das Handy übertragen
   (USB, Cloud, oder direkt im Handy-Browser herunterladen).
2. APK antippen → Android fragt, ob Apps aus dieser Quelle installiert
   werden dürfen → **Zulassen** (das APK ist selbst signiert, kein Play Store).
3. App öffnen → **Einstellungen → Gemini API → API-Schlüssel** einfügen →
   **Testen** → grünes Häkchen → fertig.

Schlüssel kostenlos erstellen: **https://aistudio.google.com/apikey**

> Empfohlenes Startmodell: **Gemini 2.5 Flash** (Standard) — schnell und
> günstig. Pro ist für schwere Probleme, Lite für einfache Fragen.

## ✨ Funktionen

| Bereich | Beschreibung |
|---|---|
| **Adaptiver Tutor** | Diagnose → Plan → Lehren in Denk-Schritten → Üben (learnharness-Methodik, komplett deutsch) |
| **Denkmodus** (Glühbirne) | Aktiviert Gemini Thinking — der Modell-Gedankengang ist einblendbar („Gedankengang") |
| **3 Modelle** | Flash / Flash-Lite / Pro umschaltbar über die Model-Pill unten rechts |
| **Wissensgraph** | Extrahiert automatisch Konzepte + Aussagen + Abhängigkeiten aus jedem Dialog (persistiert, Ansicht mit Force-Graph, Beherrschungs-Level, „X üben"-Button) |
| **Sessions** | Mehrere Lern-Chats mit Verlauf im Drawer (Icon oben links) |
| **Bild-Upload** | `+` → Kamera oder Galerie — Aufgaben/Diagramme werden von Gemini vision-analysiert |
| **Notizen-Import** | `.txt`/`.md` im Drawer importieren → Tutor startet mit Wissenseinschätzung |
| **Sprachdiktat** | Mikrofon-Button — Android-Spracherkennung, **on-device** (Galaxy-Sprachengine/NPU, sofern verfügbar) |
| **Vorlesen (TTS)** | Lautsprecher-Icon unter Antworten — lokale System-Stimme, Rate einstellbar |
| **Markdown + Mathe** | Vollwertiges Rendering: Code-Blöcke mit Copy-Button, KaTeX-Formeln, Tabellen |
| **Datenschutz** | API-Key und alle Daten bleiben lokal auf dem Gerät (localStorage), Export als JSON |

## 🔐 Signatur / Updates

```
Keystore:  learnharness-release.keystore  (liegt neben der APK)
Alias:     learnharness
Passwort:  LearnHarness2026!
Schema:    APK Signature Scheme v2 · SHA384withRSA, 2048 Bit
```

⚠️ **Keystore sicher aufbewahren** — nur damit signierte Updates installieren
Android ohne Deinstallation. Für den Play Store später einen eigenen Keystore
verwenden.

## 🧱 Technik

- **Capacitor 7** (native WebView-Shell) + **React 18** + **TypeScript** + **Vite 6**
- **Gemini API** (`v1beta`, SSE-Streaming, `thinkingConfig`, `responseSchema`-JSON, Vision)
- **Native Bridge** `LearnSpeechPlugin.java`: `android.speech.SpeechRecognizer`
  + `android.speech.tts.TextToSpeech` (beides on-device Engines)
- minSdk 31 (Android 12) · targetSdk 35 · ~8,8 MB · keine Tracker, keine Analytics
- Lizenz: AGPL-3.0 (erbt vom Original-Projekt)

## 🔧 Selbst bauen

```bash
# Voraussetzungen: Node 20+, JDK 21, Android SDK (android-35, build-tools 35)
cd learnharness-mobile
npm install
npm run apk            # build + cap sync + gradle assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

Web-Only-Entwicklung: `npm run dev` (Vite-Dev-Server im Browser).

## 📸 Screenshots

Siehe Ordner `screenshots/` (Leer-Zustand, Modell-Menü, Streaming, Verlauf,
Wissensgraph, Einstellungen — 412×893, wie auf dem S26 Ultra gerendert).
