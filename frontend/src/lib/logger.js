/**
 * Lightweight client logger. Suppresses debug/info noise in production.
 */

const isProd = process.env.NODE_ENV === "production";

function emit(level, args) {
  if (isProd && (level === "debug" || level === "info")) return;
  // eslint-disable-next-line no-console
  const fn = console[level] || console.log;
  fn(`[skilleraa]`, ...args);
}

export const logger = {
  debug: (...args) => emit("debug", args),
  info: (...args) => emit("info", args),
  warn: (...args) => emit("warn", args),
  error: (...args) => emit("error", args),
};

export default logger;
