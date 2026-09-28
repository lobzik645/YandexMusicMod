import { onYandexApiResponse } from "~/mod/features/utils/utils";

let experimentsOverride: any[] = [];

(async () => {
  const experimentsOverrideValue =
    (await window.yandexMusicMod.getStorageValue("settings/accountExperimentsOverride")) || [];

  console.log("[experimentsOverride] ", experimentsOverrideValue);

  if (experimentsOverrideValue && experimentsOverrideValue.length > 0) {
    experimentsOverride = [...experimentsOverrideValue];
  }
})();

onYandexApiResponse("/account/experiments/details", async function (response: any) {
  console.log(`[experimentsOverride] Original experiments:`, response.data);

  // Clone the original response data
  const modifiedData = { ...(response?.data || {}) };


  // Apply user-defined overrides from settings
  if (experimentsOverride && experimentsOverride.length > 0) {
    experimentsOverride.forEach((override: any) => {
      if (override.id) {
        console.log(`[experimentsOverride] Applying experiment ${override.id}:`, override.value);
        modifiedData[override.id] = override.value;
      }
    });
  }

  console.log(`[experimentsOverride] Modified experiments:`, modifiedData);
  return modifiedData;
});
