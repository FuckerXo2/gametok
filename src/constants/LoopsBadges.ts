/**
 * Loops Badge Assets
 * 
 * Visual badges and tags for game cards
 */

export const LoopsBadges = {
  // Recommendation tags
  hot: require('../../assets/ui/badges/ic_recommend_tag_hot.png'),
  new: require('../../assets/ui/badges/ic_recommend_tag_new.png'),
  like: require('../../assets/ui/badges/ic_recommend_tag_like.png'),
  
  // Ranking badges
  top1: require('../../assets/ui/badges/ic_explore_top_1.webp'),
} as const;

export const LoopsIcons = {
  // UI icons
  search: require('../../assets/ui/ic_home_search.webp'),
} as const;

/**
 * Badge sizes (recommended)
 */
export const BadgeSizes = {
  hot: { width: 48, height: 24 },
  new: { width: 48, height: 24 },
  like: { width: 48, height: 24 },
  top1: { width: 32, height: 32 },
} as const;

/**
 * Usage example:
 * 
 * import { LoopsBadges, BadgeSizes } from '@/constants/LoopsBadges';
 * 
 * // HOT badge overlay
 * <Image
 *   source={LoopsBadges.hot}
 *   style={{
 *     position: 'absolute',
 *     top: 8,
 *     right: 8,
 *     width: BadgeSizes.hot.width,
 *     height: BadgeSizes.hot.height,
 *   }}
 *   resizeMode="contain"
 * />
 */
