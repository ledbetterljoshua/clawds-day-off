# Requests from the matsuri sketch

- **A chapter camera hook.** On a long set the play framing (`cam.frame`) leaves the bottom
  third of the frame as empty ground and can't bias toward the stall and its line. The sketch
  calls `cam.shot` every frame from `update`, which works but loses the mouse parallax. Wanted:
  `def.camera(out)` that `cam.frame` defers to in play mode.
- **After a sketch the cover shows the sketch's set.** The runner tears an evening down only
  when the next one starts, so `diary.showTitle()` after a sketch renders over the festival
  street (balcony hidden). Tear the sketch down (or at least `game.setScene()`) before
  `showSketch`'s cover button opens the title.
- **A line in the clock panel.** The wallet is written into `#clock .s` every frame. A
  `def.clockNote` that can be a function would cover it.
- **`clock` is mapped over the whole 0..1 phase.** An evening that runs phase .78 → 1 has to
  stretch `clock` to `[11:25, 20:30]` to read 6:30 → 8:30 (tanabata does the same). Mapping
  `clock` over `def.phase` would be friendlier.
- **Townsfolk.** `matsuri/folk.js` (one merged mesh plus a face shell per person, 6 species × 8
  yukata) could move to core if other sketches need a crowd.
