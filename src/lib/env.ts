export const env = {
  dataDir: process.env.DATA_DIR ?? "./data",
  isProd: process.env.NODE_ENV === "production",
  appVersion: process.env.APP_VERSION ?? "0.4.1",
};
