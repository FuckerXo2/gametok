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

export const ForgeBuildingScreen: React.FC<Props> = ({
  prompt = '',
  activeStep = 1,
  steps = BUILDING_STEPS,
  mascotMessage = "Everything's coming together!\nThis usually takes a few minutes.",
  onClose,
}) => {
  return (
    <ForgeUnderstandingScreen
      title="Building your game..."
      prompt={prompt}
      activeStep={activeStep}
      steps={steps}
      mascotMessage={mascotMessage}
      onClose={onClose}
    />
  );
};
