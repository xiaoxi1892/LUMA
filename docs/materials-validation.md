# Tactile Break Space — validation, 2026-09-15

## Delivery scope

Existing Next/R3F project extended in place. One Canvas, three complete interactive materials, session-owned histories, shared audio and two-minute break. No new runtime dependency, image asset, account, tracker, score or network simulation.

## Checks passed

- `npm install`: dependencies current, zero reported vulnerabilities.
- `npm run lint`: no errors or warnings.
- `npm run typecheck` and production build TypeScript pass.
- `npm test`: **22/22** pass, including old Blob/Melt/Sand/uniform regressions plus five material-physics cases and expanded shared-audio assertions.
- `npm run build`: successful static export of `/`, `/audio-lab/`, and not-found route. Actual built output served separately on `127.0.0.1:3001` for verification.
- `git diff --check`: clean.

Tests cover bounded sustained local pressure and neighbor response, recovery, interpolated fast swipes, variation between caps, volumetric bead contacts, non-singular force, throw transfer and settling, temporary repulsion expiry, collision aggregation, all six geometry-transition endpoints, and independent break clock. Audio contract tests verify opt-in creation, reuse across enable/disable, seven separate new material buffers, and bounded voices under 400 dense collision events.

## Actual browser checks

Chrome on MacBookPro18,1. Browser viewport overrides: **1440×1000, 1920×1080, 390×844**, DPR 1 during overrides. Actual phone hardware was not available.

- Sand: fast long strokes leave persistent marks; switching to Bubble and Beads and back retains them. Three tools are the previously tested height-field implementation.
- Bubble: sequential swipe increases press count, produces local cap deformation, delayed independent recovery, and hidden waves. A two-stroke check recorded 18 presses / 3 waves. Long-hold bounds and neighbor behavior were tested in the simulation; tool-driven browser gestures primarily exercised taps and drags.
- Beads: actual drags/throws change positions and retain inertia; interaction counters recorded throws; the “散开” control visibly spreads the beads. Phone viewport initially uses 168 beads, desktop 264.
- Modes: normal transitions and reduced-motion path opened successfully; geometry shader compiled; normal switch shows a working skip control. Reduced-motion behavior was exercised through `?motion=reduce`, which uses the same branch as the system preference.
- Shared clock: started in Sand, switched across Beads → Bubble → Sand; DOM progress advanced from 0.347907 to 0.77509. It completed at 120 seconds, showed “随时可以回去啦。”, and allowed further mode switching and drawing.
- Pause / Esc resume / secondary reset-all menu / numeric shortcut 3 exercised on the phone viewport. No overlap between material nav and core controls; mobile cells enlarged to six columns and eleven rows in the final version.
- Sound: default mute verified after a fresh load. Explicit enable successfully decoded all assets. Actual browser diagnostic: **one context, three sand loops, at most one settling voice, seven new material buffers**. Mode switching does not create more contexts. Explicit mute worked.
- Final production console check: no new errors for the production origin. Historical development logs included one hot-refresh shape mismatch while the new runtime fields were being introduced; fresh production navigation did not reproduce it. No shader compile / WebGL / hydration errors in the production checks.

## Performance evidence and limits

Raw sampled windows are retained in the local development records and omitted from public exports; they include normal rendering, interactions, switching, tool pauses and concurrent development/build activity. **Do not treat them as a standardized benchmark or claim stable 60 FPS on every device.**

Observed production windows:

| Viewport | Sand | Bubble | Beads |
|---|---|---|---|
| 1440×1000 | 107.7–120.4 FPS | 115–120 FPS | 67.8–119.9 FPS |
| 1920×1080 | usually 103.2–119.8; one 21.6 window | 104.4–120.2 FPS | 93–120.1 FPS |
| 390×844 on desktop hardware | 118.1 sampled | irregular during tool/build pauses | irregular during tool/build pauses |

Some small-viewport windows fell to 0.2–6.6 FPS during long frame gaps while development and browser tools were active, then returned above 100. This is retained in raw evidence, not silently removed. The final monitor discards a >250 ms clock discontinuity and warms up before evaluating the next steady window, so a pause/resume does not repeatedly trigger adaptive quality. A real performance regression still needs investigation if it reproduces in uninterrupted play. The final phone Bubble geometry was reduced from 91 caps × 32² to 66 caps × 24² after those earlier samples.

DPR caps: desktop 1.75, compact 1.25, minimum 1. Two consecutive three-second windows below 48 FPS lower DPR; existing Sand also lowers grain draw count / shadow samples. Remaining hotspots: high-DPR fill, first-time transition shader compilation, cap vertex evaluation, and dense bead contacts. Inactive materials have no render or physics loop. No full-screen bloom or expensive raymarch pass is used by this product version.

## Recorded output

`public/captures/materials-video.webm`: ~20 s of real canvas interaction and material changes, browser MediaRecorder. It records this app's canvas/audio only (no mic/camera/screen). CSS background and UI are not in the canvas capture.

`public/audio/materials-mix.webm`: 19.92 s Opus 48 kHz stereo. FFmpeg measurement: **peak −36.6 dBFS**, mean −79.5 dBFS including long quiet intervals and brief automated gestures. No clipping. This verifies signal and levels, not subjective comfort or a human listening test. Raw sources, processed clips and downloadable outputs are linked on `/audio-lab/`.

## Remaining polish

1. Refine the pressure meniscus and deep internal light of the silicone caps.
2. Improve the geometry correspondence where a different number of cells becomes beads; current transition is continuous but not mass-conserving.
3. Test sustained finger input, Safari, audio comfort and thermal performance on actual iPhone and Android devices.
