export type IconName =
  | 'alert-circle'
  | 'check-circle'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'clipboard-list'
  | 'clock'
  | 'lock-open'
  | 'pause-circle'
  | 'shield'
  | 'trash'
  | 'x'
  | 'x-circle';

const ICON_PATHS: Record<IconName, string> = {
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5h.01"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-left': '<path d="m15 6-6 6 6 6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'clipboard-list': '<path d="M9 4h6l1 2h3v14H5V6h3l1-2Z"/><path d="M9 11h6"/><path d="M9 15h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'lock-open': '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.6-1.7"/>',
  'pause-circle': '<circle cx="12" cy="12" r="9"/><path d="M10 9v6"/><path d="M14 9v6"/>',
  shield: '<path d="M12 3 19 6v5c0 4.5-2.8 7.5-7 9-4.2-1.5-7-4.5-7-9V6l7-3Z"/><path d="m9 12 2 2 4-5"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  x: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/>',
};

export function iconSvg(name: IconName, className = 'ui-icon'): string {
  return `<svg class="${className} icon-${name}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON_PATHS[name]}</svg>`;
}
