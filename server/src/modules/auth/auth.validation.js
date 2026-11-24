import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(254));
// bcrypt only uses the first 72 bytes, so longer passwords are rejected.
const password = z.string().min(8, 'Password must be at least 8 characters').max(72);

export const registerSchema = z.strictObject({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email,
  password,
});

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1, 'Password is required').max(72),
});

export const googleSchema = z.strictObject({
  idToken: z.string().min(20).max(4096),
});
