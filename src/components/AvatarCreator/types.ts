// Avatar Creator Types

export type SkinTone = 'light' | 'medium' | 'medium-dark' | 'dark' | 'deep';

export type HairStyle =
    | 'curly'
    | 'straight'
    | 'buzz'
    | 'wavy'
    | 'ponytail'
    | 'spiky'
    | 'afro'
    | 'braids'
    | 'fade'
    | 'bun'
    | 'locs'
    | 'bob';

export type BackgroundColor = string;

export interface AvatarOption {
    id: string;
    skinTone: SkinTone;
    hairStyle: HairStyle;
    label: string;
    image: any; // require() image source
}

export interface AvatarConfig {
    avatarId: string;       // Selected avatar option ID
    backgroundColor: string; // Selected background color
}

export interface AvatarCategory {
    id: string;
    label: string;
    icon: string; // Ionicons name
}
