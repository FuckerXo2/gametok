import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, ViewProps, TouchableOpacity } from 'react-native';
import { requireNativeView } from 'expo';
import * as Haptics from 'expo-haptics';

export interface TouchButtonConfig {
  id?: string;
  action: string;
  label: string;
  subLabel?: string;
  icon?: string;
  color?: string;
  glow?: string;
  textColor?: string;
  size?: number;
}

export interface ControlsConfig {
  layout?: 'combat' | 'driving' | 'platformer' | 'arcade' | 'custom';
  dpad?: 'directional' | 'steering' | 'none';
  buttons?: TouchButtonConfig[];
}

export interface GameTokEngineProps extends ViewProps {
  gameScript?: string;
  cameraMode?: '3D' | '2D';
  gravity?: [number, number, number];
  showControls?: boolean;
  controlsConfig?: ControlsConfig | string;
  onScoreUpdate?: (score: number) => void;
  onGameOver?: (won: boolean) => void;
}

let NativeView: any = null;
if (Platform.OS !== 'web') {
  try {
    NativeView = requireNativeView('GameTokEngine');
  } catch (e) {
    console.warn('[GameTokEngine] requireNativeView failed:', e);
  }
}

export const isNativeEngineLinked = (): boolean => !!NativeView;

const triggerHaptic = () => {
  try {
    if (Platform.OS !== 'web' && Haptics?.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  } catch {}
};

/**
 * Resolves active touch controls:
 * 1. Explicit props controlsConfig
 * 2. Embedded script header `// @controls: {...}`
 * 3. Intelligent genre heuristic from script keywords
 */
function resolveControls(
  script?: string,
  config?: ControlsConfig | string
): { layout: string; dpad: 'directional' | 'steering' | 'none'; buttons: TouchButtonConfig[] } {
  // 1. Direct explicit prop object
  if (config && typeof config === 'object' && config.buttons && config.buttons.length > 0) {
    return {
      layout: config.layout || 'custom',
      dpad: config.dpad || (config.layout === 'combat' ? 'directional' : 'steering'),
      buttons: config.buttons,
    };
  }

  let effectiveConfig = config;

  // 2. Embedded script header: // @controls: {...}
  if (script) {
    const match = script.match(/\/\/\s*@controls:\s*(\{.*\})/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.buttons && parsed.buttons.length > 0) {
          return {
            layout: parsed.layout || 'custom',
            dpad: parsed.dpad || (parsed.layout === 'combat' ? 'directional' : 'steering'),
            buttons: parsed.buttons,
          };
        }
        if (typeof parsed === 'string') {
          effectiveConfig = parsed;
        } else if (parsed.layout) {
          effectiveConfig = parsed.layout;
        }
      } catch {}
    }
  }

  // 3. String preset name or keyword detection
  const presetName = (typeof effectiveConfig === 'string' ? effectiveConfig : '').toLowerCase();
  const scriptLower = (script || '').toLowerCase();

  const isCombat =
    presetName === 'combat' ||
    presetName === 'fighting' ||
    scriptLower.includes('punch') ||
    scriptLower.includes('kick') ||
    scriptLower.includes('fighter') ||
    scriptLower.includes('scorpion') ||
    scriptLower.includes('lantern');

  if (isCombat) {
    return {
      layout: 'combat',
      dpad: 'directional',
      buttons: [
        { action: 'BLOCK', label: 'BLOCK', icon: '🛡️', color: '#3a86ff', glow: 'rgba(58,134,255,0.45)' },
        { action: 'SPECIAL', label: 'SPEAR', icon: '⛓️', color: '#eab308', glow: 'rgba(234,179,8,0.5)' },
        { action: 'KICK', label: 'KICK', icon: '🦵', color: '#e63946', glow: 'rgba(230,57,70,0.45)' },
        { action: 'PUNCH', label: 'PUNCH', icon: '🥊', color: '#ff4400', glow: 'rgba(255,68,0,0.5)' },
      ],
    };
  }

  const isPlatformer =
    presetName === 'platformer' ||
    presetName === 'runner' ||
    (scriptLower.includes('jump') && !scriptLower.includes('gas') && !scriptLower.includes('kart'));

  if (isPlatformer) {
    return {
      layout: 'platformer',
      dpad: 'steering',
      buttons: [
        { action: 'JUMP', label: 'JUMP', icon: '▲', color: '#3b82f6', glow: 'rgba(59,130,246,0.45)' },
        { action: 'ATTACK', label: 'ATTACK', icon: '⚔️', color: '#ef4444', glow: 'rgba(239,68,68,0.45)' },
      ],
    };
  }

  // Default: Driving / Racing
  return {
    layout: 'driving',
    dpad: 'steering',
    buttons: [
      { action: 'drift', label: 'DRIFT', icon: '⚡', color: '#f59e0b', glow: 'rgba(245,158,11,0.4)' },
      { action: 'gas', label: 'GAS', icon: '▲', color: '#22c55e', glow: 'rgba(34,197,94,0.4)' },
    ],
  };
}

