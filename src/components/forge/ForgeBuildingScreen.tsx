import React from 'react';
import { ForgeUnderstandingScreen } from './ForgeUnderstandingScreen';

export const BUILDING_STEPS = [
  'Gathering and preparing assets...',
  'Building the world...',
  'Setting up gameplay...',
  'Adding audio & effects...',
  'Finalizing your game...',
];

interface Props {
  prompt?: string;
  gameTitle?: string;
  activeStep?: number;
  steps?: string[];
  mascotMessage?: string;
  onClose?: () => void;
  onCookInBackground?: () => void;
}

export const BUILDING_MASCOT_MESSAGES = [
  'Pixil is gathering high-poly 3D models, textures, and assets...',
  'Pixil is constructing the 3D scene geometry, lighting, and world...',
  'Pixil is programming gameplay logic, physics, and touch controls...',
  'Pixil is synthesizing dynamic sound effects and particle polish...',
  'Pixil is finalizing your game build and preparing for play!',
];

export const ForgeBuildingScreen: React.FC<Props> = ({
  prompt = '',
  activeStep = 0,
  steps = BUILDING_STEPS,
  mascotMessage,
  onClose,
}) => {
  const dynamicMessage = mascotMessage && !mascotMessage.includes("Everything's coming together")
    ? mascotMessage
    : (BUILDING_MASCOT_MESSAGES[Math.min(activeStep, BUILDING_MASCOT_MESSAGES.length - 1)] || "Everything's coming together!\nThis usually takes a few minutes.");

  return (
    <ForgeUnderstandingScreen
      title="Building your game..."
      prompt={prompt}
      activeStep={activeStep}
      steps={steps}
      mascotMessage={dynamicMessage}
      onClose={onClose}
    />
  );
};
