import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface TooltipStep {
  id: string;
  title: string;
  description: string;
  position: 'top' | 'center' | 'bottom';
  icon?: string;
  arrowDirection?: 'up' | 'down' | 'left' | 'right' | 'none';
  highlightArea?: { x: number; y: number; width: number; height: number };
}

interface OnboardingTooltipProps {
  step: TooltipStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

export const OnboardingTooltip: React.FC<OnboardingTooltipProps> = ({
  step,
  currentStep,
  totalSteps,
  onNext,
  onSkip,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for arrow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, [step.id]);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNext();
  };

  const getPositionStyle = () => {
    switch (step.position) {
      case 'top':
        return { top: 120 };
      case 'bottom':
        return { bottom: 140 };
      case 'center':
      default:
        return { top: SCREEN_HEIGHT / 2 - 100 };
    }
  };

  const renderArrow = () => {
    if (step.arrowDirection === 'none') return null;
    
    const getArrowStyle = () => {
      switch (step.arrowDirection) {
        case 'up':
          return { transform: [{ rotate: '0deg' }, { scale: pulseAnim }], top: -30 };
        case 'down':
          return { transform: [{ rotate: '180deg' }, { scale: pulseAnim }], bottom: -30 };
        default:
          return { transform: [{ rotate: '180deg' }, { scale: pulseAnim }], bottom: -30 };
      }
    };
    
    return (
      <Animated.View style={[styles.arrowContainer, getArrowStyle()]}>
        <Ionicons name="arrow-down" size={32} color="#a855f7" />
      </Animated.View>
    );
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <TouchableOpacity 
        style={StyleSheet.absoluteFill} 
        activeOpacity={1} 
        onPress={handleNext}
      />
      
      <Animated.View 
        style={[
          styles.tooltipContainer,
          getPositionStyle(),
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.tooltip}
        >
          {/* Skip button */}
          <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          {/* Icon */}
          {step.icon && (
            <View style={styles.iconWrap}>
              <Ionicons name={step.icon as any} size={32} color="#a855f7" />
            </View>
          )}

          {/* Content */}
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          {/* Progress dots */}
          <View style={styles.dotsContainer}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View 
                key={i} 
                style={[styles.dot, i === currentStep && styles.dotActive]} 
              />
            ))}
          </View>

          {/* Next button */}
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <LinearGradient
              colors={['#a855f7', '#7c3aed']}
              style={styles.nextBtnGradient}
            >
              <Text style={styles.nextBtnText}>
                {currentStep === totalSteps - 1 ? "Let's Go!" : 'Next'}
              </Text>
              <Ionicons 
                name={currentStep === totalSteps - 1 ? "checkmark" : "arrow-forward"} 
                size={18} 
                color="#fff" 
              />
            </LinearGradient>
          </TouchableOpacity>

          {renderArrow()}
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 1000,
  },
  tooltipContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  tooltip: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  skipBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    padding: 8,
  },
  skipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(168,85,247,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: '#a855f7',
    width: 24,
  },
  nextBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  nextBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  arrowContainer: {
    position: 'absolute',
  },
});

export default OnboardingTooltip;