export const GameTokEngineView: React.FC<GameTokEngineProps> = ({
  gameScript,
  cameraMode = '3D',
  gravity = [0, -9.81, 0],
  showControls = true,
  controlsConfig,
  onScoreUpdate,
  onGameOver,
  style,
  children,
  ...rest
}) => {
  const [inputCommand, setInputCommand] = useState<{ steer: number; throttle: number; drift: boolean }>({
    steer: 0,
    throttle: 0,
    drift: false,
  });
  const [actionTrigger, setActionTrigger] = useState<string | null>(null);

  const steerRef = useRef(0);
  const throttleRef = useRef(0);
  const driftRef = useRef(false);

  const activeControls = useMemo(() => {
    return resolveControls(gameScript, controlsConfig);
  }, [gameScript, controlsConfig]);

  const updateInput = useCallback((steer: number, throttle: number, drift: boolean) => {
    steerRef.current = steer;
    throttleRef.current = throttle;
    driftRef.current = drift;
    setInputCommand({ steer, throttle, drift });
  }, []);

  const triggerAction = useCallback((act: string) => {
    triggerHaptic();
    setActionTrigger(act);
    setTimeout(() => setActionTrigger(null), 120);
  }, []);

  const handleButtonPressIn = useCallback((btn: TouchButtonConfig) => {
    const act = btn.action;
    if (act === 'gas') {
      updateInput(steerRef.current, 1.0, driftRef.current);
    } else if (act === 'drift') {
      updateInput(steerRef.current, -0.4, true);
    }
    triggerAction(act);
  }, [triggerAction, updateInput]);

  const handleButtonPressOut = useCallback((btn: TouchButtonConfig) => {
    const act = btn.action;
    if (act === 'gas') {
      updateInput(steerRef.current, 0.0, driftRef.current);
    } else if (act === 'drift') {
      updateInput(steerRef.current, throttleRef.current, false);
    }
  }, [updateInput]);

  const renderDpad = () => {
    if (activeControls.dpad === 'none') return null;

    if (activeControls.dpad === 'directional') {
      // 4-Way D-Pad for Combat / Platformer
      return (
        <View style={styles.directionalPadGroup} pointerEvents="box-none">
          <View style={styles.dpadRowCenter}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.controlBtn, styles.dpadBtn]}
              onPressIn={() => {
                triggerHaptic();
                updateInput(steerRef.current, 1.0, driftRef.current);
                triggerAction('UP');
              }}
              onPressOut={() => updateInput(steerRef.current, 0.0, driftRef.current)}
            >
              <Text style={styles.controlBtnText}>▲</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dpadRowMiddle}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.controlBtn, styles.dpadBtn]}
              onPressIn={() => {
                triggerHaptic();
                updateInput(-1.0, throttleRef.current, driftRef.current);
                triggerAction('LEFT');
              }}
              onPressOut={() => updateInput(0.0, throttleRef.current, driftRef.current)}
            >
              <Text style={styles.controlBtnText}>◀</Text>
            </TouchableOpacity>
            <View style={styles.dpadCenterSpacer} />
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.controlBtn, styles.dpadBtn]}
              onPressIn={() => {
                triggerHaptic();
                updateInput(1.0, throttleRef.current, driftRef.current);
                triggerAction('RIGHT');
              }}
              onPressOut={() => updateInput(0.0, throttleRef.current, driftRef.current)}
            >
              <Text style={styles.controlBtnText}>▶</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dpadRowCenter}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.controlBtn, styles.dpadBtn]}
              onPressIn={() => {
                triggerHaptic();
                updateInput(steerRef.current, -1.0, driftRef.current);
                triggerAction('DOWN');
              }}
              onPressOut={() => updateInput(steerRef.current, 0.0, driftRef.current)}
            >
              <Text style={styles.controlBtnText}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Default 2-Way Steering Controls (Bottom Left)
    return (
      <View style={styles.steeringGroup} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.controlBtn}
          onPressIn={() => {
            triggerHaptic();
            updateInput(-1.0, throttleRef.current, driftRef.current);
            triggerAction('LEFT');
          }}
          onPressOut={() => updateInput(0.0, throttleRef.current, driftRef.current)}
        >
          <Text style={styles.controlBtnText}>◀</Text>
          <Text style={styles.controlBtnSub}>LEFT</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.controlBtn}
          onPressIn={() => {
            triggerHaptic();
            updateInput(1.0, throttleRef.current, driftRef.current);
            triggerAction('RIGHT');
          }}
          onPressOut={() => updateInput(0.0, throttleRef.current, driftRef.current)}
        >
          <Text style={styles.controlBtnText}>▶</Text>
          <Text style={styles.controlBtnSub}>RIGHT</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderActionButtons = () => {
    const buttons = activeControls.buttons;
    const isGrid = buttons.length > 2;

    return (
      <View style={isGrid ? styles.actionGridGroup : styles.actionRowGroup} pointerEvents="box-none">
        {buttons.map((btn, index) => {
          const btnColor = btn.color || '#3b82f6';
          const btnGlow = btn.glow || 'rgba(59, 130, 246, 0.4)';
          const isPressed = actionTrigger === btn.action;

          return (
            <TouchableOpacity
              key={btn.action || index}
              activeOpacity={0.75}
              style={[
                styles.controlBtn,
                styles.dynamicActionBtn,
                {
                  borderColor: btnColor,
                  shadowColor: btnColor,
                  backgroundColor: isPressed ? btnColor : 'rgba(20, 20, 32, 0.85)',
                },
              ]}
              onPressIn={() => handleButtonPressIn(btn)}
              onPressOut={() => handleButtonPressOut(btn)}
            >
              <Text style={styles.controlBtnText}>{btn.icon || '⚡'}</Text>
              <Text style={[styles.controlBtnSub, { color: isPressed ? '#ffffff' : btnColor }]}>
                {btn.label || btn.action}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderControls = () => {
    if (!showControls) return null;
    return (
      <View style={styles.controlsOverlay} pointerEvents="box-none">
        {/* Top Engine Badge */}
        <View style={styles.engineBadgeContainer} pointerEvents="none">
          <View style={styles.engineBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.engineBadgeText}>
              NATIVE 3D ENGINE • 120 FPS METAL • {activeControls.layout.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Bottom Bar: Touch Controls */}
        <View style={styles.bottomControlsRow} pointerEvents="box-none">
          {renderDpad()}
          {renderActionButtons()}
        </View>
      </View>
    );
  };

  if (Platform.OS === 'web' || !NativeView) {
    return (
      <View style={[styles.container, style]} {...rest}>
        <View style={styles.fallbackBox}>
          <Text style={styles.fallbackTitle}>🚀 GameTok 3D Native Engine</Text>
          <Text style={styles.fallbackSub}>Compiles with Apple Metal & Android Vulkan in native build.</Text>
        </View>
        {renderControls()}
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <NativeView
        style={StyleSheet.absoluteFill}
        gameScript={gameScript}
        cameraMode={cameraMode}
        gravity={gravity}
        inputCommand={inputCommand}
        actionTrigger={actionTrigger}
        {...rest}
      />
      {renderControls()}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050508',
  },
  fallbackBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  fallbackSub: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    textAlign: 'center',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 110,
    paddingTop: 85,
  },
  engineBadgeContainer: {
    alignItems: 'center',
  },
  engineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 18, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  engineBadgeText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  bottomControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  steeringGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  directionalPadGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadRowCenter: {
    alignItems: 'center',
  },
  dpadRowMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dpadCenterSpacer: {
    width: 14,
    height: 14,
  },
  dpadBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  actionRowGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  actionGridGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 140,
    gap: 10,
    justifyContent: 'flex-end',
  },
  controlBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(24, 24, 38, 0.85)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  dynamicActionBtn: {
    // Dynamically colored via style prop
  },
  controlBtnText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  controlBtnSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 1,
  },
});
