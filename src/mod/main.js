const electron = require("electron");
const fs = require("fs");
const path = require("path");
const process = require("process");
const sanitize = require("sanitize-filename");
const axios = require("axios");
const http = require("http");
const url = require("url");

// ffmpeg-static (либа которая бандлит бинарники ffmpeg)
const pathToFfmpeg = require("ffmpeg-static").replaceAll("app.asar", "app.asar.unpacked");
const { exec } = require("child_process");
console.log("bundled ffmpeg binary path:", pathToFfmpeg);

const appFolder = electron.app.getPath("userData");
const settingsFilePath = path.join(appFolder, "mod_settings.json");
const defaultDownloadPath = path.join(appFolder, "Downloads");

// Создание папки для хранения настроек пользователя
fs.mkdir(appFolder, { recursive: true }, (err) => {
  if (err) return console.error(err);
  console.log("mod_settings directory created successfully!");
});

// Создание папки для загрузки треков
fs.mkdir(defaultDownloadPath, { recursive: true }, (err) => {
  if (err) return console.error(err);
  console.log("Default download directory created successfully!");
});

if (!fs.existsSync(settingsFilePath)) {
  // Initialize settings with default download path on first run
  const initialSettings = {
    downloadFolderPath: defaultDownloadPath,
  };
  fs.writeFileSync(settingsFilePath, JSON.stringify(initialSettings, null, 2));
} else {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    // Set default download path if not already set
    if (!settings.downloadFolderPath) {
      settings.downloadFolderPath = defaultDownloadPath;
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    }
  } catch (e) {
    // If settings file is corrupted, recreate with defaults
    const initialSettings = {
      downloadFolderPath: defaultDownloadPath,
    };
    fs.writeFileSync(settingsFilePath, JSON.stringify(initialSettings, null, 2));
  }
}

// window API - запрос настроек пользователя
electron.ipcMain.handle("yandexMusicMod.getStorageValue", (_ev, key) => {
  const settings = fs.readFileSync(settingsFilePath, "utf8") || "{}";
  const parsed = JSON.parse(settings);
  return parsed[key] !== undefined ? parsed[key] : null;
});

// window API - установка настроек пользователя
electron.ipcMain.on("yandexMusicMod.setStorageValue", (_ev, key, value) => {
  const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
  settings[key] = value;
  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));

  electron.BrowserWindow.getAllWindows().forEach((window) =>
    window.webContents.send("yandexMusicMod.storageValueUpdated", key, value),
  );
});

// window API - выбор папки для загрузки треков
electron.ipcMain.handle("yandexMusicMod.selectDownloadFolder", async (_ev) => {
  const result = await electron.dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Выберите папку для загрузки треков",
  });

  if (result.canceled || !result.filePaths.length) {
    return { success: false, path: null };
  }

  return { success: true, path: result.filePaths[0] };
});

