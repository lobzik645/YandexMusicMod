declare global {
  interface Window {
    yandexMusicMod: {
      getStorageValue: (key: string) => any;
      setStorageValue: (key: string, value: any) => void;
      onStorageChanged: (cb: Function) => void;
      downloadTrack: (
        downloadInfo: any,
        trackMeta: any,
        customDownloadPath?: string,
        downloadId?: string,
      ) => Promise<{ ok?: boolean; error?: string; cancelled?: boolean }>;
      cancelDownload: (downloadId: string) => void;
      onDownloadProgress: (
        cb: (payload: { id: string; status: string; loaded: number; total: number; speed: number; error?: string }) => void,
      ) => () => void;
      saveFileWithDialog: (options: {
        title?: string;
        defaultFileName?: string;
        content: string;
      }) => Promise<{ success: boolean; path?: string; cancelled?: boolean; error?: string }>;
      exportModSettings: () => Promise<{ success: boolean; path?: string; cancelled?: boolean; error?: string }>;
      importModSettings: () => Promise<{ success: boolean; path?: string; cancelled?: boolean; error?: string }>;
      selectDownloadFolder: () => Promise<{ success: boolean; path: string | null }>;
      openFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      selectBackgroundFile: () => Promise<{ success: boolean; path: string | null }>;
      getMediaServerPort: () => Promise<{ port: number; token: string }>;
      readFileAsDataUrl: (filePath: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
      sendPlayerAction: (action: string) => void;
      showOsd: (payload: any) => void;
      updateDiscordRpc: (state: any) => void;
      onPlayerAction: (cb: (action: string) => void) => () => void;
      axios: (config: string | any) => Promise<{
        success: boolean;
        data?: any;
        error?: string;
        status?: number;
        statusText?: string;
        headers?: any;
      }>;
    };
    VERSION: string;
    __getPlayerState: () => any;
  }
}

export {};
