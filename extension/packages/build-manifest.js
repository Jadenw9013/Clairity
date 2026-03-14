import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.resolve(__dirname, "../public/manifest.json");
const distManifestPath = path.resolve(__dirname, "../dist/manifest.json");

console.log("Building production manifest...");

try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    // Remove localhost from production host_permissions
    if (manifest.host_permissions) {
        manifest.host_permissions = manifest.host_permissions.filter(
            (url) => !url.includes("localhost")
        );
    }

    // Ensure content security policy is tight
    if (!manifest.content_security_policy) {
        manifest.content_security_policy = {
            extension_pages: "script-src 'self'; object-src 'none'"
        };
    }

    // Write out to dist
    if (!fs.existsSync(path.dirname(distManifestPath))) {
        fs.mkdirSync(path.dirname(distManifestPath), { recursive: true });
    }
    fs.writeFileSync(distManifestPath, JSON.stringify(manifest, null, 2));

    console.log("Production manifest written successfully.");
} catch (err) {
    console.error("Failed to build production manifest:", err);
    process.exit(1);
}
