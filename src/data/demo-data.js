/**
 * DEVELOPMENT-ONLY DEMO LIBRARY
 * ---------------------------------------------------------------------------
 * All albums, artists, track titles and artwork here are fictional and were
 * created for the visual prototype. No copyrighted artwork or real catalogue
 * data is used.
 *
 * This module is only read when the URL contains `?demo=1` (see
 * `src/utils/demo-mode.js`). It must never be merged into the user's real
 * library, and nothing here represents imported music.
 */

export const demoAlbums = [
  {
    id: 'aurora-drift',
    title: 'Aurora Drift',
    artist: 'Lumen Field',
    year: 2025,
    artwork: '/artwork/aurora-drift.svg',
    palette: ['#7C6BFF', '#A78BFA', '#241B4D'],
    favourite: true,
    addedAt: 8,
    tracks: [
      { number: 1, title: 'First Light', duration: 214 },
      { number: 2, title: 'Polar Bloom', duration: 243 },
      { number: 3, title: 'Glass Sky', duration: 198 },
      { number: 4, title: 'Northbound', duration: 266 },
    ],
  },
  {
    id: 'glass-tide',
    title: 'Glass Tide',
    artist: 'Sable Coast',
    year: 2024,
    artwork: '/artwork/glass-tide.svg',
    palette: ['#22D3EE', '#3B82F6', '#0B1F33'],
    favourite: false,
    addedAt: 6,
    tracks: [
      { number: 1, title: 'Undertow', duration: 232 },
      { number: 2, title: 'Salt Lantern', duration: 187 },
      { number: 3, title: 'Slow Current', duration: 275 },
      { number: 4, title: 'Tideglass', duration: 205 },
    ],
  },
  {
    id: 'silent-orbit',
    title: 'Silent Orbit',
    artist: 'Iris Bloom',
    year: 2025,
    artwork: '/artwork/silent-orbit.svg',
    palette: ['#F472B6', '#A78BFA', '#22102E'],
    favourite: true,
    addedAt: 7,
    tracks: [
      { number: 1, title: 'Perigee', duration: 226 },
      { number: 2, title: 'Weightless', duration: 251 },
      { number: 3, title: 'Quiet Signal', duration: 194 },
      { number: 4, title: 'Return Window', duration: 288 },
    ],
  },
  {
    id: 'neon-veil',
    title: 'Neon Veil',
    artist: 'Night Archive',
    year: 2023,
    artwork: '/artwork/neon-veil.svg',
    palette: ['#A78BFA', '#22D3EE', '#101026'],
    favourite: false,
    addedAt: 4,
    tracks: [
      { number: 1, title: 'Veil I', duration: 168 },
      { number: 2, title: 'Afterimage', duration: 240 },
      { number: 3, title: 'Static Bloom', duration: 213 },
      { number: 4, title: 'Veil II', duration: 199 },
    ],
  },
  {
    id: 'velvet-static',
    title: 'Velvet Static',
    artist: 'Lumen Field',
    year: 2026,
    artwork: '/artwork/velvet-static.svg',
    palette: ['#FB7185', '#F59E0B', '#2A101B'],
    favourite: false,
    addedAt: 9,
    tracks: [
      { number: 1, title: 'Warm Noise', duration: 207 },
      { number: 2, title: 'Velvet', duration: 236 },
      { number: 3, title: 'Amber Room', duration: 258 },
      { number: 4, title: 'Hush', duration: 181 },
    ],
  },
  {
    id: 'afterglow',
    title: 'Afterglow',
    artist: 'Sable Coast',
    year: 2022,
    artwork: '/artwork/afterglow.svg',
    palette: ['#F97316', '#F43F5E', '#2A120B'],
    favourite: true,
    addedAt: 2,
    tracks: [
      { number: 1, title: 'Ember Line', duration: 221 },
      { number: 2, title: 'Long Exposure', duration: 264 },
      { number: 3, title: 'Dust & Sun', duration: 193 },
      { number: 4, title: 'Afterglow', duration: 247 },
    ],
  },
  {
    id: 'lowlight',
    title: 'Lowlight',
    artist: 'Iris Bloom',
    year: 2024,
    artwork: '/artwork/lowlight.svg',
    palette: ['#34D399', '#0EA5E9', '#07211C'],
    favourite: true,
    addedAt: 5,
    tracks: [
      { number: 1, title: 'Nightwater', duration: 238 },
      { number: 2, title: 'Green Room', duration: 202 },
      { number: 3, title: 'Underglow', duration: 229 },
      { number: 4, title: 'Small Hours', duration: 274 },
    ],
  },
  {
    id: 'black-sun',
    title: 'Black Sun',
    artist: 'Night Archive',
    year: 2021,
    artwork: '/artwork/black-sun.svg',
    palette: ['#EAB308', '#F97316', '#1A1408'],
    favourite: false,
    addedAt: 1,
    tracks: [
      { number: 1, title: 'Eclipse I', duration: 312 },
      { number: 2, title: 'Corona', duration: 254 },
      { number: 3, title: 'Umbra', duration: 228 },
      { number: 4, title: 'Eclipse II', duration: 341 },
    ],
  },
];

/** Album ids in "recently played" order (most recent first). */
export const demoRecentlyPlayed = [
  'neon-veil',
  'aurora-drift',
  'glass-tide',
  'velvet-static',
  'lowlight',
];

export const demoPlaylists = [
  {
    id: 'late-night-drive',
    name: 'Late Night Drive',
    description: 'Wide roads, low lights, no destination.',
    palette: ['#A78BFA', '#22D3EE', '#141027'],
    trackIds: [
      'neon-veil-1',
      'glass-tide-1',
      'black-sun-2',
      'lowlight-1',
      'silent-orbit-1',
      'afterglow-2',
    ],
  },
  {
    id: 'deep-focus',
    name: 'Deep Focus',
    description: 'Long form, low motion, no lyrics in the way.',
    palette: ['#34D399', '#3B82F6', '#0B1B22'],
    trackIds: [
      'aurora-drift-2',
      'glass-tide-3',
      'lowlight-4',
      'silent-orbit-2',
      'black-sun-3',
    ],
  },
  {
    id: 'slow-mornings',
    name: 'Slow Mornings',
    description: 'For the first hour, before the day starts.',
    palette: ['#F59E0B', '#FB7185', '#251018'],
    trackIds: ['aurora-drift-1', 'velvet-static-2', 'afterglow-1', 'lowlight-2'],
  },
];
