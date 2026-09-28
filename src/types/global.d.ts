declare global {
  interface Window {
    yandexMusicMod: {
      getStorageValue: (key: string) => any;
      setStorageValue: (key: string, value: any) => void;
      onStorageChanged: (cb: Function) => void;
      downloadTrack: (downloadInfo: any, trackMeta: any, customDownloadPath?: string) => any;
      selectDownloadFolder: () => Promise<{ success: boolean; path: string | null }>;
      openFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      selectBackgroundFile: () => Promise<{ success: boolean; path: string | null }>;
      getMediaServerPort: () => Promise<number>;
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
