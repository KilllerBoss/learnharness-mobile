# LearnHarness Mobile

Adaptiver KI-Lern-Tutor für Android — powered by Google Gemini.

**[⬇️ APK herunterladen (v1.1.0)](https://github.com/KilllerBoss/learnharness-mobile/releases/download/v1.1.0/LearnHarness-Mobile-v1.1.0.apk)**

## Features
- **🆕 Live-Modellkatalog**: Ruft die verfügbaren Gemini-Modelle live von der API ab — immer aktuell (Gemini 4 Argon, 3.8 Flash, 3.5 Flash-Lite, …), ohne App-Update
- **Gemini 2.5→Migration**: Alte Modellauswahlen werden automatisch auf die aktuelle Generation umgestellt
- **Lern-Workflow**: Diagnose → Lernplan → Lehre → Übungen (adaptiv, komplett deutsch)
- **Interaktiver Wissensgraph** mit Canvas-Force-Layout
- **Bild-Upload (Vision)** und **Sprachdiktat** (geräteseitig, offline)
- **Markdown + KaTeX** für perfekte Formeldarstellung
- **Thinking-Mode** (Glühbirnen-Toggle) für tiefere Antworten
- **Vollständig lokal**: API-Key und Chats bleiben auf dem Gerät

## Installation
1. APK über den Link oben herunterladen
2. In Android-Einstellungen „Installation aus unbekannten Quellen" für den Browser erlauben
3. APK öffnen und installieren (Android 12+)
4. Kostenlosen API-Key auf [aistudio.google.com/apikey](https://aistudio.google.com/apikey) erstellen
5. Key in der App unter ⚙️ Einstellungen eingeben — los geht's!

## Downloads (Release v1.1.0)
| Datei | Beschreibung |
|---|---|
| [LearnHarness-Mobile-v1.1.0.apk](https://github.com/KilllerBoss/learnharness-mobile/releases/download/v1.1.0/LearnHarness-Mobile-v1.1.0.apk) | Installierbare App (8,8 MB, signiert) |
| [learnharness-mobile-source-v1.1.0.zip](https://github.com/KilllerBoss/learnharness-mobile/releases/download/v1.1.0/learnharness-mobile-source-v1.1.0.zip) | Vollständiger Quellcode |
| [learnharness-release.keystore](https://github.com/KilllerBoss/learnharness-mobile/releases/download/v1.0.0/learnharness-release.keystore) | Signatur-Schlüssel (Alias: learnharness) |

## Tech-Stack
Capacitor 7 · React 18 · TypeScript · Vite 6 · Gemini API (SSE-Streaming, ListModels)

> Min SDK: Android 12 (API 31) · Target SDK: Android 15 (API 35)
