# Explore Page - Available Loops Assets

## 🎯 Current Explore Page Features

The ExploreScreen currently has:
- Search bar with game/friend search
- Friends section (horizontal scroll)
- Continue Playing section (square cards)
- Recommended For You (rectangular cards)
- Hot Games, Action, Puzzle, Racing, Arcade sections
- Category-based game organization
- Game modal with WebView

## 🎨 Most Relevant Assets for Explore Page

### 1. **Game Badges/Tags** ⭐ HIGH PRIORITY
**Assets Available:**
- `ic_recommend_tag_hot.png` - "HOT" badge for trending games
- `ic_recommend_tag_new.png` - "NEW" badge for new releases
- `ic_recommend_tag_like.png` - Popular/liked badge
- `ic_recommend_tag_pk.png` - PK/competitive badge
- `ic_home_recommend_label.png` - Recommended label

**Implementation Ideas:**
- Add "HOT" badge overlay on Hot Games section cards
- Add "NEW" badge on New Releases section
- Add "RECOMMENDED" badge on personalized recommendations
- These badges add visual interest and help users identify content types

### 2. **Search Enhancement**
**Assets Available:**
- `ic_home_search.webp` - Better search icon
- `ic_search_tab.webp` - Search tab indicator
- `lobah_icon_edit_search.webp` - Edit search icon
- `lobah_icon_friend_search.webp` - Friend-specific search

**Implementation Ideas:**
- Replace Ionicons search with Loops search icon for brand consistency
- Add visual distinction between game search and friend search

### 3. **Game State Icons**
**Assets Available:**
- `ic_game_comingsoon.png` - Coming soon indicator
- `ic_game_play.png` - Play button
- `ic_game_add.webp` - Add to favorites
- `ic_game_share.webp` - Share game
- `ic_select_game_fail.webp` - Game unavailable state

**Implementation Ideas:**
- Show "Coming Soon" on unreleased games
- Better play button on game cards
- Quick add-to-favorites button
- Share button on game cards

### 4. **Explore/Discovery Icons**
**Assets Available:**
- `ic_explore_top_1.webp` - Top ranking badge (#1)
- `ic_explore_player_rank.webp` - Player rank indicator
- `ic_explore_arrow.png` - Navigation arrow
- `lp_screens_explore_img_coin_*.png` - Coin reward icons

**Implementation Ideas:**
- Add "#1" badge to top game in each category
- Show player rankings
- Display coin rewards for playing

### 5. **Empty/Error States**
**Assets Available:**
- `ic_home_error_view.webp` - Generic error
- `ic_home_friend_error.png` - No friends error
- `ic_home_game_error.png` - Game loading error
- `ic_home_recommend_error.png` - Recommendation error
- `ic_home_no_friend.png` - No friends state

**Implementation Ideas:**
- Better empty state when search returns no results
- Friendly error illustrations instead of plain text
- Branded "no friends yet" state

### 6. **Category/Filter Icons**
**Assets Available:**
- `ic_home_filter_all.png` - All filter
- `ic_home_filter_video.png` - Video filter
- `ic_home_filter_audio.png` - Audio filter
- `ic_filter.png` - Generic filter icon

**Implementation Ideas:**
- Add filter chips for quick category switching
- Visual category indicators

## 🚀 Priority Enhancements for Explore Page

### Quick Wins (30 min each):
1. **Game Badges** - Add HOT/NEW badges to game cards
   - Extract `ic_recommend_tag_hot.png` and `ic_recommend_tag_new.png`
   - Add as overlay on game card images
   - Instant visual polish

2. **Better Search Icon** - Brand consistency
   - Replace Ionicons search with `ic_home_search.webp`
   - 5 minute change, big visual improvement

3. **Top Game Badge** - Highlight #1 games
   - Add `ic_explore_top_1.webp` to first game in each section
   - Shows hierarchy and importance

### Medium Priority (1-2 hours):
4. **Empty States** - Better UX
   - Use Loops error icons for no search results
   - More friendly and on-brand

5. **Play Buttons** - Better CTAs
   - Use `ic_game_play.png` on game cards
   - Clearer call-to-action

6. **Share/Add Buttons** - Quick actions
   - Add `ic_game_share.webp` and `ic_game_add.webp` to cards
   - More engagement options

## 📦 Asset Extraction Commands

```bash
# Create directories
mkdir -p gametok/assets/ui/badges
mkdir -p gametok/assets/ui/game-icons
mkdir -p gametok/assets/ui/empty-states

# Copy badge assets (PRIORITY)
cp gametok/assets/loops-extracted/drawable-xxhdpi/ic_recommend_tag_hot.png gametok/assets/ui/badges/
cp gametok/assets/loops-extracted/drawable-xxhdpi/ic_recommend_tag_new.png gametok/assets/ui/badges/
cp gametok/assets/loops-extracted/drawable-xxhdpi/ic_recommend_tag_like.png gametok/assets/ui/badges/
cp gametok/assets/loops-extracted/drawable-xxhdpi/ic_explore_top_1.webp gametok/assets/ui/badges/

# Copy game icons
cp gametok/assets/loops-extracted/drawable-xxhdpi/ic_game_play.png gametok/assets/ui/game-icons/
cp gametok/assets/loops-extracted/drawable-xxhdpi/ic_game_add.webp gametok/assets/ui/game-icons/
cp gametok/assets/loops-extracted/drawable-xxhdpi/ic_game_share.webp gametok/assets/ui/game-icons/
cp gametok/assets/loops-extracted/drawable-xxhdpi/ic_game_comingsoon.png gametok/assets/ui/game-icons/

# Copy search icon
cp gametok/assets/loops-extracted/drawable-xxhdpi/ic_home_search.webp gametok/assets/ui/

# Copy empty state assets
cp gametok/assets/loops-extracted/drawable-xxhdpi/ic_home_*_error.* gametok/assets/ui/empty-states/
cp gametok/assets/loops-extracted/drawable-xxhdpi/ic_home_no_friend.png gametok/assets/ui/empty-states/
```

## 🎨 Visual Mockup Ideas

### Game Card with Badge:
```
┌─────────────────┐
│  [Game Image]   │
│     ┌─────┐     │  <- HOT badge in top-right corner
│     │ HOT │     │
│     └─────┘     │
│                 │
│   Game Name     │
└─────────────────┘
```

### Top Game with #1 Badge:
```
┌─────────────────┐
│  [Game Image]   │
│  ┌───┐          │  <- #1 badge in top-left corner
│  │ 1 │          │
│  └───┘          │
│                 │
│   Game Name     │
└─────────────────┘
```

## 💡 Implementation Priority

**Start with badges** - they're the easiest to implement and have the biggest visual impact:

1. Extract HOT and NEW badge PNGs
2. Add them as absolutely positioned overlays on game card images
3. Show HOT badge on "Hot Games" section
4. Show NEW badge on "New Releases" section
5. Show #1 badge on first game in each category

This will make the Explore page feel much more polished and help users identify content types at a glance, just like Loops does.

**Note:** The daily spin wheel icon you see in the Explore header should actually link to the Rewards screen where the spin feature lives, not open a modal in Explore.
