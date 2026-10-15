import type { User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, limit, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './client';
import type { AgentApplication, Inquiry, Listing, Profile } from './types';

export async function createProfile(user: User, input: { name: string; phone: string; role: string; location: string; contactEmail?: string }) {
  const batch = writeBatch(db());
  batch.set(doc(db(), 'users', user.uid), { ...input, email: user.email, photoUrl: user.photoURL, agentStatus: 'none', isBanned: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(db(), 'usersPublic', user.uid), { name: input.name, photoUrl: user.photoURL, updatedAt: serverTimestamp() });
  await batch.commit();
}
export async function updateProfile(uid: string, data: { name: string; location: string; photoUrl?: string; contactEmail?: string; agentBio?: string }, verifiedAgent = false) {
  const batch = writeBatch(db());
  const { contactEmail, agentBio, ...publicData } = data;
  batch.update(doc(db(), 'users', uid), { ...publicData, ...(contactEmail === undefined ? {} : { contactEmail }), photoUrl: data.photoUrl ?? null, updatedAt: serverTimestamp() });
  batch.set(doc(db(), 'usersPublic', uid), { name: data.name, photoUrl: data.photoUrl ?? null, updatedAt: serverTimestamp() }, { merge: true });
  await batch.commit();
  if (verifiedAgent) {
    try {
      if (agentBio !== undefined) await updateDoc(doc(db(), 'users', uid), { agentBio, updatedAt: serverTimestamp() });
      await setDoc(doc(db(), 'agentsPublic', uid), { name: data.name, location: data.location, photoUrl: data.photoUrl ?? null, ...(agentBio === undefined ? {} : { bio: agentBio }), updatedAt: serverTimestamp() }, { merge: true });
    } catch { return { agentDirectoryUpdated: false }; }
  }
  return { agentDirectoryUpdated: true };
}
export async function uploadImages(path: string, files: File[]) {
  return Promise.all(files.map(async file => {
    const safeName = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const item = ref(storage(), `${path}/${safeName}`);
    await uploadBytes(item, file, { contentType: file.type });
    return getDownloadURL(item);
  }));
}
export async function createListing(uid: string, ownerName: string, input: Omit<Listing, 'id' | 'ownerId' | 'ownerName' | 'photoUrls' | 'status' | 'viewCount'>, files: File[], contact?: { name: string; phone: string }) {
  const listingRef = doc(collection(db(), 'listings'));
  const batch = writeBatch(db());
  batch.set(listingRef, { ...input, ownerId: uid, ownerName, photoUrls: [], status: 'active', verificationStatus: 'pending', viewCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await batch.commit();
  if (contact) await setDoc(doc(db(), 'listings', listingRef.id, 'ownerContact', 'info'), contact);
  if (files.length) {
    const photoUrls = await uploadImages(`listings/${listingRef.id}`, files);
    await updateDoc(listingRef, { photoUrls, updatedAt: serverTimestamp() });
  }
  return listingRef.id;
}
export async function sendInquiry(listing: Listing, user: User, name: string, message: string, moveInDate: Date) {
  if (listing.ownerId === user.uid) throw new Error('You cannot inquire about your own listing.');
  const publicOwner = listing.agentId ? await getDoc(doc(db(), 'usersPublic', listing.ownerId)) : null;
  const ownerName = listing.agentId ? String(publicOwner?.data()?.name || 'Agent') : listing.ownerName;
  return addDoc(collection(db(), 'inquiries'), { listingId: listing.id, listingTitle: listing.title, customerId: user.uid, customerName: name, customerPhotoUrl: user.photoURL, ownerId: listing.ownerId, ownerName, agentId: listing.agentId ?? null, message, moveInDate, status: 'pending', declineReason: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
export async function decideInquiry(inquiry: Inquiry, status: 'accepted' | 'declined', reason = '') {
  await updateDoc(doc(db(), 'inquiries', inquiry.id), { status, declineReason: reason || null, updatedAt: serverTimestamp() });
  if (status === 'accepted') await ensureChat(inquiry);
}
export async function ensureChat(inquiry: Inquiry) {
  const id = `c_${inquiry.ownerId}_${inquiry.customerId}_${inquiry.listingId}`;
  const target = doc(db(), 'chats', id);
  if ((await getDoc(target)).exists()) return id;
  const old = await getDocs(query(collection(db(), 'chats'), where('ownerId', '==', inquiry.ownerId), where('customerId', '==', inquiry.customerId), where('listingId', '==', inquiry.listingId), limit(1)));
  if (!old.empty) return old.docs[0]!.id;
  if (!(await getDoc(target)).exists()) {
    const now = new Date();
    const publicOwner = await getDoc(doc(db(), 'usersPublic', inquiry.ownerId));
    const ownerName = String(publicOwner.data()?.name || inquiry.ownerName || 'Owner');
    await setDoc(target, { ownerId: inquiry.ownerId, ownerName, customerId: inquiry.customerId, customerName: inquiry.customerName, listingId: inquiry.listingId, listingTitle: inquiry.listingTitle, inquiryId: inquiry.id, createdAt: now, lastMessageAt: now, lastMessage: '', unreadOwner: 0, unreadCustomer: 0 });
  }
  return id;
}
export async function submitAgentApplication(uid: string, data: { fullName: string; phone: string; location: string; notes: string }, previous?: AgentApplication | null) {
  const target = doc(db(), 'agentApplications', uid);
  if (previous) await updateDoc(target, { ...data, status: 'pending', reason: null, updatedAt: serverTimestamp() });
  else await setDoc(target, { ...data, uid, status: 'pending', reason: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
export async function decideAgentApplication(app: AgentApplication, approve: boolean, actorId: string, reason = '') {
  const publicProfile = approve ? await getDoc(doc(db(), 'usersPublic', app.uid)) : null;
  const batch = writeBatch(db());
  batch.update(doc(db(), 'agentApplications', app.uid), { status: approve ? 'approved' : 'rejected', reason, decidedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.update(doc(db(), 'users', app.uid), { agentStatus: approve ? 'verified' : 'none', updatedAt: serverTimestamp() });
  if (approve) batch.set(doc(db(), 'agentsPublic', app.uid), { name: String(publicProfile?.data()?.name || app.fullName), location: app.location, photoUrl: publicProfile?.data()?.photoUrl || null, bio: '', updatedAt: serverTimestamp() }, { merge: true });
  else batch.delete(doc(db(), 'agentsPublic', app.uid));
  batch.set(doc(collection(db(), 'adminDecisions')), { action: 'agent', targetId: app.uid, targetName: app.fullName, decision: approve ? 'approved' : 'rejected', reason, actorId, createdAt: serverTimestamp() });
  try { await batch.commit(); return { audited: true }; }
  catch (error) {
    if ((error as { code?: string }).code !== 'permission-denied') throw error;
    // Existing deployed rules may predate the directory and audit collections.
    const fallback = writeBatch(db());
    fallback.update(doc(db(), 'agentApplications', app.uid), { status: approve ? 'approved' : 'rejected', reason, decidedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    fallback.update(doc(db(), 'users', app.uid), { agentStatus: approve ? 'verified' : 'none', updatedAt: serverTimestamp() });
    await fallback.commit();
    try {
      if (approve) await setDoc(doc(db(), 'agentsPublic', app.uid), { name: String(publicProfile?.data()?.name || app.fullName), location: app.location, photoUrl: publicProfile?.data()?.photoUrl || null, bio: '', updatedAt: serverTimestamp() }, { merge: true });
      else await deleteDoc(doc(db(), 'agentsPublic', app.uid));
    } catch { /* Directory rules may not be deployed yet. */ }
    return { audited: false };
  }
}

export async function decideListingVerification(listing: Listing, approve: boolean, actorId: string, reason = '') {
  const batch = writeBatch(db());
  batch.update(doc(db(), 'listings', listing.id), { verificationStatus: approve ? 'verified' : 'rejected', verificationReason: reason || null, ...(approve ? { verifiedAt: serverTimestamp(), verifiedBy: actorId } : {}), updatedAt: serverTimestamp() });
  batch.set(doc(collection(db(), 'adminDecisions')), { action: 'listing', targetId: listing.id, targetName: listing.title, decision: approve ? 'verified' : 'rejected', reason, actorId, createdAt: serverTimestamp() });
  try { await batch.commit(); return { audited: true }; }
  catch (error) {
    if ((error as { code?: string }).code !== 'permission-denied') throw error;
    await updateDoc(doc(db(), 'listings', listing.id), { verificationStatus: approve ? 'verified' : 'rejected', verificationReason: reason || null, ...(approve ? { verifiedAt: serverTimestamp(), verifiedBy: actorId } : {}), updatedAt: serverTimestamp() });
    return { audited: false };
  }
}

export async function setUserBan(profile: Profile, actorId: string) {
  const next = !profile.isBanned;
  const batch = writeBatch(db());
  batch.update(doc(db(), 'users', profile.id), { isBanned: next, updatedAt: serverTimestamp() });
  if (profile.agentStatus === 'verified') {
    if (next) batch.delete(doc(db(), 'agentsPublic', profile.id));
    else batch.set(doc(db(), 'agentsPublic', profile.id), { name: profile.name, location: profile.location || '', photoUrl: profile.photoUrl || null, bio: profile.agentBio || '', updatedAt: serverTimestamp() }, { merge: true });
  }
  batch.set(doc(collection(db(), 'adminDecisions')), { action: 'user', targetId: profile.id, targetName: profile.name, decision: next ? 'banned' : 'unbanned', reason: '', actorId, createdAt: serverTimestamp() });
  try { await batch.commit(); return { audited: true }; }
  catch (error) {
    if ((error as { code?: string }).code !== 'permission-denied') throw error;
    await updateDoc(doc(db(), 'users', profile.id), { isBanned: next, updatedAt: serverTimestamp() });
    if (profile.agentStatus === 'verified') {
      try {
        if (next) await deleteDoc(doc(db(), 'agentsPublic', profile.id));
        else await setDoc(doc(db(), 'agentsPublic', profile.id), { name: profile.name, location: profile.location || '', photoUrl: profile.photoUrl || null, bio: profile.agentBio || '', updatedAt: serverTimestamp() }, { merge: true });
      } catch { /* Directory rules may not be deployed yet. */ }
    }
    return { audited: false };
  }
}

export async function publishAgentProfile(profile: Profile, actorId: string) {
  if (profile.agentStatus !== 'verified' || profile.isBanned) throw new Error('Only an active verified agent can be published.');
  const batch = writeBatch(db());
  batch.set(doc(db(), 'agentsPublic', profile.id), { name: profile.name, location: profile.location || '', photoUrl: profile.photoUrl || null, bio: profile.agentBio || '', updatedAt: serverTimestamp() }, { merge: true });
  batch.set(doc(collection(db(), 'adminDecisions')), { action: 'agentProfile', targetId: profile.id, targetName: profile.name, decision: 'published', reason: '', actorId, createdAt: serverTimestamp() });
  await batch.commit();
}
export async function toggleFavorite(uid: string, listingId: string, active: boolean) {
  const target = doc(db(), 'users', uid, 'favourites', listingId);
  if (active) await deleteDoc(target); else await setDoc(target, { listingId, createdAt: serverTimestamp() });
}
export const countView = (listingId: string) => updateDoc(doc(db(), 'listings', listingId), { viewCount: increment(1) });
