# AutoBDK GUI

<p align="center">
  <img src="assets/source_icon.png" width="112" height="112" alt="AutoBDK GUI icon" />
</p>

<p align="center">
  <strong>A lightweight Electron client for attendance review, anomaly inspection, and guided retroactive check-in requests.</strong>
</p>

<p align="center">
  <a href="https://github.com/seasonyuu/autobdk-gui/releases"><img alt="Release" src="https://img.shields.io/github/v/release/seasonyuu/autobdk-gui?include_prereleases&style=flat-square" /></a>
  <a href="https://github.com/seasonyuu/autobdk-gui/actions"><img alt="Build" src="https://img.shields.io/github/actions/workflow/status/seasonyuu/autobdk-gui/build.yml?branch=main&style=flat-square" /></a>
  <img alt="Electron" src="https://img.shields.io/badge/Electron-39-2f7d78?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178c6?style=flat-square" />
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/seasonyuu/autobdk-gui?style=flat-square" /></a>
</p>

AutoBDK GUI is a desktop attendance assistant built with Electron, Vite, and TypeScript. It gives you a cleaner local interface for viewing monthly attendance records, opening the mobile login page inside the app, inspecting cookies, and preparing retroactive attendance requests with an explicit confirmation step before anything is submitted.

It is not an official client. Use it only with accounts and attendance systems you are authorized to access.

## Highlights

- **Monthly attendance calendar** - browse current and adjacent months with workday/rest-day state, lunar labels, abnormal indicators, and a custom date detail dialog.
- **Guided retroactive check-in flow** - scan abnormal attendance records, preview generated requests, confirm manually, then track per-item progress and errors.
- **Configurable check-in times** - adjust the default morning and evening retroactive times from the settings menu instead of editing code.
- **Embedded login experience** - open the mobile login page in an Electron WebView with a focused desktop layout.
- **Cookie tools** - inspect grouped cookies, clear stored login state, and recover when a session expires.
- **Desktop packaging assets** - generated Windows, macOS, and Linux icons are included for distributable builds.

## Screenshots

Screenshots are not committed yet. Recommended captures for the project page:

| View | What to capture |
| --- | --- |
| Calendar | Month view with normal and abnormal attendance states |
| Date details | Custom detail dialog for a selected day |
| Check-in preview | Pending retroactive requests before confirmation |
| Settings | Configurable morning/evening check-in time dialog |

## How It Works

AutoBDK GUI keeps the workflow deliberately explicit:

1. You log in through the embedded mobile page.
2. The app validates the session and loads monthly attendance records.
3. Abnormal days are highlighted on the calendar.
4. The one-click flow analyzes abnormal days and existing retroactive requests.
5. You review the generated request list before submission.
6. The app submits confirmed requests one by one, with progress and failure messages.
7. The calendar refreshes after the flow finishes.

The app stores local UI settings and Electron session data on the local machine. It does not add analytics or telemetry.

## Install

```bash
npm install
```

## Run Locally

```bash
npm start
```

`npm start` builds the main, preload, and renderer bundles, then launches Electron.

## Build

```bash
npm run build
```

This produces the compiled app files under `dist/` and copies bundled assets.

## Package

```bash
npm run dist
```

Packaging is handled by Electron Builder.

Configured targets:

| Platform | Target | Icon source |
| --- | --- | --- |
| macOS | zip | `.icns` |
| Windows | NSIS | `.ico` |
| Linux | AppImage, Flatpak | PNG icon set |

## Quality Checks

```bash
npm run lint
npm run test:s02
npm run test:s03
npm run test:s04
```

The current test suite is a set of static contract checks around renderer boundaries, Electron security posture, and failure visibility for attendance approval flows.

## Project Shape

```text
src/
  main.ts              Electron main process
  preload.ts           Safe renderer bridge
  renderer.ts          Renderer orchestration
  api.ts               Attendance API calls
  types.ts             Shared TypeScript contracts
  modules/
    auth.ts            Session and user state
    calendar.ts        Attendance calendar UI
    checkin/           Retroactive check-in analysis, UI, and execution
    cookies.ts         Cookie inspection and cleanup
    settings.ts        Local user preferences
    webview.ts         Embedded login page lifecycle
  utils/               Shared date, DOM, and icon helpers
```

Additional project notes live in `ARCHITECTURE.md` and `docs/capability-gap-map.md`.

## Privacy And Safety

- The app runs locally as an Electron desktop client.
- Attendance actions require an authenticated session.
- Retroactive check-in requests are previewed before submission.
- Cookie and CSRF values are treated as sensitive runtime data and should not be shared in logs, screenshots, or issues.
- The project intentionally keeps destructive attendance submission paths behind explicit user confirmation and contract tests.

## Icon Assets

The editable source icon is `assets/source_icon.png`. Generated app icons live under `assets/icons/` and are used by both Electron Builder and Electron Forge configuration.

To regenerate icons from the source PNG, use an icon generation tool such as `electron-icon-builder`, then verify with:

```bash
npm run build
```

## Development Notes

- The UI is plain HTML and CSS in the renderer, without a frontend framework.
- The renderer talks to privileged Electron APIs only through the preload bridge.
- Attendance approval submission is intentionally serialized to avoid rapid repeated requests.
- Follow-up product and hardening ideas are tracked in the capability gap map.

## Contributing

Issues and pull requests are welcome. For changes that touch authentication, cookies, WebView behavior, or attendance submission, include verification notes and explain how the change preserves the explicit confirmation boundary.

Before opening a pull request, run:

```bash
npm run build
npm run lint
npm run test:s02 && npm run test:s03 && npm run test:s04
```

## License

MIT