// window API - выбор файла для кастомного фона (видео или картинка)
electron.ipcMain.handle("yandexMusicMod.selectBackgroundFile", async (_ev) => {
  const result = await electron.dialog.showOpenDialog({
    properties: ["openFile"],
    title: "Выберите видео или изображение для фона",
    filters: [
      { name: "Медиафайлы (Видео / Изображения)", extensions: ["mp4", "webm", "mkv", "mov", "png", "jpg", "jpeg", "webp", "gif"] },
      { name: "Видео (*.mp4, *.webm, *.mkv, *.mov)", extensions: ["mp4", "webm", "mkv", "mov"] },
      { name: "Изображения (*.png, *.jpg, *.jpeg, *.webp, *.gif)", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
      { name: "Все файлы (*.*)", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePaths.length) {
    return { success: false, path: null };
  }

  return { success: true, path: result.filePaths[0] };
});

// window API - чтение локального файла в Base64 Data URL (гарантирует 100% работу картинок без CORS/file:// ограничений)
electron.ipcMain.handle("yandexMusicMod.readFileAsDataUrl", async (_ev, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: "File not found" };
    }
    const stat = fs.statSync(filePath);
    if (stat.size > 25 * 1024 * 1024) {
      return { success: false, error: "File is too large for Data URL (>25MB), use media server" };
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".bmp": "image/bmp",
      ".ico": "image/x-icon",
    };
    const mime = mimeTypes[ext] || "application/octet-stream";
    const data = fs.readFileSync(filePath);
    return { success: true, dataUrl: `data:${mime};base64,${data.toString("base64")}` };
  } catch (err) {
    console.error("[MediaServer] Error reading file as data URL:", err);
    return { success: false, error: err.message };
  }
});

// Локальный HTTP сервер для стриминга видео и медиа фона без ограничений браузера
let mediaServerPort = 0;
const mediaServer = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  if (parsedUrl.pathname === "/media") {
    const filePath = parsedUrl.query.file;
    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("File not found");
      return;
    }

    try {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const ext = path.extname(filePath).toLowerCase();

      const mimeTypes = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mkv": "video/x-matroska",
        ".mov": "video/quicktime",
        ".ogv": "video/ogg",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
      };
      const contentType = mimeTypes[ext] || "application/octet-stream";

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize) {
          res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
          res.end();
          return;
        }

        const chunksize = end - start + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          "Content-Length": fileSize,
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
          "Access-Control-Allow-Origin": "*",
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err) {
      console.error("[MediaServer] Error streaming file:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

mediaServer.listen(0, "127.0.0.1", () => {
  mediaServerPort = mediaServer.address().port;
  console.log(`[MediaServer] Custom background media server listening on 127.0.0.1:${mediaServerPort}`);
});

electron.ipcMain.handle("yandexMusicMod.getMediaServerPort", () => {
  return mediaServerPort;
});

// Автоматическое повышение качества обложек и баннеров до максимального разрешения
try {
  const registerHighResImages = () => {
    try {
      electron.session.defaultSession.webRequest.onBeforeRequest(
        { urls: ["*://avatars.mds.yandex.net/get-music-*/*"] },
        (details, callback) => {
          if (details.url.endsWith("/200x200") || details.url.endsWith("/400x400")) {
            const highResUrl = details.url.replace(/\/(200x200|400x400)$/, "/1000x1000");
            return callback({ redirectURL: highResUrl });
          }
          callback({});
        },
      );
    } catch (err) {}
  };

  if (electron.app.isReady()) {
    registerHighResImages();
  } else {
    electron.app.whenReady().then(registerHighResImages);
  }
} catch (e) {
  console.warn("[HighResImages] Failed to init high-res images interceptor:", e);
}

// Intercept headers to provide CORS headers for audio streaming and custom media
try {
  const registerCorsHeaders = () => {
    try {
      electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = details.responseHeaders || {};
        responseHeaders["Access-Control-Allow-Origin"] = ["*"];
        responseHeaders["Access-Control-Allow-Headers"] = ["*"];
        responseHeaders["Access-Control-Allow-Methods"] = ["GET, POST, OPTIONS, HEAD"];
        callback({ responseHeaders });
      });
    } catch (err) {
      console.warn("[CORS] Failed to register onHeadersReceived:", err);
    }
  };

  if (electron.app.isReady()) {
    registerCorsHeaders();
  } else {
    electron.app.whenReady().then(registerCorsHeaders);
  }
} catch (e) {
  console.warn("[CORS] Failed to init CORS headers interceptor:", e);
}

// window API - открытие папки для загрузки треков
electron.ipcMain.handle("yandexMusicMod.openFolder", async (_ev, folderPath) => {
  try {
    await electron.shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    console.error("Failed to open folder:", error);
    return { success: false, error: error.message };
  }
});

