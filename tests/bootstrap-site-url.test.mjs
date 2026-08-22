import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProductionSiteUrl } from "../scripts/site-url.mjs";

test("adds HTTPS when the scheme is omitted", () => {
  assert.equal(
    normalizeProductionSiteUrl("obeliks-new.vercel.app").toString(),
    "https://obeliks-new.vercel.app/",
  );
});

test("removes paths, queries, and fragments", () => {
  assert.equal(
    normalizeProductionSiteUrl("https://obeliks-new.vercel.app/admin?q=1#top").toString(),
    "https://obeliks-new.vercel.app/",
  );
});

test("rejects insecure and malformed values", () => {
  assert.throws(() => normalizeProductionSiteUrl("http://obeliks-new.vercel.app"), /HTTPS/);
  assert.throws(() => normalizeProductionSiteUrl("salah"), /public production domain/);
});
