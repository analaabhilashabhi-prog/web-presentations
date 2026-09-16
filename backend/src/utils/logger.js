const stamp = () => new Date().toISOString().slice(11, 19);

export const logger = {
  info: (...args) => console.log(`[${stamp()}]`, ...args),
  warn: (...args) => console.warn(`[${stamp()}] warn`, ...args),
  error: (...args) => console.error(`[${stamp()}] error`, ...args),
};
