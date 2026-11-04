import { describe, expect, it } from 'vitest';
import type { Listing } from './firebase/types';
import { listingListerId, listingListerName, listingsForPerson, publicListerRecord } from './public-lister';

const listing = (id: string, extra: Partial<Listing> = {}): Listing => ({ id, title: id, ownerId: 'owner', ownerName: 'Owner Name', roomType: 'room', rentPerMonth: 12000, status: 'active', ...extra });

describe('lister identity', () => {
  it('uses the specific agent, falls back to the owner, and never links anonymous listers', () => {
    expect(listingListerId(listing('agent-property', { agentId: 'agent' }))).toBe('agent');
    expect(listingListerId(listing('owner-property'))).toBe('owner');
    expect(listingListerId(listing('anonymous', { contactIsAnonymous: true, agentId: 'agent' }))).toBeNull();
    expect(listingListerId(null)).toBeNull();
  });
  it('never attributes an owner name to a different agent', () => {
    const property = listing('delegated', { agentId: 'agent' });
    expect(listingListerName(property, 'agent')).toBe('');
    expect(listingListerName(property, 'owner')).toBe('Owner Name');
  });
  it('keeps each profile limited to that person’s active, non-anonymous properties', () => {
    const items = [listing('owner'), listing('agent', { agentId: 'agent' }), listing('other', { ownerId: 'other' }), listing('anonymous', { contactIsAnonymous: true }), listing('inactive', { status: 'paused' })];
    expect(listingsForPerson(items, 'owner').map(item => item.id)).toEqual(['owner']);
    expect(listingsForPerson(items, 'agent').map(item => item.id)).toEqual(['agent']);
  });
  it('uses the document ID, strips private fields, and does not infer verification from shared data', () => {
    const person = publicListerRecord('actual-person', { id: 'different-person', name: ' Specific Person ', bio: 'Shared bio', publicPhone: '9800000000', phone: 'private phone', email: 'private@example.test', role: 'superAdmin', verifiedAgent: true });
    expect(person).toMatchObject({ id: 'actual-person', name: 'Specific Person', bio: 'Shared bio', publicPhone: '9800000000', verifiedAgent: false });
    expect(person).not.toHaveProperty('phone');
    expect(person).not.toHaveProperty('email');
    expect(person).not.toHaveProperty('role');
    expect(publicListerRecord('agent', { name: 'Agent' }, true).verifiedAgent).toBe(true);
  });
});
