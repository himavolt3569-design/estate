// Real SDK operations against a demo emulator; never reads production data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc, deleteDoc, deleteField, Timestamp, serverTimestamp, increment, writeBatch, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');
const source = process.env.MEROKOTHA_RULES_SOURCE || new URL('../firebase/firestore.rules', import.meta.url);
const env = await initializeTestEnvironment({ projectId: 'demo-merokotha-feature-tests', firestore: {
  host: '127.0.0.1', port: 8088, rules: await readFile(source, 'utf8'),
} });
const clients = new Map();
const db = uid => {
  if (!clients.has(uid)) clients.set(uid, env.authenticatedContext(uid).firestore());
  return clients.get(uid);
};
const listing = (uid = 'owner') => ({ ownerId: uid, ownerName: uid, title: 'Rental', rentPerMonth: 10000,
  status: 'active', createdAt: Timestamp.fromMillis(1), photoUrls: [] });
const reset = { verificationStatus: 'pending', verifiedAt: deleteField(), verifiedBy: deleteField(), verificationReason: deleteField(),
  reviewedAt: deleteField(), reviewedBy: deleteField(), reviewReason: deleteField() };
try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    for (const uid of ['owner', 'agent', 'renter', 'stranger', 'admin', 'banned']) {
      await setDoc(doc(context.firestore(), 'users', uid), { name: uid, phone: '', role: uid === 'admin' ? 'superAdmin' : 'customer',
        agentStatus: uid === 'agent' ? 'verified' : 'none', isBanned: uid === 'banned', createdAt: Timestamp.fromMillis(1) });
    }
    for (const uid of ['owner', 'agent']) await setDoc(doc(context.firestore(), 'listings', uid), {
      ...listing(uid), ...(uid === 'agent' ? { agentId: uid } : {}), verificationStatus: 'verified',
      verifiedAt: Timestamp.fromMillis(2), verifiedBy: 'admin', verificationReason: 'Approved',
      reviewedAt: Timestamp.fromMillis(2), reviewedBy: 'admin', reviewReason: 'Approved',
      tourScenes: [], publicCallNumber: '9800000000',
    });
    await setDoc(doc(context.firestore(), 'listings', 'suspended'), { ...listing(), status: 'suspended', verificationStatus: 'pending' });
    await setDoc(doc(context.firestore(), 'listings', 'security-target'), { ...listing(), verificationStatus: 'pending' });
  });
  await test('legacy Android and current web listing creation both work', async () => {
    await assertSucceeds(setDoc(doc(db('owner'), 'listings', 'legacy-create'), listing()));
    await assertSucceeds(setDoc(doc(db('owner'), 'listings', 'web-create'), { ...listing(), verificationStatus: 'pending' }));
    await assertSucceeds(setDoc(doc(db('agent'), 'listings', 'agent-create'), { ...listing('agent'), agentId: 'agent' }));
  });
  await test('Android availability toggles preserve the review verdict', async () => {
    await assertSucceeds(updateDoc(doc(db('owner'), 'listings', 'owner'), { status: 'paused', updatedAt: serverTimestamp() }));
    assert.equal((await getDoc(doc(db('owner'), 'listings', 'owner'))).data().verificationStatus, 'verified');
  });
  await test('reviewed content edits require a reset; Android patches preserve web-only data', async () => {
    await assertFails(updateDoc(doc(db('owner'), 'listings', 'owner'), { title: 'Changed' }));
    await assertSucceeds(updateDoc(doc(db('owner'), 'listings', 'owner'), { title: 'Changed', ...reset, updatedAt: serverTimestamp() }));
    const data = (await getDoc(doc(db('owner'), 'listings', 'owner'))).data();
    assert.deepEqual(data.tourScenes, []);
    assert.equal(data.publicCallNumber, '9800000000');
    assert.equal(data.verificationStatus, 'pending');
    assert.equal(data.verifiedBy, undefined);
    assert.equal(data.reviewedBy, undefined);
  });
  await test('agent edits reset verification and save private contact atomically', async () => {
    const batch = writeBatch(db('agent'));
    batch.update(doc(db('agent'), 'listings', 'agent'), { title: 'Agent edit', ...reset, updatedAt: serverTimestamp() });
    batch.set(doc(db('agent'), 'listings/agent/ownerContact/info'), { name: 'Real owner', phone: '9800000000' }, { merge: true });
    await assertSucceeds(batch.commit());
    await assertFails(getDoc(doc(db('renter'), 'listings/agent/ownerContact/info')));
  });
  await test('users cannot self-verify, forge reviewer metadata, or escape suspension', async () => {
    await assertFails(updateDoc(doc(db('owner'), 'listings', 'security-target'), { verificationStatus: 'verified' }));
    await assertFails(updateDoc(doc(db('owner'), 'listings', 'security-target'), { verificationStatus: 'pending', verifiedBy: 'admin' }));
    await assertFails(updateDoc(doc(db('owner'), 'listings', 'suspended'), { status: 'active', ...reset }));
    await assertFails(deleteDoc(doc(db('owner'), 'listings', 'suspended')));
    await assertFails(setDoc(doc(db('owner'), 'listings', 'forged-create'), { ...listing(), verificationStatus: 'verified' }));
  });
  await test('signup accepts both client profiles but cannot grant agent privileges', async () => {
    const profile = { name: 'New user', role: 'customer', createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db('new-android'), 'users', 'new-android'), { ...profile, phone: '', agentStatus: 'none', isBanned: false, isVerified: false }));
    await assertSucceeds(setDoc(doc(db('new-web'), 'users', 'new-web'), profile));
    await assertFails(setDoc(doc(db('self-verified'), 'users', 'self-verified'), { ...profile, phone: '', agentStatus: 'verified' }));
    await assertFails(setDoc(doc(db('self-admin'), 'users', 'self-admin'), { ...profile, role: 'superAdmin' }));
  });
  await test('web and newer Android profile fields coexist, including absent legacy phone', async () => {
    await assertSucceeds(updateDoc(doc(db('owner'), 'users', 'owner'), { contactEmail: 'owner@example.test', agentBio: 'Agent biography' }));
    await assertSucceeds(updateDoc(doc(db('owner'), 'users', 'owner'), { phone: '9800000000', bio: 'Android biography', locale: 'ne' }));
    await assertSucceeds(updateDoc(doc(db('new-web'), 'users', 'new-web'), { name: 'Updated', contactEmail: 'contact@example.test' }));
    await assertFails(updateDoc(doc(db('owner'), 'users', 'owner'), { agentStatus: 'verified' }));
    await assertFails(updateDoc(doc(db('banned'), 'users', 'banned'), { contactEmail: 'banned@example.test' }));
  });
  await test('newer Android public profile fields remain supported', async () => {
    await assertSucceeds(setDoc(doc(db('owner'), 'usersPublic', 'owner'), { name: 'Owner', bio: 'Public', publicPhone: '', whatsappNumber: '', hideDisplayName: false }));
    await assertFails(setDoc(doc(db('renter'), 'usersPublic', 'renter'), { name: 'Renter', email: 'private@example.test' }));
  });
  await test('directory accepts both projections while status remains controlled', async () => {
    await assertSucceeds(setDoc(doc(db('admin'), 'agentsPublic', 'agent'), { name: 'Agent', location: 'Patan', bio: '', status: 'active' }));
    await assertSucceeds(updateDoc(doc(db('agent'), 'agentsPublic', 'agent'), { bio: 'Updated', publicPhone: '' }));
    await assertFails(updateDoc(doc(db('agent'), 'agentsPublic', 'agent'), { status: 'suspended' }));
    await assertSucceeds(setDoc(doc(db('admin'), 'adminDecisions', 'web-audit'), { actorId: 'admin', action: 'agent' }));
    await assertFails(updateDoc(doc(db('admin'), 'adminDecisions', 'web-audit'), { action: 'changed' }));
  });
  await test('deployed Android report, analytics and moderation paths are retained', async () => {
    await assertSucceeds(setDoc(doc(db('renter'), 'reports', 'android-report'), { reporterId: 'renter', listingId: 'owner', category: 'fraud', details: '', status: 'pending', createdAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(db('renter'), 'reports', 'android-report')));
    await assertFails(getDoc(doc(db('stranger'), 'reports', 'android-report')));
    await assertSucceeds(setDoc(doc(env.unauthenticatedContext().firestore(), 'listingEvents', 'android-event'), { listingId: 'owner', ownerId: 'owner', type: 'view', visitorId: 'browser', createdAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db('admin'), 'moderationHistory', 'android-decision'), { actorId: 'admin', decision: 'resolved' }));
  });
  await test('a new shared chat can check its deterministic ID before creation', async () => {
    const missing = await assertSucceeds(getDoc(doc(db('renter'), 'chats', 'c_owner_renter_owner')));
    assert.equal(missing.exists(), false);
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'chats', 'c_owner_renter_owner')));
  });
  await test('inquiry acceptance opens one shared chat; messages and queries stay participant-scoped', async () => {
    const inquiry = { listingId: 'owner', listingTitle: 'Rental', customerId: 'renter', customerName: 'Renter',
      ownerId: 'owner', ownerName: 'Owner', message: 'Interested', status: 'pending', createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db('renter'), 'inquiries', 'shared-inquiry'), inquiry));
    const chat = { ownerId: 'owner', customerId: 'renter', listingId: 'owner', listingTitle: 'Rental',
      ownerName: 'Owner', customerName: 'Renter', inquiryId: 'shared-inquiry', createdAt: Timestamp.fromMillis(1),
      lastMessageAt: Timestamp.fromMillis(1), lastMessage: '', unreadOwner: 0, unreadCustomer: 0 };
    await assertFails(setDoc(doc(db('renter'), 'chats', 'c_owner_renter_owner'), chat));
    await assertFails(updateDoc(doc(db('stranger'), 'inquiries', 'shared-inquiry'), { status: 'accepted' }));
    await assertSucceeds(updateDoc(doc(db('owner'), 'inquiries', 'shared-inquiry'), { status: 'accepted', updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db('renter'), 'chats', 'c_owner_renter_owner'), chat));
    for (const [uid, side] of [['owner', 'ownerId'], ['renter', 'customerId']]) {
      const conversations = await assertSucceeds(getDocs(query(collection(db(uid), 'chats'), where(side, '==', uid))));
      assert.equal(conversations.size, 1);
    }
    await assertFails(getDoc(doc(db('stranger'), 'chats', 'c_owner_renter_owner')));
    const batch = writeBatch(db('renter'));
    batch.set(doc(db('renter'), 'chats/c_owner_renter_owner/messages/web-message'), {
      senderId: 'renter', text: 'Hello from web', createdAt: serverTimestamp(), isRead: false,
    });
    batch.update(doc(db('renter'), 'chats', 'c_owner_renter_owner'), {
      lastMessage: 'Hello from web', lastMessageSenderId: 'renter', lastMessageAt: serverTimestamp(), unreadOwner: increment(1),
    });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(db('owner'), 'chats/c_owner_renter_owner/messages/web-message')));
    await assertSucceeds(updateDoc(doc(db('owner'), 'chats/c_owner_renter_owner/messages/web-message'), { isRead: true }));
    await assertFails(getDoc(doc(db('stranger'), 'chats/c_owner_renter_owner/messages/web-message')));
  });
  await test('shared favourites and agent applications remain private and admin-approved', async () => {
    await assertSucceeds(setDoc(doc(db('renter'), 'users/renter/favourites/owner'), { listingId: 'owner', createdAt: serverTimestamp() }));
    await assertFails(getDoc(doc(db('stranger'), 'users/renter/favourites/owner')));
    await assertSucceeds(setDoc(doc(db('renter'), 'agentApplications', 'renter'), {
      uid: 'renter', fullName: 'Renter', phone: '9800000000', location: 'Patan', status: 'pending', createdAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(db('renter'), 'agentApplications', 'renter'), { status: 'approved' }));
    const batch = writeBatch(db('admin'));
    batch.update(doc(db('admin'), 'agentApplications', 'renter'), { status: 'approved' });
    batch.update(doc(db('admin'), 'users', 'renter'), { agentStatus: 'verified' });
    await assertSucceeds(batch.commit());
  });
} finally { await env.cleanup(); }
