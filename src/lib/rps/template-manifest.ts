import manifestData from "./template-manifest.json";

export type RpsWorkflowStepId =
  | "identity"
  | "outcomes"
  | "alignment"
  | "assessment"
  | "weekly-plan"
  | "validation";

export interface RpsTemplateSection {
  id: string;
  order: number;
  label: string;
  pageRange: string;
  workflowStepId: RpsWorkflowStepId;
  requiredFields: string[];
}

export interface RpsTemplateValidationRule {
  id: string;
  label: string;
  kind: string;
  sectionIds: string[];
  policyDependencyId?: string;
  policyField?: string;
  transition: "submit-for-review" | "publish-rps" | "close-evaluation";
  deterministic: boolean;
  blocksTransition: boolean;
  evidence: string;
}

export interface RpsTemplateManifest {
  schemaVersion: string;
  id: string;
  displayName: string;
  templateVersion: string;
  sourceFileName: string;
  publicHref: string;
  mimeType: string;
  sha256: string;
  fileSizeBytes: number;
  pageCount: number;
  tableCount: number;
  derivedTableNumbers: number[];
  sourceIntegrity: {
    preservedByteForByte: boolean;
    containsMacros: boolean;
    usesContentControls: boolean;
    inputModel: "table-placeholders";
  };
  workflowSteps: Array<{
    id: RpsWorkflowStepId;
    order: number;
    label: string;
  }>;
  sections: RpsTemplateSection[];
  policyDependencies: Array<{
    id: string;
    scopeKeys: string[];
    requiredFields: string[];
    optionalFields?: string[];
    hasUniversalDefault: boolean;
  }>;
  validationRules: RpsTemplateValidationRule[];
  neutralityPolicy: {
    validationMode: "deterministic-structure-only";
    allowedInputScopes: string[];
    prohibitedPersonalAttributes: string[];
    ai: {
      advisoryOnly: boolean;
      requiresExplicitHumanAcceptance: boolean;
      mayApprove: boolean;
      mayReject: boolean;
      mayAssignGrades: boolean;
      mayChangePolicy: boolean;
    };
    humanDecision: {
      authorRole: "dosen";
      reviewerRole: "gpm";
      approverRole: "kaprodi";
      administratorMayApproveAcademicContent: boolean;
      selfApprovalAllowed: boolean;
    };
    explanationRequired: boolean;
    universalMeetingCount: null;
    universalAssessmentMilestones: null;
    universalAttainmentThreshold: null;
  };
}

/**
 * Satu-satunya kontrak runtime untuk format DOCX resmi, urutan form, dan gate
 * validasi RPS. Nilai kalender/milestone/ambang tidak ditanam di sini; semuanya
 * harus datang dari kebijakan prodi-periode yang memiliki tanggal berlaku.
 */
export const rpsTemplateManifest = manifestData as unknown as RpsTemplateManifest;
