import { z } from 'zod';


const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .max(254)
  .email('That does not look like an email address')
  .toLowerCase();


const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Passwords are limited to 72 characters');

const fullName = z
  .string()
  .trim()
  .min(2, 'Enter your name')
  .max(120, 'That name is too long');


const phone = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{7,14}$/, 'Use the international format, e.g. +9779841234567');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
  next: z.string().optional(),
});


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

  isDefault: z.boolean(),
});

export const revokeSessionSchema = z.object({ sessionId: z.string().uuid() });

export const notificationPrefsSchema = z.object({
  enquiries: z.boolean(),
  appointments: z.boolean(),
  savedSearches: z.boolean(),
  platform: z.boolean(),
});
