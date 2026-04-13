export function isServerPersistenceDisabled() {
  return process.env.VERCEL === "1";
}
