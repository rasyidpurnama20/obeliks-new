import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildLecturerSeedPlan,
  findExistingLecturerUser,
  parseLecturerEmailMap,
  validateIfUndipSnapshot,
  validateLecturerInitialPassword,
} from "../scripts/if-undip-seed-policy.mjs";

const snapshot = JSON.parse(
  await readFile(new URL("../data/if-undip/public-snapshot.json", import.meta.url), "utf8"),
);
const markdown = await readFile(
  new URL("../docs/IF_UNDIP_PUBLIC_DATA.md", import.meta.url),
  "utf8",
);
const missingEmailOverrides = Object.fromEntries(
  snapshot.lecturers
    .filter((lecturer) => lecturer.email_status === "not_found")
    .map((lecturer, index) => [
      lecturer.external_id,
      `verified-missing-${index + 1}@live.undip.ac.id`,
    ]),
);

test("validates the authoritative IF UNDIP snapshot contract", () => {
  const { lecturers, homebase, teachingLecturers, courses, outcomes } =
    validateIfUndipSnapshot(snapshot);

  assert.equal(lecturers.length, 36);
  assert.equal(homebase.length, 30);
  assert.equal(teachingLecturers.length, 6);
  assert.equal(courses.length, 83);
  assert.equal(outcomes.length, 12);
  assert.equal(
    lecturers.filter((lecturer) => lecturer.email_status === "published_unconfirmed").length,
    33,
  );
  assert.equal(
    lecturers.filter((lecturer) => lecturer.email_status === "not_found").length,
    3,
  );
  assert.equal(typeof homebase.find((item) => item.external_id.startsWith("H.7."))?.external_id, "string");
  assert.equal(snapshot.availability.course_learning_outcomes, "not_published");
});

test("preserves the 2024 OBE catalog totals without double-counting religion alternatives", () => {
  const { courses } = validateIfUndipSnapshot(snapshot);
  const required = courses.filter((course) => course.requirement === "required");
  const electives = courses.filter((course) => course.requirement === "elective");
  const religionAlternatives = required.filter((course) => course.alternative_group === "religion");
  const requiredWithoutAlternatives = required.filter((course) => !course.alternative_group);
  const requiredSlotCredits = requiredWithoutAlternatives.reduce(
    (total, course) => total + course.credits,
    religionAlternatives[0].credits,
  );

  assert.equal(required.length, 53);
  assert.equal(electives.length, 30);
  assert.equal(religionAlternatives.length, 7);
  assert.equal(requiredWithoutAlternatives.length + 1, 47);
  assert.equal(requiredSlotCredits, 129);
});

test("merges public evidence with verified overrides for all lecturers", () => {
  const { lecturers } = validateIfUndipSnapshot(snapshot);
  const emailMap = parseLecturerEmailMap(
    JSON.stringify(missingEmailOverrides),
    lecturers,
  );
  const plan = buildLecturerSeedPlan(lecturers, emailMap);

  assert.equal(emailMap.size, 36);
  assert.equal(plan.length, 36);
  assert.equal(plan[0].externalId, lecturers[0].external_id);
  assert.equal(plan[0].email, lecturers[0].institutional_email);
  assert.equal(plan.at(-1).lecturerGroup, "teaching_lecturer");
});

test("fails closed for missing, unknown, duplicate, or non-UNDIP emails", () => {
  const { lecturers } = validateIfUndipSnapshot(snapshot);
  assert.throws(() => parseLecturerEmailMap(undefined, lecturers), /incomplete/);

  assert.throws(
    () => parseLecturerEmailMap(
      JSON.stringify({ ...missingEmailOverrides, unknown: "x@live.undip.ac.id" }),
      lecturers,
    ),
    /unknown/,
  );

  const missingIds = Object.keys(missingEmailOverrides);
  const duplicate = {
    ...missingEmailOverrides,
    [missingIds[0]]: lecturers.find((lecturer) => lecturer.institutional_email)
      .institutional_email,
  };
  assert.throws(() => parseLecturerEmailMap(JSON.stringify(duplicate), lecturers), /unique/);

  const external = { ...missingEmailOverrides, [missingIds[0]]: "lecturer@example.com" };
  assert.throws(() => parseLecturerEmailMap(JSON.stringify(external), lecturers), /outside undip\.ac\.id/);
  assert.throws(
    () => parseLecturerEmailMap(JSON.stringify(missingEmailOverrides), lecturers, ""),
    /must not be empty/,
  );
});

