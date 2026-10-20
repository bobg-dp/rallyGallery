import packageJson from "../../package.json";

export function appVersion() {
  const fromEnv = process.env.APP_VERSION?.trim();
  if (fromEnv) return fromEnv;
  return packageJson.version;
}
