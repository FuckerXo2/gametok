// Use legacy API for expo-file-system v19+
import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  createDownloadResumable,
  deleteAsync,
} from 'expo-file-system/legacy';
import type { DownloadProgressData } from 'expo-file-system/legacy';

// R2 CDN URL for game files
const R2_BASE_URL = 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/openpigeon/';
const GAMES_DIR = `${documentDirectory}games/openpigeon/`;

// Files to download (in order of priority)
const GAME_FILES = [
  { name: 'index.html', size: 5000 },           // ~5KB
  { name: 'index.js', size: 500000 },           // ~500KB
  { name: 'index.png', size: 10000 },           // ~10KB
  { name: 'index.icon.png', size: 5000 },       // ~5KB
  { name: 'index.apple-touch-icon.png', size: 5000 },
  { name: 'index.audio.worklet.js', size: 2000 },
  { name: 'index.audio.position.worklet.js', size: 2000 },
  { name: 'index.wasm', size: 36000000 },       // ~36MB
  { name: 'index.pck', size: 133000000 },       // ~133MB
];

const TOTAL_SIZE = GAME_FILES.reduce((sum, f) => sum + f.size, 0);

export interface DownloadProgress {
  isDownloading: boolean;
  isComplete: boolean;
  progress: number; // 0-100
  currentFile: string;
  bytesDownloaded: number;
  totalBytes: number;
  error?: string;
}

let downloadState: DownloadProgress = {
  isDownloading: false,
  isComplete: false,
  progress: 0,
  currentFile: '',
  bytesDownloaded: 0,
  totalBytes: TOTAL_SIZE,
};

let progressListeners: ((progress: DownloadProgress) => void)[] = [];

// Subscribe to download progress updates
export function subscribeToProgress(listener: (progress: DownloadProgress) => void): () => void {
  progressListeners.push(listener);
  listener(downloadState);
  return () => {
    progressListeners = progressListeners.filter(l => l !== listener);
  };
}

function notifyListeners() {
  progressListeners.forEach(l => l({ ...downloadState }));
}

// Check if games are already downloaded
export async function areGamesDownloaded(): Promise<boolean> {
  try {
    const pckInfo = await getInfoAsync(`${GAMES_DIR}index.pck`);
    const wasmInfo = await getInfoAsync(`${GAMES_DIR}index.wasm`);
    const htmlInfo = await getInfoAsync(`${GAMES_DIR}index.html`);
    return pckInfo.exists && wasmInfo.exists && htmlInfo.exists;
  } catch {
    return false;
  }
}

// Get the local game URL if downloaded, otherwise remote
export function getGameUrl(gameId: string): string {
  if (downloadState.isComplete) {
    return `${GAMES_DIR}index.html?game=${gameId}`;
  }
  return `${R2_BASE_URL}index.html?game=${gameId}`;
}

// Get current download state
export function getDownloadState(): DownloadProgress {
  return { ...downloadState };
}

// Start background download of game files
export async function startGameDownload(): Promise<void> {
  if (await areGamesDownloaded()) {
    downloadState = { ...downloadState, isComplete: true, isDownloading: false, progress: 100 };
    notifyListeners();
    console.log('[GameDownloader] Games already downloaded');
    return;
  }

  if (downloadState.isDownloading) {
    console.log('[GameDownloader] Download already in progress');
    return;
  }

  downloadState = {
    isDownloading: true,
    isComplete: false,
    progress: 0,
    currentFile: '',
    bytesDownloaded: 0,
    totalBytes: TOTAL_SIZE,
  };
  notifyListeners();

  console.log('[GameDownloader] Starting background download...');

  try {
    await makeDirectoryAsync(GAMES_DIR, { intermediates: true });
    let totalDownloaded = 0;

    for (const file of GAME_FILES) {
      const localPath = `${GAMES_DIR}${file.name}`;
      const remoteUrl = `${R2_BASE_URL}${file.name}`;

      const fileInfo = await getInfoAsync(localPath);
      if (fileInfo.exists) {
        totalDownloaded += file.size;
        downloadState = {
          ...downloadState,
          bytesDownloaded: totalDownloaded,
          progress: Math.round((totalDownloaded / TOTAL_SIZE) * 100),
        };
        notifyListeners();
        continue;
      }

      downloadState = { ...downloadState, currentFile: file.name };
      notifyListeners();
      console.log(`[GameDownloader] Downloading ${file.name}...`);

      const downloadResumable = createDownloadResumable(
        remoteUrl,
        localPath,
        {},
        (dp: DownloadProgressData) => {
          downloadState = {
            ...downloadState,
            bytesDownloaded: totalDownloaded + dp.totalBytesWritten,
            progress: Math.round(((totalDownloaded + dp.totalBytesWritten) / TOTAL_SIZE) * 100),
          };
          notifyListeners();
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (!result?.uri) throw new Error(`Failed to download ${file.name}`);

      totalDownloaded += file.size;
      downloadState = {
        ...downloadState,
        bytesDownloaded: totalDownloaded,
        progress: Math.round((totalDownloaded / TOTAL_SIZE) * 100),
      };
      notifyListeners();
      console.log(`[GameDownloader] Downloaded ${file.name}`);
    }

    downloadState = { ...downloadState, isDownloading: false, isComplete: true, progress: 100, currentFile: '' };
    notifyListeners();
    console.log('[GameDownloader] All games downloaded successfully!');
  } catch (error) {
    console.error('[GameDownloader] Download failed:', error);
    downloadState = {
      ...downloadState,
      isDownloading: false,
      error: error instanceof Error ? error.message : 'Download failed',
    };
    notifyListeners();
  }
}

// Clear downloaded games (for debugging/reset)
export async function clearDownloadedGames(): Promise<void> {
  try {
    await deleteAsync(GAMES_DIR, { idempotent: true });
    downloadState = {
      isDownloading: false,
      isComplete: false,
      progress: 0,
      currentFile: '',
      bytesDownloaded: 0,
      totalBytes: TOTAL_SIZE,
    };
    notifyListeners();
    console.log('[GameDownloader] Cleared downloaded games');
  } catch (e) {
    console.error('[GameDownloader] Failed to clear games:', e);
  }
}

export { R2_BASE_URL, GAMES_DIR };
