// Game downloader service
// NOTE: Local caching is disabled because WebView can't load WASM from file:// URLs
// Games are served directly from Cloudflare Pages which has proper CORS headers

// Cloudflare Pages URL (has proper CORS headers for WASM)
const PAGES_URL = 'https://gametok-games.pages.dev/openpigeon-games/';

export interface DownloadProgress {
  isDownloading: boolean;
  isComplete: boolean;
  progress: number;
  currentFile: string;
  bytesDownloaded: number;
  totalBytes: number;
  error?: string;
}

let downloadState: DownloadProgress = {
  isDownloading: false,
  isComplete: true, // Always "complete" since we use remote URL
  progress: 100,
  currentFile: '',
  bytesDownloaded: 0,
  totalBytes: 0,
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

// Check if games are available (always true since we use remote)
export async function areGamesDownloaded(): Promise<boolean> {
  return true;
}

// Get the game URL - always use Pages URL for proper CORS/WASM support
export function getGameUrl(gameId: string): string {
  return `${PAGES_URL}index.html?game=${gameId}`;
}

// Get current download state
export function getDownloadState(): DownloadProgress {
  return { ...downloadState };
}

// Start "download" - no-op since we use remote URL
export async function startGameDownload(): Promise<void> {
  console.log('[GameDownloader] Using remote Cloudflare Pages URL');
  downloadState = { ...downloadState, isComplete: true, isDownloading: false, progress: 100 };
  notifyListeners();
}

// Clear downloaded games - no-op
export async function clearDownloadedGames(): Promise<void> {
  console.log('[GameDownloader] No local cache to clear');
}

export { PAGES_URL as R2_BASE_URL };
