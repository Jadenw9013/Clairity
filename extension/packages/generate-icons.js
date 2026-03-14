import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// A simple generic base64 encoded blue square to serve as a placeholder icon
const GENERIC_ICON_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const buffer = Buffer.from(GENERIC_ICON_BASE64, 'base64');

const sizes = [16, 32, 48, 128];
const iconDir = path.join(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
}

sizes.forEach(size => {
    fs.writeFileSync(path.join(iconDir, `icon${size}.png`), buffer);
    console.log(`Generated placeholder icon${size}.png`);
});
