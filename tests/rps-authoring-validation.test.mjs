import assert from "node:assert/strict";
import test from "node:test";
import {
  rpsAuthoringExample,
  rpsPolicyExample,
  validateRpsDraft,
} from "../src/lib/mvp/rps-authoring.ts";

function cloneDraft() {
  return structuredClone(rpsAuthoringExample);
}

test("the Level 2 example passes every deterministic authoring rule", () => {
  const results = validateRpsDraft(rpsAuthoringExample, rpsPolicyExample);

  assert.equal(results.length, 8);
  assert.deepEqual(results.filter(({ status }) => status !== "passed"), []);
});

test("assessment totals and unknown mappings fail closed", () => {
  const draft = cloneDraft();
  draft.assessments[0].weight = 19;
  draft.assessments[1].subCpmkCodes = ["Sub-CPMK-TIDAK-ADA"];

  const results = validateRpsDraft(draft, rpsPolicyExample);

  assert.equal(results.find(({ id }) => id === "assessment-weight")?.status, "blocked");
  assert.equal(results.find(({ id }) => id === "relationships")?.status, "blocked");
});

test("meeting count follows the effective policy and requires contiguous ordinals", () => {
  const draft = cloneDraft();
  draft.weeklyPlan[15].week = 17;

  assert.equal(
    validateRpsDraft(draft, rpsPolicyExample).find(({ id }) => id === "weekly-plan")?.status,
    "blocked",
  );

  const twelveMeetingPolicy = { ...rpsPolicyExample, expectedMeetingCount: 12 };
  draft.weeklyPlan = draft.weeklyPlan.slice(0, 12);
  assert.equal(
    validateRpsDraft(draft, twelveMeetingPolicy).find(({ id }) => id === "weekly-plan")?.status,
    "passed",
  );
});

test("approval separation uses stable actor IDs, not names or personal attributes", () => {
  const draft = cloneDraft();
  draft.approvals[2].actorId = draft.approvals[0].actorId;

  assert.equal(
    validateRpsDraft(draft, rpsPolicyExample).find(({ id }) => id === "approval-boundary")?.status,
    "blocked",
  );
});
