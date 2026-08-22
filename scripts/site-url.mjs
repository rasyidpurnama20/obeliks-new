export function normalizeProductionSiteUrl(input) {
  const value = input?.trim();
  if (!value) throw new Error("SITE_URL is required.");

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
    ? value
    : `https://${value}`;

  let siteUrl;
  try {
    siteUrl = new URL(candidate);
  } catch {
    throw new Error("SITE_URL must be a valid production domain, for example https://obeliks-new.vercel.app.");
  }

  if (siteUrl.protocol !== "https:") {
    throw new Error("SITE_URL must use HTTPS.");
  }
  if (!siteUrl.hostname.includes(".") || siteUrl.username || siteUrl.password || siteUrl.port) {
    throw new Error("SITE_URL must contain only a public production domain without credentials or port.");
  }

  siteUrl.pathname = "/";
  siteUrl.search = "";
  siteUrl.hash = "";
  return siteUrl;
}