test("accepts a strong initial password and rejects unsafe values", () => {
  assert.equal(validateLecturerInitialPassword("Example.pass123"), "Example.pass123");
  assert.throws(() => validateLecturerInitialPassword("short"), /12 to 128/);
  assert.throws(() => validateLecturerInitialPassword("alllowercase123"), /upper, lower, number, and symbol/);
  assert.throws(() => validateLecturerInitialPassword(" Example.pass123"), /whitespace/);
});

test("resolves existing accounts by both source identity and verified email", () => {
  const { lecturers } = validateIfUndipSnapshot(snapshot);
  const emailMap = parseLecturerEmailMap(
    JSON.stringify(missingEmailOverrides),
    lecturers,
  );
  const [account] = buildLecturerSeedPlan(lecturers, emailMap);
  const matching = {
    id: "matching",
    email: account.email,
    app_metadata: {
      source_system: account.source,
      source_external_id: account.externalId,
    },
  };

  assert.equal(findExistingLecturerUser([matching], account), matching);
  assert.equal(findExistingLecturerUser([], account), null);
  const stagedEmailCorrection = {
    ...matching,
    email: "changed@undip.ac.id",
    app_metadata: { ...matching.app_metadata, onboarding_required: true },
  };
  assert.equal(
    findExistingLecturerUser([stagedEmailCorrection], account),
    stagedEmailCorrection,
  );
  assert.throws(
    () => findExistingLecturerUser([
      {
        ...matching,
        email: "changed@undip.ac.id",
        app_metadata: { ...matching.app_metadata, onboarding_required: false },
      },
    ], account),
    /activated lecturer identity/,
  );
  assert.throws(
    () => findExistingLecturerUser([{ id: "collision", email: account.email, app_metadata: {} }], account),
    /non-matching/,
  );
});

test("keeps every Markdown data row aligned with the JSON snapshot", () => {
  const { lecturers, courses, outcomes } = validateIfUndipSnapshot(snapshot);
  const markdownLines = markdown.split("\n");

  for (const lecturer of lecturers) {
    const group = lecturer.group === "homebase" ? "Homebase" : "Pengampu";
    const verification = lecturer.verification_status === "verified"
      ? "Terverifikasi"
      : "Perlu tinjau: versi Inggris berbeda";
    const profileRow = `| ${group} | ${lecturer.name} | \`${lecturer.external_id}\` | ${lecturer.expertise} | ${verification} |`;
    assert.ok(markdown.includes(profileRow), `Missing lecturer row for ${lecturer.external_id}`);
    const emailRow = markdownLines.find((line) =>
      line.startsWith(`| \`${lecturer.external_id}\` |`),
    );
    assert.ok(emailRow, `Missing email-evidence row for ${lecturer.external_id}`);
    if (lecturer.institutional_email) {
      assert.ok(emailRow.includes(`| \`${lecturer.institutional_email}\` |`));
      assert.ok(emailRow.includes(`](${lecturer.email_source_url})`));
    } else {
      assert.ok(emailRow.includes("| — |"));
    }
  }

  for (const course of courses) {
    const row = course.requirement === "required"
      ? course.alternative_group === "religion"
        ? `| ${course.semester} | \`${course.code}\` | ${course.name} | ${course.credits} | Alternatif agama |`
        : `| ${course.semester} | \`${course.code}\` | ${course.name} | ${course.credits} | |`
      : `| \`${course.code}\` | ${course.name} | ${course.credits} |`;
    assert.ok(markdown.includes(row), `Missing course row for ${course.code}`);
  }
  for (const outcome of outcomes) {
    const row = `| \`${outcome.internal_id}\` | ${outcome.statement} |`;
    assert.ok(markdown.includes(row), `Missing outcome row for ${outcome.internal_id}`);
  }
});
