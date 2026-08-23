const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateIfUndipSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("IF UNDIP snapshot must be an object.");
  }

  const lecturers = Array.isArray(snapshot.lecturers) ? snapshot.lecturers : [];
  const courses = Array.isArray(snapshot.curriculum?.courses)
    ? snapshot.curriculum.courses
    : [];
  const outcomes = Array.isArray(snapshot.graduate_outcomes)
    ? snapshot.graduate_outcomes
    : [];
  const homebase = lecturers.filter((lecturer) => lecturer.group === "homebase");
  const teachingLecturers = lecturers.filter(
    (lecturer) => lecturer.group === "teaching_lecturer",
  );

  if (
    lecturers.length !== 36 ||
    homebase.length !== 30 ||
    teachingLecturers.length !== 6
  ) {
    throw new Error("IF UNDIP snapshot must contain 30 homebase and 6 teaching lecturers.");
  }
  if (courses.length !== 83) {
    throw new Error("IF UNDIP 2024 OBE snapshot must contain 83 course codes.");
  }
  if (outcomes.length !== 12) {
    throw new Error("IF UNDIP snapshot must contain 12 graduate outcomes.");
  }

  assertUnique(lecturers.map((lecturer) => lecturer.external_id), "lecturer external IDs");
  assertUnique(courses.map((course) => course.code), "course codes");
  assertUnique(outcomes.map((outcome) => outcome.internal_id), "graduate outcome IDs");

  for (const lecturer of lecturers) {
    if (typeof lecturer.external_id !== "string" || !lecturer.external_id.trim()) {
      throw new Error("Every lecturer external ID must be a non-empty string.");
    }
    if (!["homebase", "teaching_lecturer"].includes(lecturer.group)) {
      throw new Error(`Lecturer ${lecturer.external_id} has an invalid group.`);
    }
    if (!["verified", "needs_review"].includes(lecturer.verification_status)) {
      throw new Error(`Lecturer ${lecturer.external_id} has an invalid verification status.`);
    }
    if (!lecturer.name || !lecturer.expertise) {
      throw new Error(`Lecturer ${lecturer.external_id} is missing a name or expertise.`);
    }
    if (!["published_unconfirmed", "not_found"].includes(lecturer.email_status)) {
      throw new Error(`Lecturer ${lecturer.external_id} has an invalid email status.`);
    }
    if (lecturer.email_status === "published_unconfirmed") {
      if (!EMAIL_PATTERN.test(lecturer.institutional_email ?? "")) {
        throw new Error(`Lecturer ${lecturer.external_id} has an invalid published email.`);
      }
      if (!lecturer.email_source_url?.startsWith("https://")) {
        throw new Error(`Lecturer ${lecturer.external_id} is missing an email source URL.`);
      }
    } else if (lecturer.institutional_email !== null) {
      throw new Error(`Lecturer ${lecturer.external_id} must keep an unavailable email null.`);
    }
  }

  if (snapshot.curriculum?.version !== "2024 OBE") {
    throw new Error("The course snapshot must identify the 2024 OBE curriculum.");
  }

  for (const course of courses) {
    if (
      !course.code ||
      !course.name ||
      !Number.isFinite(course.credits) ||
      course.credits <= 0 ||
      course.credits > 10
    ) {
      throw new Error("Every course must include a code, name, and numeric credits.");
    }
    if (!["required", "elective"].includes(course.requirement)) {
      throw new Error(`Course ${course.code} has an invalid requirement type.`);
    }
    if (
      course.requirement === "required" &&
      (!Number.isInteger(course.semester) || course.semester < 1 || course.semester > 8)
    ) {
      throw new Error(`Required course ${course.code} must include an integer semester.`);
    }
    if (course.requirement === "elective" && !["odd", "even"].includes(course.term)) {
      throw new Error(`Elective course ${course.code} must include an odd/even term.`);
    }
  }

  const required = courses.filter((course) => course.requirement === "required");
  const oddElectives = courses.filter(
    (course) => course.requirement === "elective" && course.term === "odd",
  );
  const evenElectives = courses.filter(
    (course) => course.requirement === "elective" && course.term === "even",
  );
  const religionAlternatives = required.filter(
    (course) => course.alternative_group === "religion",
  );
  if (
    required.length !== 53 ||
    oddElectives.length !== 12 ||
    evenElectives.length !== 18 ||
    religionAlternatives.length !== 7
  ) {
    throw new Error("The 2024 OBE catalog must preserve its 53/12/18 course split.");
  }

  const graduateOutcomeSource = snapshot.sources?.find(
    (source) => source.kind === "graduate_outcomes",
  );
  if (graduateOutcomeSource?.source_declared_curriculum_year !== 2022) {
    throw new Error("The graduate-outcome source must retain its declared 2022 curriculum year.");
  }

  for (const [index, outcome] of outcomes.entries()) {
    const expectedId = `CPL-${String(index + 1).padStart(2, "0")}`;
    if (outcome.internal_id !== expectedId || outcome.source_order !== index + 1) {
      throw new Error(`Graduate outcome ${index + 1} must use internal ID ${expectedId}.`);
    }
    if (!outcome.statement?.trim()) {
      throw new Error(`${expectedId} must include a statement.`);
    }
  }

  const unavailable = [
    "lecturer_course_assignments",
    "course_graduate_outcome_mappings",
    "course_learning_outcomes",
    "course_learning_outcome_mappings",
  ];
  for (const key of unavailable) {
    if (snapshot.availability?.[key] !== "not_published") {
      throw new Error(`${key} must remain marked not_published until an authoritative source is supplied.`);
    }
  }

  return { lecturers, homebase, teachingLecturers, courses, outcomes };
}

