import { z } from "zod";

export const identifyPlantSchema = z.object({
  image: z.string().min(20, "A base64 image is required")
});

export const addPlantSchema = z.object({
  vaultId: z.string().uuid(),
  species: z.string().trim().min(2).max(140),
  nickname: z.string().trim().max(140).optional().or(z.literal("")),
  image: z.string().optional()
});

export const plantSearchQuerySchema = z.object({
  q: z.string().trim().min(3).max(120)
});

export const createVaultSchema = z.object({
  name: z.string().trim().min(2).max(80)
});

export const createInviteSchema = z.object({
  email: z.string().trim().email().optional().or(z.literal(""))
});

export const joinSpaceSchema = z.object({
  code: z.string().trim().min(6).max(32)
});

export const dashboardQuerySchema = z.object({
  vaultId: z.string().uuid()
});

export const updatePlantSchema = z.object({
  nickname: z.string().trim().min(1).max(140),
  wateringIntervalDays: z.number().int().min(1).max(45),
  image: z.string().optional()
});

export const notificationSettingSchema = z.object({
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean().optional().default(false)
});

export const vaultMemberRoleSchema = z.object({
  role: z.enum(["editor", "member"])
});
