// Game downloader service
// Games are served via Cloudflare Worker that proxies R2 with CORS headers

// Worker URL that proxies R2 with CORS headers
const WORKER_URL = 'https://openpigeon-cors.abiolaolasubomi2007.workers.dev/';

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

// Get the game URL - uses Worker that proxies R2 with CORS
export function getGameUrl(gameId: string): string {
  return `${WORKER_URL}index.html?game=${gameId}`;
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

export { WORKER_URL as R2_BASE_URL };
