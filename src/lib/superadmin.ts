import type { AdminDecision, Profile } from './firebase/types';

export const SOLE_SUPERADMIN_EMAIL = 'himavolt3569@gmail.com';

export function isSoleSuperAdminProfile(person?: Pick<Profile, 'role' | 'email'> | null): boolean {
  if (!person) return false;
  return (
    person.role === 'superAdmin' ||
    (person.email || '').trim().toLowerCase() === SOLE_SUPERADMIN_EMAIL
  );
}

export function formatAdminDecisionSummary(
  item: Pick<AdminDecision, 'action' | 'targetName' | 'decision'>,
  locale: 'en' | 'ne' = 'en',
): string {
  const target = item.targetName || (locale === 'ne' ? 'अज्ञात' : 'Item');
  const key = `${item.action}:${item.decision}`;
  const map: Record<string, [string, string]> = {
    'listing:verified': [
      `Verified property "${target}"`,
      `"${target}" घरजग्गा प्रमाणित गरियो`,
    ],
    'listing:rejected': [
      `Rejected property "${target}"`,
      `"${target}" घरजग्गा अस्वीकार गरियो`,
    ],
    'listing:active': [
      `Set property "${target}" to Active`,
      `"${target}" घरजग्गा सक्रिय गरियो`,
    ],
    'listing:paused': [
      `Paused property "${target}"`,
      `"${target}" घरजग्गा रोकियो`,
    ],
    'listing:rented': [
      `Marked property "${target}" as Rented`,
      `"${target}" घरजग्गा भाडामा गएको चिन्ह लगाइयो`,
    ],
    'listing:deleted': [
      `Deleted property "${target}"`,
      `"${target}" घरजग्गा हटाइयो`,
    ],
    'agent:approved': [
      `Approved agent request for ${target}`,
      `${target} को एजेन्ट आवेदन स्वीकृत गरियो`,
    ],
    'agent:rejected': [
      `Rejected agent request for ${target}`,
      `${target} को एजेन्ट आवेदन अस्वीकार गरियो`,
    ],
    'agent:verified': [
      `Verified ${target} as an agent`,
      `${target} लाई प्रमाणित एजेन्ट बनाइयो`,
    ],
    'agent:revoked': [
      `Removed agent verification from ${target}`,
      `${target} बाट एजेन्ट प्रमाणीकरण हटाइयो`,
    ],
    'agentProfile:published': [
      `Published ${target} to public Agents directory`,
      `${target} को एजेन्ट प्रोफाइल सार्वजनिक गरियो`,
    ],
    'user:banned': [
      `Suspended account for ${target}`,
      `${target} को खाता निलम्बन गरियो`,
    ],
    'user:unbanned': [
      `Restored account for ${target}`,
      `${target} को खाता पुनः सक्रिय गरियो`,
    ],
    'userProfile:created': [
      `Created profile for ${target}`,
      `${target} को प्रोफाइल बनाइयो`,
    ],
    'userProfile:updated': [
      `Updated profile for ${target}`,
      `${target} को प्रोफाइल अद्यावधिक गरियो`,
    ],
    'userProfile:deleted': [
      `Deleted profile for ${target}`,
      `${target} को प्रोफाइल हटाइयो`,
    ],
    'inquiry:accepted': [
      `Accepted inquiry on "${target}"`,
      `"${target}" को सोधपुछ स्वीकृत गरियो`,
    ],
    'inquiry:declined': [
      `Declined inquiry on "${target}"`,
      `"${target}" को सोधपुछ अस्वीकृत गरियो`,
    ],
    'inquiry:pending': [
      `Reopened inquiry on "${target}"`,
      `"${target}" को सोधपुछ फेरि खोलियो`,
    ],
    'inquiry:deleted': [
      `Deleted inquiry on "${target}"`,
      `"${target}" को सोधपुछ हटाइयो`,
    ],
    'userRole:customer': [
      `Changed ${target}'s role to Customer`,
      `${target} को भूमिका ग्राहक बनाइयो`,
    ],
    'userRole:owner': [
      `Changed ${target}'s role to Owner`,
      `${target} को भूमिका घरधनी बनाइयो`,
    ],
    'userRole:agent': [
      `Changed ${target}'s role to Agent`,
      `${target} को भूमिका एजेन्ट बनाइयो`,
    ],
    'report:review': [
      `Started reviewing complaint on "${target}"`,
      `"${target}" माथिको उजुरी समीक्षा सुरु गरियो`,
    ],
    'report:resolve': [
      `Resolved complaint on "${target}"`,
      `"${target}" माथिको उजुरी समाधान गरियो`,
    ],
    'report:dismiss': [
      `Dismissed complaint on "${target}"`,
      `"${target}" माथिको उजुरी खारेज गरियो`,
    ],
    'report:pause': [
      `Paused "${target}" & resolved complaint`,
      `"${target}" रोकी उजुरी समाधान गरियो`,
    ],
    'ad:deleted': [
      `Deleted advertisement "${target}"`,
      `"${target}" विज्ञापन हटाइयो`,
    ],
  };

  const entry = map[key];
  if (entry) return locale === 'ne' ? entry[1] : entry[0];
  return `${item.action} · ${target} · ${item.decision}`;
}
