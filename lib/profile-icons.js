// ZERO FIELD identity marks. Native vector geometry, no font or external asset.
// XUN: embodied X-frame / control arms around an intelligence core and perception aperture.
// LI: an L-shaped provenance chain, with an explicit graph-update arrow.
// LV: long donkey ears, an angular robotic face and a broad articulated muzzle.
const marks = Object.freeze({
  xun: '<path fill-rule="evenodd" d="M3 3h7l6 8 6-8h7l-9 12 9 14h-7l-6-9-6 9H3l9-14ZM8 16l8 5 8-5-8-5Z"/><circle cx="16" cy="16" r="2.5"/>',
  li: '<path d="M5 6h5v17h16v5H5Z"/><path d="m9 8 14 0 0 16M9 8l14 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m20 3 6 5-6 5Z"/><circle cx="7.5" cy="7.5" r="4"/><circle cx="7.5" cy="25.5" r="4"/><circle cx="25" cy="25.5" r="4"/>',
  lv: '<path d="m7 3 4-1 5 12-5 2Zm11-2 4 1-3 13-5-1Z"/><path fill-rule="evenodd" d="m11 12 9 1 4 7 6 3-3 7H12l-6-9Zm5 4v3h4v-3Zm5 8-1 3h5l1-3ZM10 22v3h3v-3Z"/>'
});

/** Decorative only: callers keep visible labels and accessible button names. */
export function profileIcon(profile) {
  if (!Object.hasOwn(marks, profile)) return '';
  return `<svg class="profile-identity" data-profile-icon="${profile}" viewBox="0 0 32 32" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${marks[profile]}</svg>`;
}
