# LearnHarness Mobile — Worklog

## v1.7.0 (2026-10-28) — Mercury 3 (Inception) als 11. KI-Anbieter + Stale-Closure-Fix
- **Mercury 3 (Inception Labs)** integriert (`providers.ts`, Position nach Gemini):
  - Diffusion-LLM (dLLM), 1000+ Tok/s, 1M Kontext; OpenAI-kompatibel über `api.inceptionlabs.ai/v1`
  - Endpunkt live geprüft: `/models` öffentlich (200), Chat Bearer-Key (401 ohne), Streaming SSE ✓
  - Startguthaben 100 Mio. freie Tokens; danach Aktionspreis 0,10/0,35 $ pro 1M
  - Badges `free` + `ruTest`, Key-URL `platform.inceptionlabs.ai`, defaultModel `mercury-3`
- **Diffusion-Eigenheiten verifiziert** (User-Hinweis „Beachte es ist ein Diffusion model"):
  - Streaming liefert ganze Blöcke statt Token — Parser chunkgrößen-agnostisch, keine Änderung nötig
  - Verschlüsseltes Reasoning (`reasoning_details.mercury-v1`) wird elegant ignoriert
  - Live-E2E: Antwort + automatische Wissensgraph-Extraktion (6 Konzepte) mit Mercury 3 ✓
- **BUGFIX Stale-Closure (kritisch, traf ALLE OpenAI-Provider):** `send()` hielt alte
  `runTurn`-Referenz (Deps `[activeId, updateChat]`) → Key-Eintrag + sofortiges Senden
  im selben Setup-Flow las `openaiKey=''` → `keyOk=false` → stummer Abbruch + Settings
  öffnete sich. Fix: `settingsRef`/`thinkingRef` (frisch-gelesen in runTurn/runExtraction),
  Deps bereinigt. E2E bestätigt: Setup-Flow → Senden → Antwort streamt ✓
- **CORS-Fallbacks für Inception** (GET `/models` hat keine CORS-Header, POST chat schon):
  - Key-Test: GET /models → bei Netz/CORS-Fehler minimaler POST-Chat-Check (max_tokens 8)
  - Modell-Picker: statische `fallbackModels` (mercury-3/2.5/2/decide) wenn Live-Abruf scheitert
- i18n: 2 deutsche Hardcodes im SettingsSheet ersetzt (`settings.keyLocal[Google]`, de/ru/en).
- versionCode 8 (v1.6.0 wurde fälschlich noch mit 7+versionName 1.5.0 gebaut — jetzt korrekt).
- Builds: tsc clean, PWA + Android; E2E auf Produktion (Key-Test ✓, Chat-Streaming ✓,
  Modellliste ✓, Extraktion ✓); PWA redeployt.
- Release v1.7.0: APK (signiert, 8,9 MB) + Source-Zip; README aktualisiert.

## v1.6.0 (2026-10-28) — Xiaomi MiMo als 10. KI-Anbieter
- **Xiaomi MiMo** als Provider-Preset ergänzt (`src/lib/providers.ts`):
  - baseUrl `https://api.xiaomimimo.com/v1`, OpenAI-Protokoll, Modelle live via `/models`
  - defaultModel `mimo-v2.6-flash` (V2.5 wurde am 21.10.2026 abgeschaltet → V2.6-Serie)
  - Key-URL `https://mimo.mi.com`, Badges `paid` + `ruTest` (Endpunkt geprüft: OpenAI-Format, 401 sauber; Russland-Erreichbarkeit ungeprüft)
- Custom-Provider („Benutzerdefiniert", OpenAI-kompatibel, freie Basis-URL) unverändert voll funktionsfähig — verifiziert per E2E (Base-URL-Feld, Key-Feld, Modell-Eingabe).
- Version 1.5.0 → 1.6.0 (`version.ts`, `package.json`), SW-Cache `lh-pwa-v3`.
- Builds: PWA (`--base=/learnharness-mobile/ --outDir dist-pwa`) + Android (`dist`), tsc clean.
- E2E (agent-browser): ru-Umschaltung live, MiMo-Felder/Badges/Link, Custom-Felder, kein Chinesisch in PWA, keine Konsolenfehler.
- PWA neu deployt (gh-pages, force push) — live verifiziert: „MiMo LIVE OK" auf Produktion.
- Release v1.6.0: APK (signiert, 8,9 MB, Gradle mit portablem Temurin-JDK 21 + Android SDK 35) + Source-Zip.
- README aktualisiert (10 Anbieter, Russland-Sektion, v1.6.0-Links), Commit `39fa376`.

## v1.5.0 (2026-10-28) — Russisch als Standard, Chinesisch entfernt
- UI-Sprachen de/ru/en; Gerätesprach-Erkennung (ru→RU, de→DE, unbekannt→RU, en→EN).
- Chinesisch-Pinyin aus der Sprachauswahl entfernt (PWA + Android).
- Muttersprache + Lernziel (de/en/ru) als eigene Einstellungen — Tutor antwortet in der App-Sprache.

## v1.4.0 (2026-10-28) — Mehrsprachig + 8 KI-Anbieter
- i18n-Schicht (de/ru/en), OpenAI-kompatibler Client (`openai.ts`), Provider-Registry (`providers.ts`).
- Anbieter: Gemini, Pollinations (kostenlos, ohne Key, ruOk), VseGPT, DeepSeek, OpenRouter (:free), Groq, Mistral, Hugging Face, Custom.

## v1.3.0 — Lernplan, Quiz-Karten & Vokabel-Graph (Details siehe Release Notes)
## v1.2.0 — Live-Statusanzeige + Auto-Retry · v1.1.x — Live-Modellkatalog, Race-Fix · v1.0.0 — Initial

## Wiederherstellungs-Prozedur (nach Sandbox-Reset)
1. Neuestes `learnharness-mobile-source.zip` aus dem Release laden (v1.6.0 oder neuer).
2. `npm ci`, SDK ggf. neu: cmdline-tools + `platforms;android-35` + `build-tools;35.0.0` nach `/home/z/android-sdk`, `local.properties` → `sdk.dir=/home/z/android-sdk`.
3. Java: nur JRE in der Sandbox → portables Temurin-JDK 21 nach `/home/z/jdk-21…` laden, `JAVA_HOME` beim Gradle-Aufruf setzen.
4. Deploy: `scripts/deploy-gh-pages.sh` (dist-pwa → gh-pages, force push).
