export const C = {
  palmDeep:   '#1f3d2e',
  palm:       '#2d5a3d',
  palmLight:  '#4a7c4e',
  oceanDeep:  '#0f4c5c',
  ocean:      '#1d7a8c',
  oceanLight: '#7ec4d6',
  sand:       '#f0e3c4',
  sandMid:    '#e0cea4',
  bone:       '#f7efd5',
  coral:      '#e85a4f',
  sun:        '#f4a83a',
  torch:      '#ff6b35',
  night:      '#0e1428',
  nightMid:   '#1a2444',
  ink:        '#1a1f1a',
  inkMid:     '#3a3f3a',
  inkSoft:    '#6a6f6a',
} as const;

export type ColorKey = keyof typeof C;