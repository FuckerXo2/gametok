// Where the avatar stage and item pictures are served from: games/avatar-editor on R2
// (tools/publish_stage.mjs). LOCAL: while working on them, the avatar-editor server on the Mac instead
// (launch config "avatar-editor").
import { Platform } from 'react-native';

const LOCAL = false;
const DEV_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:8980' : 'http://localhost:8980';
export const AVATAR_HOST = __DEV__ && LOCAL ? DEV_HOST : 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/web-games/avatar';
