import { describe, expect, it } from 'vitest';
import {
  SOLE_SUPERADMIN_EMAIL,
  formatAdminDecisionSummary,
  isSoleSuperAdminProfile,
} from './superadmin';

describe('superadmin helpers', () => {
  it('identifies the sole superadmin account by role or protected email', () => {
    expect(SOLE_SUPERADMIN_EMAIL).toBe('himavolt3569@gmail.com');
    expect(
      isSoleSuperAdminProfile({ role: 'superAdmin', email: 'himavolt3569@gmail.com' }),
    ).toBe(true);
    expect(
      isSoleSuperAdminProfile({ role: 'customer', email: 'HIMAVOLT3569@GMAIL.COM ' }),
    ).toBe(true);
    expect(
      isSoleSuperAdminProfile({ role: 'superAdmin', email: 'admin@example.test' }),
    ).toBe(true);
    expect(
      isSoleSuperAdminProfile({ role: 'customer', email: 'user@example.test' }),
    ).toBe(false);
    expect(isSoleSuperAdminProfile(null)).toBe(false);
  });

  it('formats admin audit decisions into plain English and Nepali summaries', () => {
    expect(
      formatAdminDecisionSummary(
        { action: 'listing', targetName: 'Sunny Patan flat', decision: 'verified' },
        'en',
      ),
    ).toBe('Verified property "Sunny Patan flat"');

    expect(
      formatAdminDecisionSummary(
        { action: 'agent', targetName: 'Sita Sharma', decision: 'approved' },
        'en',
      ),
    ).toBe('Approved agent request for Sita Sharma');

    expect(
      formatAdminDecisionSummary(
        { action: 'userRole', targetName: 'Ram', decision: 'owner' },
        'ne',
      ),
    ).toBe('Ram को भूमिका घरधनी बनाइयो');

    expect(
      formatAdminDecisionSummary(
        { action: 'userProfile', targetName: 'Sita', decision: 'updated' },
        'en',
      ),
    ).toBe('Updated profile for Sita');

    expect(
      formatAdminDecisionSummary(
        { action: 'inquiry', targetName: 'Sunny flat', decision: 'accepted' },
        'en',
      ),
    ).toBe('Accepted inquiry on "Sunny flat"');

    expect(
      formatAdminDecisionSummary(
        { action: 'custom', targetName: 'Item 1', decision: 'done' },
        'en',
      ),
    ).toBe('custom · Item 1 · done');
  });
});
