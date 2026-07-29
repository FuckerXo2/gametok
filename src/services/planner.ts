// Planning seam — composes the GameBrief shown in the Wish conversation.
//
// TEMPORARY LOCAL COMPOSER. The end state is a live Kimi CLI planning session
// (plan mode over a server/ACP transport) where Kimi itself writes the brief in
// its own voice. Until that backend exists, this module produces an honest,
// well-shaped brief locally so the product experience is real and testable.
// The UI contract is ONLY `planBrief(wishText): GameBrief` — when the live
// session lands, swap the internals, not the screens.
//
// Behavior rules (from the planning personality):
// - Infer aggressively on flavor; never ask.
// - The pitch line MUST carry dimension + perspective (rebuild-risk facts up top).
// - State choices as decisions, not options. No hedging.

import type { GameBrief } from '../components/wish/wishTypes';
import { normalizeOrientation, DEFAULT_ORIENTATION, type Orientation } from '../constants/orientation';

interface StructuralGuess {
  structural: string;      // e.g. "3D chase-cam racer"
  pitchTail: string;       // rest of the pitch sentence
  spine: string[];
  flavor: string[];
  nameSeed: string[];      // candidate words for the coined title
}

const lc = (s: string) => s.toLowerCase();

/** Detect the game family and produce confident structural defaults for it. */
function guessStructure(wish: string): StructuralGuess {
  const w = lc(wish);
  const wants3d = /\b3d|three.?d\b/.test(w);
  const wants2d = /\b2d|two.?d|pixel|retro|side.?scroll/.test(w);
  const topDown = /top.?down|overhead|birds?.?eye/.test(w);

  if (/rac(e|ing)|kart|drift|lambo|ferrari|car|drive|driving/.test(w)) {
    const threeD = wants2d ? false : true; // racers default 3D chase-cam
    return {
      structural: threeD ? '3D chase-cam racer' : 'top-down arcade racer',
      pitchTail: threeD
        ? "you're behind the wheel, chasing rivals through a neon night city"
        : 'you weave through traffic from above, rivals on your tail',
      spine: ['Drag to steer, tap to boost, drift the corners', 'Three laps — finish first'],
      flavor: ['Boost trails, speed-blur, a synthwave pulse', 'Rivals that actually fight back'],
      nameSeed: ['Rush', 'Apex', 'Redline'],
    };
  }
  if (/runner|endless|dash|parkour|escape|chase/.test(w)) {
    return {
      structural: wants3d ? '3D endless runner' : 'side-view endless runner',
      pitchTail: 'one tap to jump, the world speeds up, one mistake ends it',
      spine: ['Tap to jump, hold for a long jump', 'Run as far as you can — the pace keeps climbing'],
      flavor: ['A world that shifts as your streak grows', 'Near-miss sparks and a heartbeat of screen shake'],
      nameSeed: ['Dash', 'Bolt', 'Overdrive'],
    };
  }
  if (/shoot|blast|space|alien|invader|galaxy|zombie|surviv/.test(w)) {
    const td = topDown || /zombie|surviv/.test(w);
    return {
      structural: td ? 'top-down arena shooter' : 'side-view arcade shooter',
      pitchTail: td
        ? 'you hold the middle of the arena while the waves close in'
        : 'you carve through waves that learn your tricks',
      spine: ['Drag to move — firing is automatic', 'Survive the waves; every fifth one is a boss'],
      flavor: ['Screen-shaking hits and glowing tracer fire', 'Power-ups worth diving for'],
      nameSeed: ['Siege', 'Swarm', 'Last Stand'],
    };
  }
  if (/puzzle|match|merge|block|tile|brain|logic|card|solitaire|chess/.test(w)) {
    return {
      structural: 'clean single-screen puzzler',
      pitchTail: 'every move counts, and the board always answers back',
      spine: ['Tap and drag — nothing else to learn', 'Clear the board before your moves run out'],
      flavor: ['Silky tile animations and a satisfying pop on every clear', 'A gentle combo system that rewards planning'],
      nameSeed: ['Shift', 'Cascade', 'Loop'],
    };
  }
  if (/jump|platform|climb|tower|flappy|bounce/.test(w)) {
    return {
      structural: 'side-view arcade platformer',
      pitchTail: 'tight jumps, moving hazards, and a summit worth reaching',
      spine: ['Tap to jump — timing is everything', 'Reach the top; falling costs you the run'],
      flavor: ['Springy, juicy movement with coyote-time forgiveness', 'A vista that changes as you climb'],
      nameSeed: ['Summit', 'Hop', 'Vault'],
    };
  }
  // Unknown family — commit to a confident arcade default rather than hedging.
  return {
    structural: wants3d ? '3D arcade game' : 'fast single-screen arcade game',
    pitchTail: 'simple to touch, hard to put down',
    spine: ['One-finger controls — drag and tap', 'Chase a high score that taunts you'],
    flavor: ['Juicy feedback on every action', 'A look with real art direction, not programmer gray'],
    nameSeed: ['Rush', 'Frenzy', 'Pulse'],
  };
}

/** Coin a short title from the wish's strongest noun + an energetic seed word. */
function coinName(wish: string, seeds: string[]): string {
  const stop = new Set([
    'make', 'a', 'an', 'the', 'game', 'games', 'with', 'and', 'or', 'of', 'in', 'on', 'for',
    'me', 'my', 'i', 'want', 'create', 'build', 'please', 'that', 'where', 'you', 'like',
    'speed', 'fast', 'cool', 'fun', 'good', '2d', '3d', 'to', 'can', 'about',
  ]);
  const words = wish
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stop.has(lc(t)));
  const subject = words.sort((a, b) => b.length - a.length)[0] || 'Arcade';
  const cap = subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase();
  const seed = seeds[cap.length % seeds.length];
  return `${cap} ${seed}`;
}

/**
 * Compose the brief for a wish (plus any pre-create refinement wishes).
 *
 * `orientation` is passed in rather than guessed: the creator already chose it in the Forge before
 * the studio opened, so the brief only echoes that decision back.
 */
export function planBrief(
  wishText: string,
  refinements: string[] = [],
  orientation: Orientation = DEFAULT_ORIENTATION,
): GameBrief {
  const combined = [wishText, ...refinements].join('. ');
  const g = guessStructure(combined);
  return {
    name: coinName(wishText, g.nameSeed),
    orientation: normalizeOrientation(orientation),
    pitch: `A ${g.structural} — ${g.pitchTail}.`,
    structural: g.structural,
    spine: g.spine,
    flavor: g.flavor,
  };
}

/** The full prompt handed to generation when the user hits Create. */
export function briefToPrompt(brief: GameBrief, wishText: string, refinements: string[]): string {
  return [
    wishText,
    ...refinements,
    '',
    `Build this as: ${brief.pitch}`,
    // Restated in prose for the model's benefit. The authoritative copy travels as a structured
    // field on the request — the sandbox viewport depends on it, and prose is not a reliable channel.
    normalizeOrientation(brief.orientation) === 'landscape'
      ? '- Orientation: LANDSCAPE (wide, short screen).'
      : '- Orientation: PORTRAIT (tall, narrow screen).',
    ...brief.spine.map((s) => `- ${s}`),
    ...brief.flavor.map((f) => `- ${f}`),
  ].join('\n');
}
