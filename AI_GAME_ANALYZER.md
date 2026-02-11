# AI Game Analyzer - Future Feature

## Purpose
Automated system to analyze games and generate per-game rules for hiding loaders/ads without breaking game content.

## How It Works
1. Load each game in a headless browser (Puppeteer)
2. Take screenshots at different loading stages
3. Use vision AI (Claude/GPT-4V) to identify:
   - Loading screens vs actual game content
   - Ad overlays vs game UI
   - Consent banners
   - Broken/non-functional games
4. Generate specific CSS/JS rules per game
5. Store rules in database with game ID
6. App fetches rules when loading that specific game

## Benefits
- No more hardcoded selectors that break games
- Per-game customization
- Can detect broken games before users see them
- Quality scoring based on load time, functionality
- Auto-flag games with unskippable ads

## Tech Stack
- Puppeteer for headless browser
- Claude Vision API or GPT-4V for image analysis
- PostgreSQL to store per-game rules
- GitHub Action to run periodically on new games

## Database Schema
```sql
CREATE TABLE game_rules (
  game_id TEXT PRIMARY KEY REFERENCES games(id),
  hide_selectors TEXT[], -- CSS selectors to hide
  inject_js TEXT, -- Custom JS for this game
  quality_score INT, -- 1-100 based on AI analysis
  is_broken BOOLEAN DEFAULT FALSE,
  analyzed_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoint
```
GET /api/games/:id/rules
Returns: { hideSelectors: [...], injectJs: "..." }
```

## Status
- [ ] Build Puppeteer screenshot service
- [ ] Integrate vision AI
- [ ] Create database schema
- [ ] Add API endpoint
- [ ] Update app to fetch and apply rules
