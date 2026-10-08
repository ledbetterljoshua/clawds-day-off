# Integration QA (run after each merge)

Server: `python3 tools/serve.py 4388` · browser at 1440×810 and 390×844 · `?nosave` for test runs.

1. Title cover renders; golden-hour backdrop; credit link; settings opens/closes; no console errors.
2. Each day `?day=N&skip&nosave`: intro → play → ending → diary page with photo + text + stamp.
   - played mostly by hand, and mostly by delegation
   - `end evening` (quit) path ends cleanly
   - night-falls path (`&speed=8`, do nothing) ends cleanly
3. Day-to-day: "next evening" fades into the next day; helpers say "resuming… N tasks remembered".
4. Terminal: `/help`, `/agents`, `/tasks`, `h3 <job words>`, `/effort max`, `sl`, `hanabi`, `crabsay hi`, chapter `cat …`.
5. Stickers: awarded toasts; diary sheet shows them; hints on unearned.
6. Sky presets per day look right at phases 0/.45/.7/.86/1; weather hooks (rain, rainbow, fireflies, milky way, star pair) appear when chapters drive them.
7. Audio: no errors; moods change; loops start and stop (sizzle, water, sparkler, rain); mute works and persists.
8. Performance: ~60fps desktop; settings "light" mode on phone.
9. Fresh profile (no localStorage): first-evening tips show once; days unlock in order.
10. Artifact build (`python3 tools/build-artifact.py`) publishes; the page loads in the claude.ai viewer.
