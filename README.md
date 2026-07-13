# Type Motion

An interactive typography laboratory — a digital art piece exploring type as experience.

## Stack

- HTML / CSS / JavaScript (ES6 modules)
- GSAP + ScrollTrigger
- Variable Fonts
- Canvas trail / Web Audio (subtle)
- Matter.js (physics section)

## Development

Serve locally with any static server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Open `http://localhost:8080` (or the port shown).

## Experience Arc

The interactive chapter (Section 2) follows a complete flow:

1. **Enter** — letters arrive
2. **Explore** — move, click, hold, scroll, type
3. **Build** — energy accumulates (cannot climax in a few seconds)
4. **Climax** — letters scatter and reform as `MOTION`
5. **Ending** — Thank You → Explore Again

Each page load applies a random coordinated palette. Sound is on by default (Mute in the header).

## Project Structure

```
css/
  base.css
  themes.css
  components/ui.css
  sections/…
js/
  config.js
  theme.js
  main.js
  utils/
    animation.js
    audio.js
    palette.js
    pointer.js
    trail.js
  sections/…
index.html
```
