# GameTok 3D Avatar Rebuild Plan

## Goal

Replace the current avatar system with a real 3D avatar product that feels native to GameTok:

- remove the old preset-image avatar creator
- remove the temporary Avaturn beta flow
- support a custom 3D avatar identity system that users can create, edit, and keep using across the app
- leave room for selfie-to-avatar AI assistance without making the whole system depend on a third-party avatar platform

This plan assumes we can source or generate the base 3D character assets separately.

## Why We Are Replacing the Current System

The current avatar stack is not a real creator.

Problems:

- the old avatar creator is mostly a preset picker over weak pre-rendered images
- the Avaturn beta is a disconnected experiment, not a true product flow
- there is no shared avatar DNA/config model that the app owns
- there is no real 3D avatar lifecycle inside GameTok
- the visual identity is inconsistent and not ownable

Current code we should eventually remove:

- `/Users/abiolalimitless/gameidea/gametok/src/components/AvatarCreator`
- `/Users/abiolalimitless/gameidea/gametok/src/components/AvaturnCreatorModal.tsx`
- old avatar entry points in `/Users/abiolalimitless/gameidea/gametok/src/components/EditProfileModal.tsx`

## Product Direction

We should not build "random AI portraits in 3D."

We should build:

- one GameTok 3D house style
- one modular avatar system
- one saved avatar configuration per user
- optional AI-assisted fitting from selfie/photo
- manual editing on top

That means:

- AI helps map a user into our system
- the system itself stays structured, controllable, and consistent

## Target Experience

### V1

User flow:

1. open avatar creator from profile/settings/onboarding
2. choose or generate a starter 3D face/body
3. edit hair, skin, eyes, brows, mouth, outfit, accessories
4. save avatar
5. app uses:
   - 2D render for profile/feed/chat
   - 3D model for future profile hero, intros, lobby scenes, creator moments

### V2

Add:

- selfie/photo upload to generate a starting look
- saved outfit presets
- emotes/poses
- seasonal cosmetics
- creator badges and unlocks

### V3

Add:

- avatar use inside games or creator identity scenes
- lightweight animation/emote playback
- branded monetization/customization economy if needed

## Core Architecture

### 1. Avatar Source Of Truth

We should stop storing "just an avatar image URL" as the important thing.

We need an owned avatar config object:

```ts
type AvatarDNA = {
  schemaVersion: number;
  baseBody: string;
  skinTone: string;
  faceShape: string;
  eyeStyle: string;
  eyeColor: string;
  browStyle: string;
  noseStyle: string;
  mouthStyle: string;
  hairStyle: string;
  hairColor: string;
  facialHairStyle?: string;
  outfitTop: string;
  outfitBottom?: string;
  footwear?: string;
  accessories: string[];
  headwear?: string;
  materialVariant?: string;
  renderPose?: string;
};
```

This config becomes the real user avatar record.

Derived outputs:

- `avatar_render_url`
- `avatar_model_url`
- optional `avatar_thumbnail_url`

### 2. Asset System

We need one modular 3D avatar kit with:

- base body mesh
- head/face variants or morph targets
- hair meshes
- outfit meshes
- accessories
- materials/textures
- shared rig/skeleton

Important:

- all parts must conform to one rig contract
- all cosmetic parts must fit the same body proportions
- we should keep art style narrow and strong

### 3. Rendering Strategy

App needs both:

- 2D avatar renders for fast everyday UI
- 3D model preview/editor for creation flow

Recommended split:

- use rendered 2D snapshots in most normal React Native surfaces
- use a dedicated 3D preview/editor surface only where needed

We do not want the whole app rendering live 3D everywhere.

### 4. Backend Data Model

Add avatar fields like:

- `avatar_dna jsonb`
- `avatar_model_url text`
- `avatar_render_url text`
- `avatar_thumbnail_url text`
- `avatar_version int`

The config stays canonical.

## Where AI Fits

AI should help with initialization, not replace the whole system.

### Good AI Use

- infer a starting face/body preset from a selfie
- estimate likely hair shape/color
- estimate skin tone and facial feature category
- maybe suggest outfits/styles

### Bad AI Use

- generating arbitrary new avatar rigs each time
- inventing totally inconsistent meshes/textures
- making the product depend on one external avatar vendor forever

## Selfie-To-Avatar Pipeline

When we are ready:

1. user uploads selfie
2. face-analysis model extracts features
3. mapper converts features into `AvatarDNA`
4. user edits result manually
5. app renders and saves final avatar

Important rule:

- selfie is used to create a good starting point
- user remains in control of the final avatar

## Execution Plan

### Phase A: Planning And Deletion Preparation

Goal:

- define the replacement cleanly before ripping anything out

Tasks:

- finalize `AvatarDNA` schema
- decide storage contract in backend
- define which current avatar fields remain temporary
- mark old creator and Avaturn beta as deprecated in code comments

### Phase B: Build Internal Avatar Platform Contract

Goal:

- make GameTok own the avatar lifecycle

Tasks:

- add `AvatarDNA` types in app and backend
- add API contract for save/load avatar config
- add migration layer from old avatar values
- add render/model URL placeholders

### Phase C: New 3D Avatar Creator UI

Goal:

- replace both current flows with one real creator

UI modules:

- avatar home screen
- face customization
- hair customization
- outfit customization
- accessories
- final review/save

Important UX rules:

- instant preview
- not too many choices on one screen
- strong defaults
- easy randomize/reset

### Phase D: 3D Preview / Rendering

Goal:

- make editing feel premium without making the whole app heavy

Tasks:

- choose 3D viewer layer
- load avatar model + cosmetics
- support rotate/zoom
- support snapshot render generation

### Phase E: AI Starter Flow

Goal:

- let users begin from a selfie without giving up control

Tasks:

- upload photo
- run face analysis / feature extraction
- map results into `AvatarDNA`
- let user refine manually

### Phase F: Remove Old Systems

Only do this after the new flow is working.

Remove:

- old preset avatar creator UI
- old preset avatar assets and URI flow
- Avaturn beta button, modal, and temporary export storage

## Migration Strategy

We should not break existing users.

Migration approach:

1. keep current avatar field readable for a while
2. add new `avatar_dna` fields
3. if a user has old avatar only:
   - show old avatar as fallback
   - encourage upgrade to new creator
4. once adoption is high, remove old creator UI

## Risks

### Art Risk

- if the base character kit is weak, the whole feature feels cheap

### Technical Risk

- trying to render too much live 3D in ordinary app surfaces

### Product Risk

- too much customization too early can overwhelm users

### AI Risk

- selfie fitting can get uncanny if treated like full generation instead of structured mapping

## Recommended Build Order

1. define `AvatarDNA`
2. add backend storage contract
3. create new creator UI shell
4. hook in real 3D preview
5. support save/load
6. add selfie-to-avatar AI starter
7. remove Avaturn beta
8. remove old avatar picker

## Definition Of Done

We can call this complete when:

- GameTok owns avatar config format
- a user can create and save a real 3D avatar in-app
- profile/feed can render avatar snapshots cleanly
- old avatar creator is gone
- Avaturn beta is gone
- selfie-to-avatar produces a good editable starting point

## Notes For Future Implementation

- keep the system modular and versioned
- never let third-party provider assumptions become the app's real data model
- prioritize visual identity over raw realism
- 2D renders should be cheap and ubiquitous
- 3D should appear where it adds product value, not everywhere
