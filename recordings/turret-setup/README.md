# Turret Setup — recorded walkthrough

Captured 2026-09-18 by driving the prototype at `http://127.0.0.1:5182/?turretSetup=1`.
HAAS ST-20Y · BMT turret · outside-mounted above the main spindle · 12 stations.

Frames are 1024×576 PNGs, in order. Drop them into iMovie / Keynote / QuickTime
(or any slideshow tool) at ~1.5–2s per frame to produce the video.

| Frame | What it shows |
| ----- | ------------- |
| `frame-001.png` | Turret Setup dialog opens — all 12 stations empty, turret ring in the viewport |
| `frame-002.png` | Station 1 ← Assembly #1 (Ø4mm 45° Turning, P clamp) |
| `frame-003.png` | Station 2 ← 3X Spot-Drill-Tap (seatable — mounts on the ring) |
| `frame-004.png` | Station 5 ← Assembly #2 (Ø3.8mm 30° Turning, finish) |
| `frame-005.png` | Station 8 ← Assembly #3 (Ø4mm 30° Turning, rough OD) — four stations loaded |
| `frame-006.png` | OK pressed — dialog closes, turret shows the seated tool projecting from the ring |

## Reproduce
Re-run the same flow anytime via the deep link `?turretSetup=1`, then assign
stations from the per-station dropdowns and click **Ok**.
