import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

export const DEFAULT_FORGE_STEPS = [
  'Analyzing your request...',
  'Exploring game mechanics...',
  'Researching visual directions...',
  'Identifying assets...',
  'Preparing concepts...',
];

interface Props {
  activeStep: number;
  steps?: string[];
  onSelectStep?: (index: number) => void;
}

export const ForgeChecklistCard: React.FC<Props> = ({
  activeStep,
  steps = DEFAULT_FORGE_STEPS,
  onSelectStep,
}) => {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.96, { duration: 1100, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [pulse]);

  const activeIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.cardContainer}>
      {steps.map((stepText, index) => {
        const isDone = index < activeStep;
        const isActive = index === activeStep;
        const isLast = index === steps.length - 1;

        return (
          <Pressable
            key={`${stepText}-${index}`}
            style={styles.row}
            onPress={() => onSelectStep?.(index)}
          >
            {/* Left column: indicator node + vertical line */}
            <View style={styles.indicatorCol}>
              {isDone ? (
                <View style={styles.doneCircle}>
                  <Ionicons name="checkmark" size={13} color="#042F24" />
                </View>
              ) : isActive ? (
                <Animated.View style={[styles.activeOuterRing, activeIndicatorStyle]}>
                  <View style={styles.activeInnerDot} />
                </Animated.View>
              ) : (
                <View style={styles.pendingCircle} />
              )}

              {/* Vertical connector line */}
              {!isLast && (
                <View
                  style={[
                    styles.connectorLine,
                    isDone ? styles.connectorLineDone : styles.connectorLinePending,
                  ]}
                />
              )}
            </View>

            {/* Right column: text label */}
            <View style={styles.textCol}>
              <Text
                style={[
                  styles.stepText,
                  isActive && styles.stepTextActive,
                  isDone && styles.stepTextDone,
                  !isDone && !isActive && styles.stepTextPending,
                ]}
              >
                {stepText}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: 'rgba(10, 15, 30, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.16)',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 40,
  },
  indicatorCol: {
    width: 28,
    alignItems: 'center',
    marginRight: 14,
  },
  textCol: {
    flex: 1,
    paddingTop: 1,
    paddingBottom: 16,
  },
  doneCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34D399',
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 2,
  },
  activeOuterRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.4,
    borderColor: '#C084FC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(192, 132, 252, 0.16)',
    shadowColor: '#C084FC',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 2,
  },
  activeInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  pendingCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.8,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  connectorLine: {
    position: 'absolute',
    top: 22,
    bottom: -6,
    width: 2,
    zIndex: 1,
  },
  connectorLineDone: {
    backgroundColor: 'rgba(52, 211, 153, 0.45)',
  },
  connectorLinePending: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  stepTextDone: {
    color: '#F1F5F9',
    fontWeight: '600',
  },
  stepTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  stepTextPending: {
    color: 'rgba(255, 255, 255, 0.38)',
    fontWeight: '400',
  },
});
