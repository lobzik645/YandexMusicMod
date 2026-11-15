// ВРЕМЕННЫЙ самотест диагностики (удалить после отладки).
// Логирует в консоль рендера — ловится через --enable-logging=file.

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  try {
    await sleep(9000);
    console.log("[SelfTest] === START ===");
    console.log("[SelfTest] sidebar mount:", !!document.getElementById("yandex-music-mod-sidebar"));
    console.log(
      "[SelfTest] ym API: downloadTrack=",
      typeof (window as any).yandexMusicMod?.downloadTrack,
      "onDownloadProgress=",
      typeof (window as any).yandexMusicMod?.onDownloadProgress,
    );

    const entity = (window as any).pulsesyncApi?.getCurrentTrack?.();
    console.log("[SelfTest] current track:", entity?.id, "-", entity?.entityData?.meta?.title || "?");

    // 1. Клик по «...» в плеер-баре: проверяем структуру меню и наличие нашей кнопки
    const btn = document.querySelector('[data-test-id="PLAYERBAR_DESKTOP_CONTEXT_MENU_BUTTON"]') as HTMLElement | null;
    console.log("[SelfTest] playerbar menu button found:", !!btn);
    if (btn) {
      btn.click();
      await sleep(900);
      const menuIds = Array.from(document.querySelectorAll("[data-test-id]"))
        .map((el) => el.getAttribute("data-test-id"))
        .filter((id) => id && id.toUpperCase().includes("MENU"));
      console.log("[SelfTest] menu test-ids after click:", [...new Set(menuIds)].join(", ") || "(none)");
      const tcMenu = document.querySelector("[data-test-id='TRACK_CONTEXT_MENU']") as HTMLElement | null;
      console.log(
        "[SelfTest] TRACK_CONTEXT_MENU:",
        !!tcMenu,
        "| parentTestId:",
        tcMenu?.parentElement?.getAttribute("data-test-id") || "-",
      );
      console.log(
        "[SelfTest] luna item present:",
        !!document.querySelector("[data-test-id='CONTEXT_MENU_LUNA_DOWNLOAD_BUTTON']"),
      );
      // закрыть меню
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      (document.activeElement as HTMLElement | null)?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }

    // 2. Полный прогон конвейера скачивания: текущий трек -> очередь -> main -> файл
    const dbg = (window as any).__lunaDebug;
    if (dbg && entity?.id && /^\d+$/.test(String(entity.id))) {
      console.log("[SelfTest] enqueue track", String(entity.id));
      const added = dbg.enqueue(
        [{ id: String(entity.id), title: entity?.entityData?.meta?.title || "selftest", artists: [] }],
        "lossless",
        "",
      );
      console.log("[SelfTest] enqueued:", added);
      for (let i = 0; i < 6; i++) {
        await sleep(10000);
        const snap = dbg.snapshot();
        console.log("[SelfTest] queue t+" + (i + 1) * 10 + "s:", JSON.stringify(snap));
        if (snap.length && snap.every((s: any) => ["completed", "error", "cancelled"].includes(s.status))) break;
      }
    } else {
      console.log("[SelfTest] no current track to enqueue (id:", entity?.id, ")");
    }

    console.log("[SelfTest] === END ===");
  } catch (e) {
    console.error("[SelfTest] crashed:", e);
  }
})();
