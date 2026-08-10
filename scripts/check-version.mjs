import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const tauriConfig = JSON.parse(
  await readFile(new URL("src-tauri/tauri.conf.json", root), "utf8"),
);
const cargoToml = await readFile(new URL("src-tauri/Cargo.toml", root), "utf8");
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

const versions = {
  "package.json": packageJson.version,
  "src-tauri/tauri.conf.json": tauriConfig.version,
  "src-tauri/Cargo.toml": cargoVersion,
};
const uniqueVersions = new Set(Object.values(versions));

if (uniqueVersions.size !== 1 || uniqueVersions.has(undefined)) {
  console.error("Las versiones de la aplicación no coinciden:", versions);
  process.exit(1);
}

const [version] = uniqueVersions;
const releaseTag = process.env.RELEASE_TAG?.trim();

if (releaseTag && releaseTag !== `v${version}`) {
  console.error(`El tag ${releaseTag} no coincide con la versión v${version}.`);
  process.exit(1);
}

console.log(`Versión consistente: ${version}`);
