import { z } from "zod";

const nullableText = z.string().nullable();

export const rpsExtractionSchema = z.object({
  identity: z.object({
    university: nullableText,
    faculty: nullableText,
    studyProgram: nullableText,
    courseCode: nullableText,
    courseName: nullableText,
    credits: z.number().nullable(),
    semester: z.number().int().nullable(),
    academicYear: nullableText,
    coordinator: nullableText,
  }),
  cpl: z.array(z.object({ code: z.string(), description: z.string(), confidence: z.number().min(0).max(1) })),
  cpmk: z.array(z.object({
    code: z.string(),
    description: z.string(),
    cplRefs: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  })),
  weeklyPlan: z.array(z.object({
    week: z.number().int(),
    subCpmk: nullableText,
    topics: z.array(z.string()),
    learningMethods: z.array(z.string()),
    assessment: nullableText,
    durationMinutes: z.number().int().nullable(),
    confidence: z.number().min(0).max(1),
  })),
  assessments: z.array(z.object({
    name: z.string(),
    weightPercent: z.number().nullable(),
    cpmkRefs: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  })),
  issues: z.array(z.object({
    severity: z.enum(["info", "warning", "error"]),
    field: z.string(),
    message: z.string(),
    recommendation: z.string(),
  })),
});

export type RpsExtraction = z.infer<typeof rpsExtractionSchema>;
