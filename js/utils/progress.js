/**
 * Left-edge progress indicator — highlights the active exhibition chapter (01–06).
 * Also mounts per-section Scroll cues that only show while that panel is snapped.
 */

import { PROGRESS_SECTIONS } from '../config.js';

/**
 * @returns {Function} cleanup
 */
export function initProgressIndicator() {
  const nav = document.createElement('nav');
  nav.className = 'progress-nav';
  nav.setAttribute('aria-label', 'Exhibition progress');

  const list = document.createElement('ol');
  list.className = 'progress-nav__list';

  /** @type {Map<string, HTMLElement>} */
  const sectionHints = new Map();

  PROGRESS_SECTIONS.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'progress-nav__item';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'progress-nav__btn';
    btn.dataset.progressTarget = item.id;
    btn.setAttribute('aria-label', item.name);
    btn.innerHTML =
      `<span class="progress-nav__num">${item.label}</span>` +
      `<span class="progress-nav__name">${item.name}</span>`;

    btn.addEventListener('click', () => {
      const target = document.getElementById(item.id);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    li.appendChild(btn);
    list.appendChild(li);

    const section = document.getElementById(item.id);
    if (!section) return;

    // Last chapter has nowhere to scroll — skip the cue
    const isLast = index === PROGRESS_SECTIONS.length - 1;
    if (isLast) return;

    const hint = document.createElement('div');
    hint.className = 'scroll-hint scroll-hint--section';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML =
      '<span class="scroll-hint__text">Scroll</span>' +
      '<span class="scroll-hint__line"></span>';
    section.appendChild(hint);
    sectionHints.set(item.id, hint);
  });

  nav.appendChild(list);
  document.body.appendChild(nav);

  /** @type {ScrollTrigger[]} */
  const triggers = [];
  let visible = false;
  /** @type {string | null} */
  let activeId = null;

  function setSectionHint(id) {
    sectionHints.forEach((hint, key) => {
      hint.classList.toggle('is-visible', key === id);
    });
  }

  function clearSectionHints() {
    sectionHints.forEach((hint) => hint.classList.remove('is-visible'));
  }

  function setActive(id) {
    activeId = id;
    nav.querySelectorAll('.progress-nav__btn').forEach((btn) => {
      const on = btn.dataset.progressTarget === id;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-current', on ? 'true' : 'false');
    });
    setSectionHint(id);
  }

  function showNav() {
    if (visible) return;
    visible = true;
    nav.classList.add('is-visible');
  }

  function hideNav() {
    if (!visible) return;
    visible = false;
    nav.classList.remove('is-visible');
    clearSectionHints();
    activeId = null;
  }

  // Appear after tutorial section
  const mouse = document.getElementById('mouse-interaction');
  if (mouse) {
    triggers.push(
      ScrollTrigger.create({
        trigger: mouse,
        start: 'bottom 60%',
        onEnter: showNav,
        onLeaveBack: hideNav,
      })
    );
  }

  PROGRESS_SECTIONS.forEach((item) => {
    const el = document.getElementById(item.id);
    if (!el) return;
    // Tight window ≈ snapped panel filling the viewport
    triggers.push(
      ScrollTrigger.create({
        trigger: el,
        start: 'top 18%',
        end: 'bottom 82%',
        onEnter: () => {
          showNav();
          setActive(item.id);
        },
        onEnterBack: () => {
          showNav();
          setActive(item.id);
        },
        onLeave: () => {
          if (activeId === item.id) {
            const hint = sectionHints.get(item.id);
            hint?.classList.remove('is-visible');
          }
        },
        onLeaveBack: () => {
          if (activeId === item.id) {
            const hint = sectionHints.get(item.id);
            hint?.classList.remove('is-visible');
          }
        },
      })
    );
  });

  // Hide on hero
  const hero = document.getElementById('hero');
  if (hero) {
    triggers.push(
      ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        onEnterBack: hideNav,
      })
    );
  }

  return () => {
    triggers.forEach((t) => t.kill());
    sectionHints.forEach((hint) => hint.remove());
    sectionHints.clear();
    nav.remove();
  };
}
