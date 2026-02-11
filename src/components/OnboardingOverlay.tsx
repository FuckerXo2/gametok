import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingTooltip, TooltipStep } from './OnboardingTooltip';

const ONBOARDING_KEY = '@gametok_onboarding_complete';

const ONBOARDING_STEPS: TooltipStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to GameTOK!',
    description: 'Discover endless games, earn coins while you play, and redeem real rewards.',
    position: 'center',
    icon: 'game-controller',
    arrowDirection: 'none',
  },
  {
    id: 'swipe',
    title: 'Swipe to Discover',
    description: 'Swipe up to browse through hundreds of games. Each swipe reveals something new!',
    position: 'center',
    icon: 'swap-vertical',
    arrowDirection: 'down',
  },
  {
    id: 'play',
    title: 'Play & Earn Coins',
    description: 'Tap any game to play. The longer you play, the more coins you earn automatically!',
    position: 'center',
    icon: 'play-circle',
    arrowDirection: 'none',
  },
  {
    id: 'rewards',
    title: 'Claim Rewards',
    description: 'Visit the Rewards tab to complete daily missions, unlock achievements, and spend your coins on real prizes!',
    position: 'bottom',
    icon: 'gift',
    arrowDirection: 'down',
  },
];

interface OnboardingOverlayProps {
  onComplete: () => void;
}

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!completed) {
        setShowOnboarding(true);
      }
    } catch (e) {
      console.log('Error checking onboarding status:', e);
    }
    setChecked(true);
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (e) {
      console.log('Error saving onboarding status:', e);
    }
    setShowOnboarding(false);
    onComplete();
  };

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  if (!checked || !showOnboarding) return null;

  return (
    <OnboardingTooltip
      step={ONBOARDING_STEPS[currentStep]}
      currentStep={currentStep}
      totalSteps={ONBOARDING_STEPS.length}
      onNext={handleNext}
      onSkip={handleSkip}
    />
  );
};

export const resetOnboarding = async () => {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    console.log('Onboarding reset');
  } catch (e) {
    console.log('Error resetting onboarding:', e);
  }
};

export default OnboardingOverlay;
