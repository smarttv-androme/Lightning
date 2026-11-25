# Lightning RTT flicker test

Reproduces render-to-texture (`rtt: true`) flicker on Samsung TVs with the real Lightning core of this repo, and
compares workarounds.

## Scenes and renderers

Every test is one **scene** (where the rtt is) drawn by one **renderer** (how Lightning draws the frame).

| scene | |
|---|---|
| 1 | no rtt (baseline) |
| 2 | rtt on every card |
| 3 | rtt on every card, static cards (only scrolling + focus scaling) |
| 4 | rtt on every card + rtt on every rail (nested) |
| 5 | rtt on every rail (the setup of the findings below) |
| 6 | 1 frame late check: all rails scroll together at `speed` (6) px per frame, rail 1 without rtt, rails 2-4 with rtt, static cards. White lines outside the rtt sit in the gaps between the cards; content that is a frame behind (renderer 7) runs into them |
| 7 | 20 rtt rails: 20 rails of the size of scene 5, each offset a bit so they overlap, each rendered to a texture with rounded corners, no rtt on the cards; progress bars animate, the cards share 24 images and never swap them |
| 8 | GPU stress: the whole page is one rtt (with rtt on every rail inside it) plus `load` (4) full-page semi-transparent layers inside the page texture. The last texture pass before the screen covers the whole page and is slow, so a late finish shows everywhere. Raise `load` to stress a faster GPU |

The former scenes 6 (no rtt + heavy screen load) and 7 (rtt on static card content) are commented out in `src/scene.js`; their results are still in the findings below.

| renderer | |
|---|---|
| 1 | Lightning as-is (baseline) |
| 2 | `readPixelsAfterDraw` stage option |
| 3 | RTT first + 1 readPixels: the core stage option `flushRenderToTexture` |
| 4 | `preserveDrawingBuffer` |
| 5 | RTT first (renderer 3 without the readPixels) |
| 6 | 1 readPixels at the last switch from a texture to the screen (renderer 3 without the reordering) |
| 7 | textures one frame late: screen first with last frame's textures, then render the textures for the next frame (no GPU wait) |
| 8 | padding passes: Lightning as-is, then `pad` (4) dummy render passes of `padSize` (512) px square at the end of the frame, then 1 transparent pixel on the screen that samples the last of them (so the screen depends on the padding; `padScreen=0` skips it), to push the real passes through the GPU pipeline before the frame is handed over (no GPU wait) |
| 9 | screen pixel only: Lightning as-is, then 1 transparent pixel on the screen that samples the last texture rendered in the frame (renderer 8 without the dummy passes, no GPU wait) |

## Findings

Earlier setup, Samsung 2018 (Tizen 4.0, Chrome 56, Mali-G51), rtt on each of the 4 rails with rounded corners:

| | fps | result |
|---|---|---|
| Lightning as-is | 34 | last rails blink (to empty) |
| no rtt | 43 | steady |
| readPixelsAfterDraw | 24 | steady |
| RTT first + 1 readPixels | 29 | steady |
| preserveDrawingBuffer | 31 | jumps back to an older frame |

- The screen is shown before the GPU finished the render textures. Waiting for the GPU fixes it; `gl.flush` /
  `gl.finish` do not. The last rails fail because they are rendered last.
- It also happens when only the rails scroll (`anim=0`). With rtt on each small card it is much weaker.
- Pixel checks with `readPixels` hide the bug (they wait for the GPU themselves): judge by eye.
- Tizen 6.0 (2021, Mali-G31) is not affected.
- `FadeOut` on a rail rtt crashed the Tizen 4 TV.
- RTT first without the readPixels wait (the ordering alone, a 1px `copyTexSubImage2D` of the last texture, or
  clearing a 1x1 framebuffer before the screen): full-screen flicker on scene 5. A real CPU wait is needed.

## Run

```sh
BUILD_ES5=true npx vite build --mode production   # builds dist/lightning.es5.js
node device-tests/serve.mjs                        # prints http://<pc-ip>:8080/rtt-check/lightning-rtt.html
```

Images come from Lorem Picsum (`https://picsum.photos/seed/…/480/270`, JPEG), so the TV needs internet; use `local=1` otherwise.
The findings above were measured with the local PNG posters.

Open the printed URL on the TV. Remote: UP/DOWN scene, LEFT/RIGHT or 1-9 renderer, ENTER cycles through all
renderers of the current scene. Results are shown in the side panel, logged to the console (`[lightning-rtt] ...`) and, in the
auto cycle, posted to `serve.mjs` (`device-tests/reports.jsonl`).

## URL options

| option | default | |
|---|---|---|
| `scene` | 5 | scene 1-8 |
| `renderer` | 1 | renderer 1-9 |
| `auto=1` | | cycle through all renderers of the scene, `secs` (15) each |
| `anim=0` | | cards never change after the first frame, only the rails scroll |
| `churn` | 180 | frames between loading a new image per card (0 = off) |
| `worker=0` | | disable Lightning's image worker |
| `speed` | 6 | scene 6: scroll speed in px per frame |
| `pad` | 4 | renderer 8: number of dummy render passes at the end of the frame |
| `padSize` | 512 | renderer 8: width and height of each dummy pass in pixels |
| `padScreen` | 1 | renderer 8: 1 transparent pixel on the screen after the padding, that reads the last padding texture (0 = off) |
| `load` | 4 | scene 8: number of full-screen layers (4 ≈ the fps of scene 5 on the 2018 TV) |
| `local=1` | | local PNG posters (`img/`) instead of Lorem Picsum photos (needs no internet on the TV) |

## Files

| file | |
|---|---|
| `lightning-rtt.html` | the page: loads Lightning and the scripts below, in order |
| `src/config.js` | URL options and layout constants |
| `src/card.js` | **card template**: edit this to change the cards |
| `src/scene.js` | the scenes: background and rails of cards, where the rtt goes |
| `src/renderers.js` | the renderers and their workaround code |
| `src/animation.js` | scrolling, progress bars, image swaps, focus scaling |
| `src/panel.js` | frame time measuring (average ms per frame), results, side panel |
| `src/main.js` | WebGL context, Lightning app, remote keys, auto cycle, reporting |
| `style.css` | side panel styling |
| `make-images.mjs`, `img/` | generated PNG posters for `local=1` (`node device-tests/rtt-check/make-images.mjs`) |
