export function normalizeLogin(value: string) {
  return value.trim().toLowerCase();
}

export function isLogin(value: string) {
  return /^\S{2,80}$/.test(value);
}
