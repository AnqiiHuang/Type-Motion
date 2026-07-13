# Type Motion

An interactive typography laboratory — a digital art piece exploring type as experience.

## Stack

- HTML / CSS / JavaScript (ES6 modules)
- GSAP + ScrollTrigger
- Variable Fonts (Section 3+)
- Canvas / Matter.js (Section 5+)

## Development

Serve locally with any static server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Open `http://localhost:8080` (or the port shown).

## Project Structure

```
css/
  base.css                         — reset, tokens, shared layout
  components/ui.css                — header, scroll hint, buttons
  sections/hero.css                — Section 1 styles
  sections/mouse-interaction.css   — Section 2 styles
  sections/font-playground.css     — Section 3 styles
  sections/wave-typography.css     — Section 4 styles
  sections/typography-physics.css  — Section 5 styles
  sections/poster-generator.css    — Section 6 styles
  sections/theme-switch.css        — Section 7 styles
  sections/about.css               — Section 8 styles
  themes.css                       — global theme tokens
js/
  config.js                        — shared animation constants
  theme.js                         — theme manager
  main.js                          — app entry, section registry
  utils/animation.js               — GSAP helpers
  sections/hero.js                 — Section 1 logic
  sections/mouse-interaction.js    — Section 2 logic
  sections/font-playground.js      — Section 3 logic
  sections/wave-typography.js      — Section 4 logic
  sections/typography-physics.js   — Section 5 logic
  sections/poster-generator.js     — Section 6 logic
  sections/theme-switch.js         — Section 7 logic
  sections/about.js                — Section 8 logic
index.html
```

## Sections

- [x] **Section 1** — Landing Hero
- [x] **Section 2** — Mouse Interaction
- [x] **Section 3** — Variable Font Playground
- [x] **Section 4** — Wave Typography
- [x] **Section 5** — Typography Physics
- [x] **Section 6** — Random Poster Generator
- [x] **Section 7** — Theme Switch
- [x] **Section 8** — About