// window API - загрузка трека
electron.ipcMain.handle(
  "yandexMusicMod.downloadTrack",
  async (_ev, downloadInfo, trackMeta, customDownloadPath = null) => {
    console.log("Backend get download request: ", downloadInfo.url);

    let saveFolder;
    if (process.platform === "win32") {
      saveFolder = process.env.USERPROFILE + "\\YandexMod Download";
    } else {
      saveFolder = (process.env.HOME || process.env.USERPROFILE) + "/YandexMod Download";
    }

    if (customDownloadPath) {
      saveFolder = customDownloadPath;
    } else {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
        saveFolder = settings.downloadFolderPath || saveFolder;
      } catch (e) {
        console.error("Failed to parse settings:", e);
      }
    }

    if (!fs.existsSync(saveFolder)) {
      fs.mkdirSync(saveFolder, { recursive: true });
    }

    // Generate filename from trackMeta or use default
    const fileExtension = downloadInfo.codec.includes("flac") ? "flac" : "mp3";
    const trackFileName = sanitize(
      `${trackMeta.artists.map((a) => a.name).join(", ")} - ${trackMeta.title} ${trackMeta.version || ""}`,
    )
      .trim()
      .substring(0, 250);
    const trackFilePath = path.join(saveFolder, `${trackFileName}.${fileExtension}`);
    const trackTempFilePath = path.join(saveFolder, `${Math.random().toString(36).substring(2, 7)}.${fileExtension}`);
    const trackCoverPath = path.join(saveFolder, `${trackFileName}.jpg`);

    try {
      // Download file using axios with arraybuffer response type
      const response = await axios.get(downloadInfo.url, {
        responseType: "arraybuffer",
        validateStatus: () => true, // Following neverthrow integration pattern
      });

      if (response.status !== 200) {
        console.error(`Download failed with status: ${response.status}`);
        return { ok: false, error: "Download failed" };
      }

      // Decrypt the data using the decryptYandexAudio function
      const decryptedData = await decryptYandexAudio(response.data, downloadInfo.key);

      // Write decrypted data to file synchronously/awaited
      await fs.promises.writeFile(trackFilePath, Buffer.from(decryptedData));
      console.log("Download and Decryption Completed");

      // 2. Copy/reencode audio using direct ffmpeg command
      await new Promise((resolve, reject) => {
        const ffmpegArgs = ["-i", JSON.stringify(trackFilePath), "-y", JSON.stringify(trackTempFilePath)];
        const command = `${JSON.stringify(pathToFfmpeg)} ${ffmpegArgs.join(" ")}`;

        console.log("Executing FFmpeg command:", command);

        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error("FFmpeg stderr:", stderr);
            console.error("FFmpeg error:", error);
            reject(new Error(`FFmpeg process failed. Command: ${command}. Error: ${error.message}`));
          } else {
            resolve();
          }
        });
      });

      // Build ffmpeg arguments for adding metadata and cover
      const ffmpegArgs = ["-i", JSON.stringify(trackTempFilePath)];

      // === Download cover art ===
      if (trackMeta.coverUri) {
        try {
          const url = `https://${trackMeta.coverUri.replaceAll("%%", "orig")}`;
          const coverResponse = await axios.get(url, { responseType: "arraybuffer" });
          fs.writeFileSync(trackCoverPath, coverResponse.data);

          ffmpegArgs.push("-i", JSON.stringify(trackCoverPath));
          ffmpegArgs.push("-map", "0:a", "-map", "1:v", "-y");
        } catch (err) {
          console.warn("Failed to download cover art:", err);
        }
      }

      // Add metadata
      ffmpegArgs.push("-c", "copy");
      ffmpegArgs.push("-id3v2_version", "3");

      if (trackMeta.title) {
        ffmpegArgs.push("-metadata", JSON.stringify(`title=${trackMeta.title}`));
      }
      if (trackMeta.version) {
        ffmpegArgs.push("-metadata", JSON.stringify(`subtitle=${trackMeta.version}`));
      }
      if (trackMeta.artists && trackMeta.artists.length > 0) {
        ffmpegArgs.push("-metadata", JSON.stringify(`artist=${trackMeta.artists.map((a) => a.name).join("/")}`));
      }
      if (trackMeta.albums?.[0]?.title) {
        ffmpegArgs.push("-metadata", JSON.stringify(`album=${trackMeta.albums[0].title}`));
      }
      if (trackMeta.albums?.[0]?.genre) {
        ffmpegArgs.push("-metadata", JSON.stringify(`genre=${trackMeta.albums[0].genre}`));
      }
      if (trackMeta.albums?.[0]?.trackPosition?.index) {
        ffmpegArgs.push("-metadata", JSON.stringify(`track=${trackMeta.albums[0].trackPosition.index}`));
      }
      if (trackMeta.albums?.[0]?.year) {
        ffmpegArgs.push("-metadata", JSON.stringify(`date=${trackMeta.albums[0].year}`));
      }
      if (trackMeta.albums?.[0]?.releaseDate) {
        ffmpegArgs.push("-metadata", JSON.stringify(`releaseDate=${trackMeta.albums[0].releaseDate}`));
      }
      ffmpegArgs.push("-metadata", JSON.stringify("encoded_by=yandexMusicMod"));

      ffmpegArgs.push(JSON.stringify(trackFilePath));

      console.log("ffmpegArgs", ffmpegArgs);

      // Execute ffmpeg command to add metadata and cover
      await new Promise((resolve, reject) => {
        const command = `${JSON.stringify(pathToFfmpeg)} ${ffmpegArgs.join(" ")}`;

        console.log("Executing FFmpeg metadata command:", command);

        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error("FFmpeg metadata stderr:", stderr);
            console.error("FFmpeg metadata error:", error);
            reject(new Error(`FFmpeg metadata process failed. Command: ${command}. Error: ${error.message}`));
          } else {
            // Clean up temporary files
            if (fs.existsSync(trackTempFilePath)) {
              fs.unlinkSync(trackTempFilePath);
            }

            resolve();
          }
        });

        console.log("Download completed.");
      });
    } catch (err) {
      console.error("Download or decryption failed:", err);
      return { ok: false, error: "Download or decryption failed: " + err };
    }

    return { ok: true };
  },
);

