// One 3D avatar for the whole app. Games and Me (with the Shop) each used to start their own avatar page, and iOS
// keeps only one alive, so switching tabs reloaded it. Now there's a single stage: each screen marks where it goes
// with a <StageSlot> (and what it should show), and the stage is moved into the slot of the tab on screen
// (react-native-teleport moves the native view itself, so the page keeps running: no reload, no boot wait).
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Portal, PortalHost } from 'react-native-teleport';
import { AvatarStage } from './AvatarStage';

export type StageSlotName = 'games' | 'me';
type StageProps = Omit<React.ComponentProps<typeof AvatarStage>, 'style'>;

const slots: Partial<Record<StageSlotName, StageProps>> = {};
let active: StageSlotName = 'games';
let version = 0;
const listeners = new Set<() => void>();
const changed = () => { version++; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => version;

/** The tab on screen: the stage moves into its slot (any other tab: it stays where it was). */
export function setStageSlot(name: StageSlotName) { if (name !== active) { active = name; changed(); } }

/** Where a screen's avatar goes, and what it shows there. */
export const StageSlot: React.FC<StageProps & { name: StageSlotName; style?: ViewStyle }> = ({ name, style, onHeadshot, onStats, ...props }) => {
  // (the callbacks change every render: the stage calls the latest)
  const cb = useRef({ onHeadshot, onStats });
  cb.current = { onHeadshot, onStats };
  const key = JSON.stringify(props);
  useEffect(() => {
    slots[name] = {
      ...props,
      onHeadshot: (png, of) => cb.current.onHeadshot?.(png, of),
      onStats: (s) => cb.current.onStats?.(s),
    };
    changed();
  }, [name, key]);
  useEffect(() => () => { delete slots[name]; changed(); }, [name]);
  return <PortalHost name={`stage-${name}`} style={style ?? StyleSheet.absoluteFill} />;
};

/** The one stage: put this once near the app's root, inside a PortalProvider. */
export const SharedStage: React.FC = () => {
  useSyncExternalStore(subscribe, snapshot);
  // the tab on screen, else the slot it was last in (so it isn't torn down when a slot goes)
  const last = useRef<StageSlotName | null>(null);
  const at: StageSlotName | null = slots[active] ? active : last.current && slots[last.current] ? last.current : (Object.keys(slots)[0] as StageSlotName) ?? null;
  if (at) last.current = at;
  if (!at) return null;
  return (
    <Portal hostName={`stage-${at}`} style={StyleSheet.absoluteFill}>
      <AvatarStage style={StyleSheet.absoluteFill} {...slots[at]!} />
    </Portal>
  );
};
