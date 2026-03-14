import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const zip = new AdmZip();
const distPath = path.resolve(__dirname, "../dist");
const releasePath = path.resolve(__dirname, "../../release");
const zipPath = path.join(releasePath, "clairity.zip");

if (!fs.existsSync(distPath)) {
    console.error("Dist directory not found. Did you run the build step?");
    process.exit(1);
}

if (!fs.existsSync(releasePath)) {
    fs.mkdirSync(releasePath, { recursive: true });
}

// Add all contents of the compiled extension to the zip
zip.addLocalFolder(distPath);

// Write to release/clairity.zip
try {
    zip.writeZip(zipPath);
    console.log(`Successfully packaged extension to: ${zipPath}`);
} catch (err) {
    console.error("Failed to write zip file:", err);
    process.exit(1);
}
