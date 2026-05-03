# RingCal — Spiral Diary Calendar App

## Overview
A Hebrew-first calendar & task manager with a spiral/ring-based visual layout. Events sit on concentric rings by category, with a "needle" (red line) marking the current time. Available as web app and Android APK.

**Live URL:** https://spiral-diary.vercel.app/  
**APK:** `C:\Users\yohai\Desktop\RingCal.apk`

---

## Tech Stack
- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS v4 (no tailwind.config.js — uses `@tailwindcss/vite` plugin)
- **State:** Zustand with `persist` middleware (localStorage)
- **Routing:** TanStack Router (file-based, `src/routes/`)
- **Mobile:** Capacitor v8 → Android APK (signed release)
- **i18n:** Custom `getLang()` in `src/i18n/translations.ts` (9 languages: he, en, fr, es, de, ru, ar, zh, pt)
- **Google Calendar:** OAuth2 PKCE flow via `src/services/googleCalendar.ts`
- **Google Drive:** sync via `src/services/googleDrive.ts`
- **AI:** Gemini API via `src/components/screens/AIScreen.tsx`

---

## Key Files
| File | Purpose |
|------|---------|
| `src/components/AppLayout/index.tsx` | Root layout: sidebar (desktop), tab bar (mobile), pages, Drive sync |
| `src/components/screens/SpiralScreen.tsx` | Main calendar view with FAB, search overlay, GCal pull |
| `src/components/screens/EventsScreen.tsx` | Events list with filters, GCal history import, pending invites |
| `src/components/screens/TasksScreen.tsx` | Task manager with inline add, mark-done flow, reactivate |
| `src/components/screens/SettingsScreen.tsx` | Language, GCal connect, category editor, export/import |
| `src/components/screens/SubCalendarScreen.tsx` | Sub-calendar overlay for parent task's sub-tasks |
| `src/components/EventSheet/index.tsx` | Bottom sheet for add/edit event or task (870 lines) |
| `src/components/SpiralCanvas/index.tsx` | Canvas-based spiral drawing |
| `src/components/UpcomingStrip/index.tsx` | Horizontal strip of upcoming events |
| `src/components/NeedleBar/index.tsx` | Date/time navigation bar |
| `src/store/useAppStore.ts` | Zustand store: events, categories, settings, GCal state |
| `src/types/index.ts` | TypeScript types: CalendarEvent, Category, AppSettings, etc. |
| `src/i18n/translations.ts` | All UI strings for 9 languages |
| `android/app/build.gradle` | Android app config (keystore: `android/ringcal-release.jks`) |

---

## Build & Deploy Commands

### Web (from `spiral-diary/`):
```bash
npm run build          # Vite build → dist/
npx vercel --prod      # Deploy to ring-cal.vercel.app
```

### Android APK (from `spiral-diary/`):
```bash
npm run build
npx cap sync android   # ⚠️ ALWAYS run this before gradle
```
Then from `spiral-diary/android/`:
```bash
./gradlew assembleRelease
cp app/build/outputs/apk/release/app-release.apk ~/Desktop/RingCal.apk
```

### ⚠️ Critical Android gotcha
`npx cap sync android` regenerates `android/app/capacitor.build.gradle` and `android/capacitor-cordova-android-plugins/build.gradle` with `JavaVersion.VERSION_21`, but the installed JDK is **17**. After every `cap sync`, patch both files:
```
VERSION_21 → VERSION_17
```
Files to patch:
- `android/app/capacitor.build.gradle` (lines 5–6)
- `android/capacitor-cordova-android-plugins/build.gradle` (lines 31–32)

---

## App Architecture

### Data Model (`CalendarEvent`)
- `itemType: 'event' | 'task'`
- `categoryId` → rings in the spiral
- `date`, `time`, `endDate`, `endTime`
- `parentId` → sub-task hierarchy
- `dependsOn` + `dependsType` → FS/SS/FF/SF dependencies
- `recurrence: RecurrenceRule` → interval + unit + endDate
- `rsvpStatus: 'pending' | 'accepted' | 'declined' | 'tentative'`
- `gcalId` → Google Calendar event ID
- `durationDays` → computed rollup from sub-tasks (via `applyRollup`)

### Navigation (AppLayout)
6 tabs: Calendar (0), Events (1), Tasks (2), AI (3), Settings (4), Menu (5)  
Desktop: sidebar + right panel showing upcoming events/tasks  
Mobile: bottom tab bar (`z-[60]`, not `z-60`)

### EventSheet
Single component for add/edit both events and tasks. Supports:
- RSVP flow with category + linked-event picker
- Parent task picker (for tasks)
- Dependency link picker (FS/SS/FF/SF + lag)
- Recurrence rules
- Sub-tasks list + adopt existing task
- Linked items display (parent ↑, outgoing →, incoming ←)
- Nested EventSheet for editing linked items
- GCal sync (create/update/delete on save)

### i18n
All UI strings via `tr = useLang().tr`. Keys defined in `translations.ts` for all 9 languages. RTL languages: `he`, `ar` → `useLang().rtl === true`.

### Google Calendar
- Auth: `gcal.authorize()` → OAuth2 PKCE
- Sync: `gcal.fetchFutureEvents(since)` + `gcal.fromGcalEvent(ge)`
- GCal-synced events show a blue `G` badge in EventRow and desktop panel
- Import dedup: check `gcalId` before adding

---

## Known Critical Gotchas (Code)

### SpiralCanvas — hit-testing חייב `viewDate`
`getEventFrac` ו-`hitTestEvent` חייבים לקבל `viewDate` כפרמטר.
בלי זה, לחיצה על אירועים לא עובדת כשמנווטים לשבוע/יום שאינו השבוע/היום הנוכחי.
כבר תוקן — אל תסיר את `viewDate` מ-`hitTestEvent`.

### NeedleBar — `moveNeedle` מדלג רק על אירועים פעילים
`events.filter(e => !e.done)` לפני המיון — לא לגעת.

---

## Current Feature Status (as of 2026-05-02)
All major features implemented:
- Spiral canvas with category rings
- Events & tasks with all metadata
- GCal bidirectional sync + Drive backup
- RSVP pending invites flow
- Sub-tasks + sub-calendar
- Dependencies (FS/SS/FF/SF) + lag
- Recurrence rules
- Export CSV + JSON backup/restore
- AI assistant (Gemini API)
- 9 languages
- Android APK (signed)

---

## Signing Config
- Keystore: `android/ringcal-release.jks`
- Store password: `ringcal2024`
- Key alias: `ringcal`
- Key password: `ringcal2024`
