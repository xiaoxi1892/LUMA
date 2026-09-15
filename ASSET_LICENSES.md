# Audio asset provenance

Verified 2026-09-15. All visuals are procedural project code; no stock textures or images.

| Local original | Author / work | Primary source | License |
|---|---|---|---|
| `public/audio/raw/brush-concrete-1107.wav` | Joseph SARDIN, “Brosse sur béton”, sound 1107, brush on concrete, 19.078 s, mono 48 kHz; Tascam DR-40 + Sennheiser ME66 | https://lasonotheque.org/brosse-sur-beton-s1107.html · direct official download https://lasonotheque.org/UPLOAD/bwf-fr/1107.wav | CC0 1.0; https://bigsoundbank.com/licenses.html |
| `public/audio/raw/cleaning-0109.wav` | charlesdu76, “Cleaning” / small brush, sound 109, 20.88 s, stereo 44.1 kHz | https://bigsoundbank.com/cleaning-s0109.html · direct official download https://bigsoundbank.com/UPLOAD/bwf-en/0109.wav | CC0 1.0; page explicitly permits modification, redistribution and commercial use without an account. Full site terms: https://bigsoundbank.com/licenses.html |
| `public/audio/raw/sand-footsteps.mp3` | Peludo, “Water Splash and sand footsteps” | https://opengameart.org/content/water-splash-and-sand-footsteps · direct download https://opengameart.org/sites/default/files/sand_footsteps_0.mp3 | CC0 1.0. Author's requested project credit: [RNAn](https://rnan.itch.io/), linked from their [profile](https://opengameart.org/users/peludo). |

CC0 text: https://creativecommons.org/publicdomain/zero/1.0/

## Edits

- `brush-1.wav`, `brush-2.wav`, `brush-3.wav`: three **different portions of one real brush-on-concrete recording**, starting 1.8, 7.1 and 13.2 seconds, 4.4 seconds each. The small-brush sound 109 remains as a raw comparison only because it has long low-activity portions; it is not loaded in the experience. These are brush recordings, not a claim of three separately recorded sand sessions.
- `settle.wav`: 0.8-second excerpt at 2.6 s from Peludo's material footstep recording, with decaying envelope. The source describes a webcam and tapioca bag; this is recorded granular foley, not a precision sand-tray microphone recording.
- Mono downmix, DC removal, 170–4800 Hz band limiting, mild peak softening, conservative gain cap, 80 ms fades. Script: `scripts/prepare-audio.py`. Peak/RMS measurements: `docs/audio-analysis.json`.
- App: three reused decoded brush loops with complementary gain curves, slight 0.97–1.02 playback-rate differences, tool/velocity-dependent low-pass filtering; one rate-limited settling voice. No oscillator or generated-noise layer.
- Any `interaction-mix.webm` / `interaction-video.webm` delivered with this project is a capture of the actual app output and inherits these source credits. No microphone, camera, external video or music is recorded.

No account gate, payment, YouTube extraction or login bypass was used. The partial MP3 download of the brush was discarded after obtaining the complete official WAV.

## Listening status

Programmatic decode, duration, waveform peak/headroom, gain ramps, voice count and browser runtime can be verified here. Subjective comfort, timbre realism and fatigue require human listening. The listening page makes raw, processed and real interaction output available; it does not claim an ASMR or health outcome.

## Tactile Break Space — Bubble / Beads (2026-09-15)

These are distinct real recordings, not repitched sand audio or synthetic replacements.

| Material | Raw source | Author / license | Runtime edits |
|---|---|---|---|
| Bubble | [Ventouse sur plastique, #1261](https://lasonotheque.org/ventouse-sur-plastique-s1261.html), [original BWF](https://lasonotheque.org/UPLOAD/bwf-fr/1261.wav) | Joseph SARDIN / CC0 1.0 | Three 460 ms suction-cup detachments, DC removal, 90–1800 Hz filtering, soft limiting, 12 ms edge fades; peak −12.4 dBFS |
| Beads | [Glass ball, bounce #1, #2240](https://bigsoundbank.com/glass-ball-bounce-1-s2240.html), [original BWF](https://bigsoundbank.com/UPLOAD/bwf-en/2240.wav) | Joseph SARDIN / CC0 1.0 | Three 400 ms glass impacts + 2.1 s late bouncing texture, filtered 400–3900 / 240–2300 Hz; peaks −14 / −17 dBFS |

Source pages explicitly permit edits and redistribution, including commercial apps. See [publisher license](https://bigsoundbank.com/licenses.html). Verified September 15, 2026. Raw recordings retained in `public/audio/raw/`; reproducible processing in `scripts/prepare-material-audio.py`. The bubble sound is suction-cup foley, not a recording of the virtual silicone. The rolling texture is edited late glass bounces, not literal continuous rolling. Quiet master gain and three-voice limit apply in addition to these source peaks.