export function parseLecturerEmailMap(input, lecturers, allowedDomainSuffix = "undip.ac.id") {
  let parsed = {};
  if (input) {
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new Error("LECTURER_EMAIL_MAP_JSON must contain valid JSON.");
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("LECTURER_EMAIL_MAP_JSON must be a JSON object.");
  }

  const expectedIds = new Set(lecturers.map((lecturer) => lecturer.external_id));
  const actualIds = Object.keys(parsed);
  const unknownIds = actualIds.filter((externalId) => !expectedIds.has(externalId));

  if (unknownIds.length) {
    throw new Error(
      `Lecturer email map contains ${unknownIds.length} unknown NIP values.`,
    );
  }

  const normalized = new Map();
  const seenEmails = new Set();
  const suffix = allowedDomainSuffix.trim().toLowerCase().replace(/^@/, "");
  if (!suffix) {
    throw new Error("LECTURER_ALLOWED_EMAIL_DOMAIN_SUFFIX must not be empty.");
  }
  const missingIds = [];

  for (const lecturer of lecturers) {
    const candidate =
      parsed[lecturer.external_id] ?? lecturer.institutional_email ?? "";
    const email = String(candidate).trim().toLowerCase();
    if (!email) {
      missingIds.push(lecturer.external_id);
      continue;
    }
    if (!EMAIL_PATTERN.test(email)) {
      throw new Error(`Verified email for NIP ${lecturer.external_id} is invalid.`);
    }
    const domain = email.split("@")[1];
    if (domain !== suffix && !domain.endsWith(`.${suffix}`)) {
      throw new Error(`Verified email for NIP ${lecturer.external_id} is outside ${suffix}.`);
    }
    if (seenEmails.has(email)) {
      throw new Error("Every lecturer must have a unique verified email.");
    }
    seenEmails.add(email);
    normalized.set(lecturer.external_id, email);
  }

  if (missingIds.length) {
    throw new Error(
      `Lecturer email map is incomplete; verified institutional emails are still required for NIP: ${missingIds.join(", ")}.`,
    );
  }

  return normalized;
}

export function validateLecturerInitialPassword(input) {
  if (!input) throw new Error("LECTURER_INITIAL_PASSWORD is required in apply mode.");
  if (input.length < 12 || input.length > 128) {
    throw new Error("LECTURER_INITIAL_PASSWORD must contain 12 to 128 characters.");
  }
  if (input !== input.trim()) {
    throw new Error("LECTURER_INITIAL_PASSWORD must not start or end with whitespace.");
  }
  if (/[^\x20-\x7e]/.test(input)) {
    throw new Error("LECTURER_INITIAL_PASSWORD must contain printable ASCII characters only.");
  }
  if (!/[a-z]/.test(input) || !/[A-Z]/.test(input) || !/\d/.test(input) || !/[^A-Za-z0-9]/.test(input)) {
    throw new Error("LECTURER_INITIAL_PASSWORD must include upper, lower, number, and symbol characters.");
  }
  return input;
}

export function buildLecturerSeedPlan(lecturers, emailMap) {
  return lecturers.map((lecturer) => ({
    externalId: lecturer.external_id,
    displayName: lecturer.name,
    email: emailMap.get(lecturer.external_id),
    lecturerGroup: lecturer.group,
    source: "if-undip-public-snapshot",
  }));
}

export function findExistingLecturerUser(users, account) {
  const sourceMatches = users.filter(
    (user) =>
      user.app_metadata?.source_system === account.source &&
      user.app_metadata?.source_external_id === account.externalId,
  );
  const emailMatches = users.filter(
    (user) => user.email?.trim().toLowerCase() === account.email,
  );

  if (sourceMatches.length > 1 || emailMatches.length > 1) {
    throw new Error("Duplicate existing identities require manual reconciliation.");
  }

  const sourceUser = sourceMatches[0];
  const emailUser = emailMatches[0];
  if (sourceUser && emailUser && sourceUser.id !== emailUser.id) {
    throw new Error("The lecturer source identity and verified email belong to different accounts.");
  }
  if (sourceUser && sourceUser.email?.trim().toLowerCase() !== account.email) {
    if (sourceUser.app_metadata?.onboarding_required !== true) {
      throw new Error("An activated lecturer identity has a different email and requires manual review.");
    }
  }
  if (emailUser && !sourceUser) {
    throw new Error("A verified email is already owned by a non-matching account.");
  }
  return sourceUser ?? null;
}

function assertUnique(values, label) {
  if (values.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error(`All ${label} must be non-empty strings.`);
  }
  if (new Set(values).size !== values.length) {
    throw new Error(`All ${label} must be unique.`);
  }
}
