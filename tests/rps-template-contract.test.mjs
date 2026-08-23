import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(testDirectory, "..");
const manifestPath = join(
  repositoryRoot,
  "src/lib/rps/template-manifest.json",
);

async function loadContract() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const publicPath = join(repositoryRoot, "public", manifest.publicHref);

  return {
    file: await readFile(publicPath),
    manifest,
    publicPath,
  };
}

test("the public DOCX matches the immutable source contract", async () => {
  const { file, manifest, publicPath } = await loadContract();
  const digest = createHash("sha256").update(file).digest("hex");

  assert.equal(basename(publicPath), manifest.sourceFileName);
  assert.equal(file.byteLength, manifest.fileSizeBytes);
  assert.equal(digest, manifest.sha256);
  assert.deepEqual([...file.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.equal(manifest.sourceIntegrity.preservedByteForByte, true);
  assert.equal(manifest.sourceIntegrity.containsMacros, false);
  assert.equal(manifest.sourceIntegrity.usesContentControls, false);
  assert.equal(manifest.sourceIntegrity.inputModel, "table-placeholders");
  assert.equal(manifest.tableCount, 22);
  assert.deepEqual(manifest.derivedTableNumbers, [8, 9, 10, 11, 12, 13, 17, 18]);
});

test("workflow and document sections have unique, contiguous order", async () => {
  const { manifest } = await loadContract();

  for (const collection of [manifest.workflowSteps, manifest.sections]) {
    assert.deepEqual(
      collection.map(({ order }) => order),
      collection.map((_, index) => index + 1),
    );
    assert.equal(new Set(collection.map(({ id }) => id)).size, collection.length);
  }

  const workflowIds = new Set(manifest.workflowSteps.map(({ id }) => id));
  for (const section of manifest.sections) {
    assert.ok(workflowIds.has(section.workflowStepId));
    assert.ok(section.requiredFields.length > 0);
  }
});

test("validation gates are deterministic and reference valid sections and policies", async () => {
  const { manifest } = await loadContract();
  const sectionIds = new Set(manifest.sections.map(({ id }) => id));
  const policyIds = new Set(manifest.policyDependencies.map(({ id }) => id));
  const ruleIds = new Set(manifest.validationRules.map(({ id }) => id));

  assert.equal(ruleIds.size, manifest.validationRules.length);
  assert.deepEqual(
    [
      "entity-keys-unique",
      "foreign-keys-resolve",
      "assessment-weight-total-100",
      "approval-order-valid",
      "no-self-approval",
    ].filter((ruleId) => !ruleIds.has(ruleId)),
    [],
  );

  for (const rule of manifest.validationRules) {
    assert.equal(rule.deterministic, true);
    assert.equal(rule.blocksTransition, true);
    assert.ok(
      ["submit-for-review", "publish-rps", "close-evaluation"].includes(
        rule.transition,
      ),
    );
    assert.ok(rule.evidence.length > 0);
    for (const sectionId of rule.sectionIds) {
      assert.ok(sectionIds.has(sectionId), `${rule.id}: unknown section ${sectionId}`);
    }
    if (rule.policyDependencyId) {
      assert.ok(policyIds.has(rule.policyDependencyId));
    }
  }

  assert.equal(
    manifest.validationRules.find(({ id }) => id === "approval-order-valid")
      .transition,
    "publish-rps",
  );
  assert.equal(
    manifest.validationRules.find(
      ({ id }) => id === "evaluation-required-fields-complete",
    ).transition,
    "close-evaluation",
  );
});

test("period-sensitive values have no universal default", async () => {
  const { manifest } = await loadContract();

  for (const policy of manifest.policyDependencies) {
    assert.equal(policy.hasUniversalDefault, false);
    assert.ok(policy.requiredFields.includes("effectiveFrom"));
    assert.ok(policy.requiredFields.includes("effectiveUntil"));
  }

  assert.equal(manifest.neutralityPolicy.universalMeetingCount, null);
  assert.equal(manifest.neutralityPolicy.universalAssessmentMilestones, null);
  assert.equal(manifest.neutralityPolicy.universalAttainmentThreshold, null);
});

test("neutrality and human-decision boundaries are explicit", async () => {
  const { manifest } = await loadContract();
  const policy = manifest.neutralityPolicy;

  assert.equal(policy.validationMode, "deterministic-structure-only");
  assert.ok(policy.prohibitedPersonalAttributes.length > 0);
  assert.equal(policy.ai.advisoryOnly, true);
  assert.equal(policy.ai.requiresExplicitHumanAcceptance, true);
  assert.equal(policy.ai.mayApprove, false);
  assert.equal(policy.ai.mayReject, false);
  assert.equal(policy.ai.mayAssignGrades, false);
  assert.equal(policy.humanDecision.authorRole, "dosen");
  assert.equal(policy.humanDecision.reviewerRole, "gpm");
  assert.equal(policy.humanDecision.approverRole, "kaprodi");
  assert.equal(policy.humanDecision.administratorMayApproveAcademicContent, false);
  assert.equal(policy.humanDecision.selfApprovalAllowed, false);
  assert.equal(policy.explanationRequired, true);
});
