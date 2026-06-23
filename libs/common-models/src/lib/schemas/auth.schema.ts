import { z } from 'zod';

/** Registration payload. */
export const RegisterSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8, 'password must be at least 8 characters').max(200),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

/** Login payload. */
export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;
