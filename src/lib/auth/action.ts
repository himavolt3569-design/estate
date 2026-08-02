import 'server-only';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

import { roleHasPermission, type Permission } from './permissions';
import { getSessionUser, type SessionUser } from './session';

/**
 * The wrapper every Server Action goes through.
 *
 * A Server Action is a public HTTP endpoint. Not exporting it from a page does
 * not make it unreachable, so each one must independently resolve the session,
 * assert the permission, and validate its input. This helper makes forgetting
 * any of the three impossible: `schema` and `handler` are required, and the
 * handler only ever receives parsed input and a resolved user.
 *
 * The permission check here is defence in depth. RLS is still the boundary, and
 * this exists to fail early with a clear message rather than surfacing a raw
 * policy violation to the user.
 */

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type HandlerContext<TInput> = {
  input: TInput;
  user: SessionUser;
  supabase: SupabaseServerClient;
};

type ActionConfig<TSchema extends z.ZodType, TOutput> = {
  schema: TSchema;
  /** Permission required to run this action. Omit only for self-scoped actions. */
  permission?: Permission;
  /** Allow unverified accounts. Default false: `active` status is required. */
  allowInactive?: boolean;
  handler: (ctx: HandlerContext<z.infer<TSchema>>) => Promise<TOutput>;
};

export function authedAction<TSchema extends z.ZodType, TOutput>(
  config: ActionConfig<TSchema, TOutput>,
) {
  return async (rawInput: unknown): Promise<ActionResult<TOutput>> => {
    // 1. Session
    const user = await getSessionUser();
    if (!user) {
      return { ok: false, error: 'Sign in to continue.' };
    }

    if (!config.allowInactive && user.status !== 'active') {
      return {
        ok: false,
        error:
          user.status === 'pending_verification'
            ? 'Confirm your email address to continue.'
            : 'This account is suspended. Contact support to resolve it.',
      };
    }

    // 2. Authorization
    if (config.permission && !roleHasPermission(user.role, config.permission)) {
      return { ok: false, error: 'You do not have access to this action.' };
    }

    // 3. Validation
    const parsed = config.schema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: 'Check the highlighted fields.',
        fieldErrors: toFieldErrors(parsed.error),
      };
    }

    try {
      const supabase = await createClient();
      const data = await config.handler({ input: parsed.data, user, supabase });
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: toUserMessage(error) };
    }
  };
}

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/**
 * Postgres errors are turned into something a person can act on. A raw
 * "new row violates row-level security policy" tells an attacker what they hit
 * and tells a legitimate user nothing at all.
 */
function toUserMessage(error: unknown): string {
  const pgError = error as { code?: string; message?: string; hint?: string };

  switch (pgError?.code) {
    case '42501': // insufficient_privilege
      return 'You do not have access to this action.';
    case '23505': // unique_violation
      return 'That already exists.';
    case '23503': // foreign_key_violation
      return 'A referenced record is missing or has been removed.';
    case '23514': // check_violation: our triggers raise these with useful text
      return pgError.message ?? 'That change is not allowed.';
    case '53400':
    case '53300':
      return 'Too many requests. Try again shortly.';
    default:
      if (process.env.NODE_ENV !== 'production' && pgError?.message) {
        return pgError.message;
      }
      return 'Something went wrong. Try again.';
  }
}

/** For actions that only touch the caller's own data and need no permission. */
export function selfAction<TSchema extends z.ZodType, TOutput>(
  config: Omit<ActionConfig<TSchema, TOutput>, 'permission' | 'requireSecondFactor'>,
) {
  return authedAction(config);
}
