const fs = require("fs");
const path = require("path");
const asar = require("asar");
const os = require("os");

const asarPath = "C:/Users/7ims (admin)/AppData/Local/Programs/YandexMusicMod/resources/app.asar";
const projectRoot = "c:/Users/7ims (admin)/Downloads/яндекс/YandexMusicLiberty-master";
const modDistDir = path.join(projectRoot, "src/mod/dist");

if (!fs.existsSync(asarPath)) {
  console.error("app.asar not found at:", asarPath);
  process.exit(1);
}

const tempExtractDir = path.join(os.tmpdir(), "ym_asar_update_" + Date.now());
console.log("Extracting asar to:", tempExtractDir);

try {
  asar.extractAll(asarPath, tempExtractDir);
  console.log("Extracted successfully.");

  const targetModDir = path.join(tempExtractDir, "app", "yandexMusicMod");
  fs.mkdirSync(targetModDir, { recursive: true });

  // Copy dist files
  fs.cpSync(modDistDir, targetModDir, { recursive: true });
  console.log("Copied dist files.");

  // Wrap renderer.js if needed
  const rendererPath = path.join(targetModDir, "renderer.js");
  if (fs.existsSync(rendererPath)) {
    let content = fs.readFileSync(rendererPath, "utf8");
    if (!content.startsWith("(function ()")) {
      content = `(function () {\n${content}\n})()`;
      fs.writeFileSync(rendererPath, content, "utf8");
      console.log("Wrapped renderer.js.");
    }
  }

  // Backup original asar
  const backupPath = asarPath + ".bak";
  fs.copyFileSync(asarPath, backupPath);

  // Repack asar
  console.log("Repacking asar...");
  asar.createPackage(tempExtractDir, asarPath).then(() => {
    console.log("Successfully updated installed app.asar!");
    try {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      fs.rmSync(backupPath, { force: true });
    } catch (e) {}
  }).catch((err) => {
    console.error("Failed to pack asar:", err);
    fs.copyFileSync(backupPath, asarPath);
  });
} catch (e) {
  console.error("Error updating asar:", e);
}
