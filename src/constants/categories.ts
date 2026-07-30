// Discovery categories — mirrors gametok-backend/src/categories.js. Keep the two in step.
//
// This replaces the old explore tabs (For You / Games / Horror / Quiz / Roleplay) and their
// keyword-matched chips, which had already been cut from the render tree but left behind as dead
// state. Two deliberate differences from that system:
//
//   1. Multi-label — a game can be Action AND Horror, so a zombie shooter shows under both.
//   2. Server-assigned, not keyword-matched at render time.
//
// "Home" is the all-games tab, not a category a game can carry, which is why it isn't listed here.
// Sub-navigation inside a category is New and Trending only; there are no sub-genres.

export type Category = {
  slug: string;
  label: string;
};

export const CATEGORIES: Category[] = [
  { slug: 'action', label: 'Action' },
  { slug: 'adventure', label: 'Adventure' },
  { slug: 'arcade', label: 'Arcade' },
  { slug: 'sports', label: 'Sports' },
  { slug: 'rpg', label: 'RPG' },
  { slug: 'visual-novel', label: 'Visual Novel' },
  { slug: 'horror', label: 'Horror' },
  { slug: 'racing', label: 'Racing' },
  { slug: 'puzzle', label: 'Puzzles' },
];

const BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function categoryLabel(slug: string): string {
  return BY_SLUG.get(slug)?.label || slug;
}

export function isValidCategory(slug?: string | null): boolean {
  return Boolean(slug && BY_SLUG.has(slug));
}