// window API - открытие папки для загрузки треков
electron.ipcMain.on("yandexMusicMod.openDownloadDirectory", async (_ev) => {
  let saveFolder;
  if (process.platform === "win32") {
    saveFolder = process.env.USERPROFILE + "\\YandexMod Download";
  } else {
    saveFolder = (process.env.HOME || process.env.USERPROFILE) + "/YandexMod Download";
  }

  try {
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    saveFolder = settings.downloadFolderPath || saveFolder;
  } catch (e) {
    console.log("failed to parse settings", e);
  }

  await electron.shell.openPath(saveFolder);
});

// window API - универсальный axios запрос
electron.ipcMain.handle("yandexMusicMod.axios", async (_ev, config) => {
  const client = axios.create({
    validateStatus: () => true,
  });

  const response = await client(config);

  return {
    success: true,
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  };
});

// Функция для расшифровки зашифрованного трека
async function decryptYandexAudio(encryptedData, secretKey) {
  const hexToUint8Array = (hexString) => new Uint8Array(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  const cryptoKey = await crypto.subtle.importKey("raw", hexToUint8Array(secretKey), { name: "AES-CTR" }, false, [
    "encrypt",
    "decrypt",
  ]);

  let counter = new Uint8Array(16);
  return crypto.subtle.decrypt({ name: "AES-CTR", counter, length: 128 }, cryptoKey, encryptedData);
}

// Discord RPC (из-за того, что main.js не бандлится а просто добавляется в оригинальный index.js, все импорты приходится делать вручную. Строчка ниже просто заменится на содержимое файла src\mod\features\utils\discordRPC.js)
mod_require("discordRPC");

// Регистрация глобальных горячих клавиш для управления треками (Media Keys & Hotkeys)
let lastActionTimestamp = 0;
const ACTION_COOLDOWN_MS = 350;

function dispatchPlayerAction(action) {
  const now = Date.now();
  if (now - lastActionTimestamp < ACTION_COOLDOWN_MS) {
    console.log(`[MediaKeys] Throttled duplicate action: ${action} (${now - lastActionTimestamp}ms since last)`);
    return;
  }
  lastActionTimestamp = now;

  console.log("[MediaKeys] Global action dispatched:", action);

  // В плеере Яндекс Музыки:
  // "MOVE_FORWARD" -> переключение на следующий трек (вызывает controller.moveForward())
  // "MOVE_BACKWARD" -> переключение на предыдущий трек (вызывает controller.moveBackward())
  // "PLAY" или "PAUSE" -> вызывают controller.togglePause()
  const nativeAction = (action === "PLAY_PAUSE" || action === "PAUSE") ? "PLAY" : action;

  electron.BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      try {
        win.webContents.send("desktop:player:action", nativeAction);
      } catch (e) {
        console.error("[MediaKeys] Error dispatching to window:", e);
      }
    }
  });
}

// Прием вызовов управления плеером от UI/рендерера через единую точку входа с кулдауном
electron.ipcMain.on("yandexMusicMod.sendPlayerAction", (_ev, action) => {
  dispatchPlayerAction(action);
});

function registerGlobalMediaShortcuts() {
  const keyBindings = [
    { keys: ["MediaNextTrack", "CommandOrControl+Alt+Right"], action: "MOVE_FORWARD" },
    { keys: ["MediaPreviousTrack", "CommandOrControl+Alt+Left"], action: "MOVE_BACKWARD" },
    { keys: ["MediaPlayPause", "CommandOrControl+Alt+Space"], action: "PLAY_PAUSE" },
    { keys: ["MediaStop"], action: "PAUSE" },
  ];

  keyBindings.forEach(({ keys, action }) => {
    keys.forEach((key) => {
      try {
        electron.globalShortcut.register(key, () => {
          dispatchPlayerAction(action);
        });
      } catch (err) {
        console.warn(`[MediaKeys] Failed to register shortcut ${key}:`, err);
      }
    });
  });
}

try {
  if (electron.app.isReady()) {
    registerGlobalMediaShortcuts();
  } else {
    electron.app.whenReady().then(registerGlobalMediaShortcuts);
  }
} catch (e) {
  console.error("[MediaKeys] Error initializing media keys:", e);
}

// OSD removed
electron.ipcMain.on('yandexMusicMod.showOsd', () => {});
