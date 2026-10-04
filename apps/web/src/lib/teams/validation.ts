import { z } from 'zod';

export const CreateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name is too long'),
  sportId: z.string().uuid('Invalid sport ID'),
  description: z.string().max(500, 'Description too long').optional(),
  logoUrl: z.string().url('Invalid logo URL').optional(),
});

export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;

export const CreateInvitationSchema = z.object({
  invitedEmail: z.string().email('Invalid email address'),
});

export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>;

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['MANAGER', 'PLAYER']),
});

export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
