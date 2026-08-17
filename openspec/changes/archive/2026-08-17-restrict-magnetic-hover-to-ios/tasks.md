## 1. Gate magnetic-hover to iOS/iPadOS

- [x] 1.1 In `js/magnetic-hover.js`, `initMagneticHover` returns
      immediately (no listeners attached) unless
      `document.documentElement.classList.contains('ios-platform')`.

## 2. Verify

- [x] 2.1 Run `npm test` - no regressions expected. 150/150 passed.
- [x] 2.2 Manually verify via Playwright (spoofing `ios-platform` absent
      vs. present, since a real headless browser reports as neither iPad
      nor a touch-capable Mac) that: with the class absent, mouse hover
      over top bar/tool rail buttons produces zero translate/scale/class
      changes; with the class present (added manually for the test),
      the existing proximity behavior works exactly as before. Confirmed
      directly via dynamic import of the module: absent -> no style/
      class changes at all on approach; present -> --pull-scale reaches
      1.05 at dead-center, identical to pre-change behavior.
