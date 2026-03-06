/**
 * Loops Animation Assets
 * 
 * WebP animations extracted from Loops app
 * Use with expo-image for best performance
 */

export const LoopsAnimations = {
  // Click/Tap Effects
  clickEffect: require('../../assets/animations/ic_swipe_click_effect.webp'),
  tapToPlay: require('../../assets/animations/ic_swipe_click_tap_play.webp'),
  
  // Swipe/Guide Animations
  swipeGuideExit: require('../../assets/animations/ani_swipe_guide_exit.webp'),
  swipeGame: require('../../assets/animations/ic_swipe_game_anim.webp'),
  
  // Spin Wheel
  spinWheel: require('../../assets/animations/ic_home_spin_anim_new.webp'),
  
  // Celebrations
  fireworks: require('../../assets/animations/ic_spin_fireworks_loop.webp'),
} as const;

/**
 * Animation sizes (recommended)
 */
export const AnimationSizes = {
  clickEffect: { width: 100, height: 100 },
  tapToPlay: { width: 80, height: 80 },
  swipeGuideExit: { width: 120, height: 120 },
  swipeGame: { width: 100, height: 100 },
  spinWheel: { width: 200, height: 200 },
  fireworks: { width: '100%', height: '100%' }, // Full screen
} as const;

/**
 * Usage example:
 * 
 * import { Image } from 'expo-image';
 * import { LoopsAnimations, AnimationSizes } from '@/constants/LoopsAnimations';
 * 
 * // Click effect on tap
 * <Image
 *   source={LoopsAnimations.clickEffect}
 *   style={AnimationSizes.clickEffect}
 *   contentFit="contain"
 * />
 * 
 * // Fireworks celebration (full screen)
 * <Image
 *   source={LoopsAnimations.fireworks}
 *   style={StyleSheet.absoluteFill}
 *   contentFit="cover"
 * />
 * 
 * // Spin wheel
 * <Image
 *   source={LoopsAnimations.spinWheel}
 *   style={AnimationSizes.spinWheel}
 *   contentFit="contain"
 * />
 */
