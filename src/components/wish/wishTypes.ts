// Wish studio — shared types.
//
// Product philosophy (locked 2026-07-18):
// - One continuous conversation is the entire lifecycle of a game (plan → build → play → refine).
// - Kimi is a creative director pitching a game it already sees, never a form collecting specs.
// - The brief is Kimi *showing you the game*, sorted by rebuild-risk: structure first, flavor last.

import type { Orientation } from '../../constants/orientation';

/** The brief: Kimi's pitch, expressed as a ledger sorted by regret. */
export interface GameBrief {
  /** Coined title with taste — becomes the game's permanent header. */
  name: string;
  /**
   * Portrait or landscape. Chosen by the creator in the Forge before the studio opens, so it
   * arrives already answered rather than as a question — the brief only carries it so the pitch
   * can show it and `briefToPrompt` can state it. The value that actually drives generation
   * travels as a structured field on the request, not as prose.
   */
  orientation: Orientation;
  /** One vivid sentence that carries dimension + perspective (the most load-bearing fact). */
  pitch: string;
  /** The structural phrase inside the pitch to emphasize (e.g. "3D arcade racer"). */
  structural: string;
  /** 2–3 short lines: controls, core loop, win condition — stated as decisions. */
  spine: string[];
  /** 1–2 lines of inferred flavor. Here to delight, not to be approved. */
  flavor: string[];
}

export type WishMessageRole = 'kimi' | 'user';

export interface WishMessage {
  id: string;
  role: WishMessageRole;
  text: string;
  /** When present, this Kimi message carries the brief (rendered as the pitch card). */
  brief?: GameBrief;
  /**
   * Marks a failure turn: creation is unavailable and the user can retry.
   * These messages NEVER carry a brief — we do not render fabricated content
   * as a pitch, because a pitch has a live Create button and would build a
   * game out of placeholder text the model never wrote.
   */
  canRetry?: boolean;
}

/** Lifecycle of the studio. The conversation persists across all of it. */
export type StudioPhase =
  | 'seed'      // empty input, inspiration chips
  | 'planning'  // brief exists, Create is armed
  | 'building'  // --yolo run in flight; Preview shows the build
  | 'live';     // game playable in Preview; every wish is now an edit

export type StudioTab = 'wish' | 'preview';

/** A single human-readable beat streamed into the build theater. */
export interface BuildBeat {
  id: string;
  text: string;
}
