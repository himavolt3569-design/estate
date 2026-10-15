import type { Metadata } from 'next';

import { PeopleTable } from '@/modules/admin/components/PeopleTable';
import { getAllPeople } from '@/modules/admin/master-queries';

import { PageHeader } from '../../components/PageHeader';

export const metadata: Metadata = { title: 'People', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminPeoplePage() {
  const people = await getAllPeople();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Platform"
        title="People"
        subtitle="Everyone with an account. Open any of them to correct a name, change the sign-in email, set a new password, or change what they are allowed to do. Every change is recorded with your name against it."
      />

      <PeopleTable people={people} />
    </div>
  );
}
