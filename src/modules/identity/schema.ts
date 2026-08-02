import { z } from 'zod';

/**
 * One schema per operation, shared by the client form and the server action.
 * Client validation is a UX affordance; the server parse is the one that counts.
 * Sharing the schema is what stops the two drifting apart.
 */

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .max(254)
  .email('That does not look like an email address')
  .toLowerCase();

/**
 * Length over composition. Composition rules ("one capital, one symbol") push
 * people toward Password1! and measurably reduce entropy. Supabase additionally
 * rejects passwords found in the HaveIBeenPwned corpus.
 */
const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Passwords are limited to 72 characters');

const fullName = z
  .string()
  .trim()
  .min(2, 'Enter your name')
  .max(120, 'That name is too long');

/** E.164. Nepali mobiles are +977 followed by 10 digits. */
const phone = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{7,14}$/, 'Use the international format, e.g. +9779841234567');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
  next: z.string().optional(),
});

/**
 * The account type a person picks at signup.
 *
 * Only these two are offered. `agent` and `agency_manager` require an agency and
 * are assigned by an admin; `platform_admin` is never self-assignable. The
 * database enforces this independently in tg_handle_new_user(), which ignores
 * any privileged role in signup metadata. Signup metadata is attacker
 * controlled, so the UI restricting the choice is not a control.
 */
export const accountIntentSchema = z.enum(['customer', 'property_owner']);
export type AccountIntent = z.infer<typeof accountIntentSchema>;

export const registerSchema = z
  .object({
    fullName,
    email,
    password,
    confirmPassword: z.string(),
    intent: accountIntentSchema,
    phone: phone.optional().or(z.literal('')),
    acceptTerms: z.literal(true, {
      message: 'You need to accept the terms to continue',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Both passwords need to match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Both passwords need to match',
    path: ['confirmPassword'],
  });

/**
 * Adding a password to an account that was created through Google.
 *
 * Deliberately has no `currentPassword` field, because there is no current
 * password to confirm. The authorisation here is the live Google-issued
 * session, and setInitialPassword() refuses to run if the account already has
 * an email credential, so this can never be used to overwrite one.
 */
export const setInitialPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Both passwords need to match',
    path: ['confirmPassword'],
  });

export const recoveryCodeSchema = z.object({
  code: z.string().trim().min(8, 'Enter a recovery code'),
});

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export const profileSchema = z.object({
  fullName,
  phone: phone.optional().or(z.literal('')),
  bio: z.string().trim().max(1000, 'Keep this under 1000 characters').optional().or(z.literal('')),
  preferredLocale: z.enum(['en', 'ne']),
  preferredAreaUnit: z.enum(['sqm', 'sqft', 'ropani', 'aana', 'bigha', 'kattha']),
  avatarUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Both passwords need to match',
    path: ['confirmPassword'],
  });

export const paymentMethodSchema = z.object({
  provider: z.enum(['esewa', 'khalti', 'imepay', 'connectips', 'bank']),
  accountName: z.string().trim().min(2, 'Enter the account holder name').max(120),
  accountNumber: z.string().trim().min(3, 'Enter the account number').max(64),
  bankName: z.string().trim().max(120).optional().or(z.literal('')),
  branch: z.string().trim().max(120).optional().or(z.literal('')),
  qrImagePath: z.string().trim().max(500).optional().or(z.literal('')),
  instructions: z.string().trim().max(500).optional().or(z.literal('')),
  // Not .default(false): a Zod default makes the input type optional while the
  // output type stays required, which react-hook-form's resolver rejects. The
  // form always supplies a boolean, so requiring one here is honest.
  isDefault: z.boolean(),
});

export const revokeSessionSchema = z.object({ sessionId: z.string().uuid() });

export const notificationPrefsSchema = z.object({
  enquiries: z.boolean(),
  appointments: z.boolean(),
  savedSearches: z.boolean(),
  platform: z.boolean(),
});
