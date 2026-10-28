# LearnHarness Mobile

Adaptiver KI-Lern-Tutor für **Android** und **iPhone/iPad** — powered by Google Gemini.

**[⬇️ Android: APK herunterladen (v1.6.0)](https://github.com/KilllerBoss/learnharness-mobile/releases/download/v1.6.0/LearnHarness-Mobile-v1.6.0.apk)**
**[🍎 iPhone/iPad: Web-App öffnen](https://killlerboss.github.io/learnharness-mobile/)**

## Features
- **🆕 Mehrsprachig**: Oberfläche **Русский / Deutsch / English** — **Standard: Russisch**. Beim ersten Start wird die Gerätesprache erkannt (ru → Russisch, de → Deutsch, sonst Russisch); in ⚙️ Einstellungen jederzeit umstellbar. Muttersprache & Lernziel (Deutsch/Englisch/Russisch) frei wählbar
- **🆕 10 KI-Anbieter**: Google Gemini, **Pollinations (kostenlos, ohne API-Key, funktioniert in Russland!)**, VseGPT, DeepSeek, **Xiaomi MiMo (neu in v1.6.0, offizielle API, sehr günstig)**, OpenRouter, Groq, Mistral, Hugging Face — plus eigener Endpoint (OpenAI-Format)
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

## 🌍 Für Nutzer in Russland
Gemini ist dort blockiert. In der App unter Einstellungen → **KI-Anbieter** einfach **Pollinations** wählen — kostenlos und **ohne API-Key** nutzbar. Alternativen: **Xiaomi MiMo** (offizielle Xiaomi-API, sehr günstig, OpenAI-Format), VseGPT (Zahlung mit russischen Karten), DeepSeek (günstig), Hugging Face (kostenlos mit Token). OpenRouter ist in Russland blockiert.

## 🍎 iPhone & iPad (iOS) installieren
Apple erlaubt keine APK-artigen Direkt-Downloads — deshalb läuft LearnHarness auf dem iPhone als **Web-App (PWA)** mit gleichem Funktionsumfang: Wissensgraph, Lernpläne, Quiz, Bild-Upload, Spracheingabe.

**So wird's installiert (2 Minuten):**
1. **Safari** öffnen (wichtig: nicht Chrome!) und diese Adresse aufrufen:
   **https://killlerboss.github.io/learnharness-mobile/**
2. Unten auf **Teilen** tippen (Quadrat mit Pfeil nach oben)
3. **„Zum Home-Bildschirm"** auswählen
4. **„Hinzufügen"** tippen — fertig: LearnHarness liegt als eigenes Icon auf dem Startbildschirm und öffnet sich vollflächig wie eine native App

Hinweise:
- Startet **automatisch auf Russisch** (bzw. Deutsch/Englisch je nach Gerätesprache) — umschaltbar unter ⚙️ Einstellungen → «Язык приложения»
- Kostenloser Gemini-API-Key: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — einmal in der App unter ⚙️ Einstellungen eintragen
- Funktioniert auch **offline** (App-Oberfläche wird gespeichert; Antworten braucht natürlich Internet)
- Läuft genauso auf iPad und Mac (Safari) sowie auf Android-Geräten ohne APK-Installation

## Downloads (Release v1.6.0)
| Datei | Beschreibung |
|---|---|
| [LearnHarness-Mobile-v1.6.0.apk](https://github.com/KilllerBoss/learnharness-mobile/releases/download/v1.6.0/LearnHarness-Mobile-v1.6.0.apk) | Installierbare App (8,9 MB, signiert) |
| [learnharness-mobile-source.zip](https://github.com/KilllerBoss/learnharness-mobile/releases/download/v1.6.0/learnharness-mobile-source.zip) | Vollständiger Quellcode (v1.6.0) |
| [learnharness-release.keystore](https://github.com/KilllerBoss/learnharness-mobile/releases/download/v1.0.0/learnharness-release.keystore) | Signatur-Schlüssel (Alias: learnharness) |

## Tech-Stack
Capacitor 7 · React 18 · TypeScript · Vite 6 · Gemini API (SSE-Streaming, ListModels)

> Min SDK: Android 12 (API 31) · Target SDK: Android 15 (API 35)
