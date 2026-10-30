# PoseCam mobile (React Native CLI)

```bash
npm install
npx react-native start                 # Metro
npx react-native run-android           # build, install and launch (emulator or USB device)
npx tsc --noEmit && npx eslint . && npx jest
```

- Server URL: **Hồ sơ → Máy chủ** (default `http://10.0.2.2:8020`, the host machine as seen from the
  Android emulator; on a phone use `http://<LAN-IP>:8020`).
- Camera: `react-native-vision-camera` v5. Captures use `takeSnapshot()` (the displayed preview,
  already square and mirrored like the front preview), so uploads send `mirror=false`.
- Pose guide: `src/pose/library.json` comes from `../poses/library.json` via `../scripts/sync-poses.sh`
  (do not edit it by hand). `PoseFigure` renders it; `useLiveAnalysis` calls `POST /analyze` about every
  650 ms; `useAutoCapture` runs the 3‑2‑1 countdown when the pose is held.
- Android widget and screen brightness are TurboModules (`src/native/*`, Kotlin in
  `android/app/src/main/java/com/posecam/app/`). The widget refreshes every 15 minutes (WorkManager)
  and whenever the app loads the feed.
- iOS: the project is generated and has the camera usage text, but it has not been built (needs macOS),
  and there is no iOS widget yet.
