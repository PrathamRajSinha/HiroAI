import { z } from "zod";

export const InterviewTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  jobTitle: z.string().min(1, "Job title is required"),
  seniorityLevel: z.enum(["Entry", "Mid", "Senior", "Staff", "Principal"]),
  roleType: z.enum(["Frontend", "Backend", "Fullstack", "DevOps", "Data Science", "Mobile", "QA", "Product Manager"]),
  techStack: z.string().min(1, "Tech stack is required"),
  department: z.string().optional(),
  commonTopics: z.array(z.string()).default([]),
  defaultQuestionType: z.enum(["Coding", "Algorithm", "System Design", "Data Structures", "Behavioral", "Psychometric", "Situational", "Technical Knowledge"]).default("Coding"),
  defaultDifficulty: z.enum(["Easy", "Medium", "Hard"]).default("Medium"),
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
  createdBy: z.string().optional(),
  isPublic: z.boolean().default(false),
  usageCount: z.number().default(0)
});

export type InterviewTemplate = z.infer<typeof InterviewTemplateSchema>;

export const CreateTemplateSchema = InterviewTemplateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true
});

export type CreateTemplate = z.infer<typeof CreateTemplateSchema>;

// Clone interview schema for extracting template data from existing interviews
export const CloneInterviewSchema = z.object({
  interviewId: z.string(),
  name: z.string().min(1, "Clone name is required"),
  description: z.string().optional()
});

export type CloneInterview = z.infer<typeof CloneInterviewSchema>;