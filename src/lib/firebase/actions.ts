import type { User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, limit, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './client';
import type { AgentApplication, Inquiry, Listing, Profile } from './types';
import { watermarkPropertyPhoto } from '@/lib/image-watermark';
import { validContactNumber } from '@/lib/contact';
import { isSoleSuperAdminProfile } from '@/lib/superadmin';

function assertDocumentId(value: string, label: string): string {
  const clean = value.trim();
  if (!clean || clean.includes('/') || clean.includes('..') || clean.length > 256) {
    throw new Error(`Invalid ${label} identifier.`);
  }
  return clean;
}

export async function createProfile(user: User, input: { name: string; phone: string; role: string; location: string; contactEmail?: string }) {
  const batch = writeBatch(db());
  batch.set(doc(db(), 'users', user.uid), { ...input, email: user.email, photoUrl: user.photoURL, agentStatus: 'none', isBanned: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(db(), 'usersPublic', user.uid), { name: input.name, photoUrl: user.photoURL, updatedAt: serverTimestamp() });
  await batch.commit();
}
export async function updateProfile(uid: string, data: { name: string; location: string; photoUrl?: string; contactEmail?: string; agentBio?: string; publicPhone?: string; whatsappNumber?: string }, verifiedAgent = false) {
  if (![data.publicPhone || '', data.whatsappNumber || ''].every(validContactNumber)) throw new Error('Enter a valid public phone or WhatsApp number.');
  const batch = writeBatch(db());
  const { contactEmail, agentBio, publicPhone, whatsappNumber, ...publicData } = data;
  batch.update(doc(db(), 'users', uid), { ...publicData, ...(contactEmail === undefined ? {} : { contactEmail }), photoUrl: data.photoUrl ?? null, updatedAt: serverTimestamp() });
  batch.set(doc(db(), 'usersPublic', uid), { name: data.name, photoUrl: data.photoUrl ?? null, updatedAt: serverTimestamp() }, { merge: true });
  await batch.commit();
  if (verifiedAgent) {
    try {
      const agentContacts = { ...(publicPhone === undefined ? {} : { publicPhone }), ...(whatsappNumber === undefined ? {} : { whatsappNumber }) };
      const agentBatch = writeBatch(db());
      agentBatch.update(doc(db(), 'users', uid), { ...(agentBio === undefined ? {} : { agentBio }), ...agentContacts, updatedAt: serverTimestamp() });
      agentBatch.set(doc(db(), 'agentsPublic', uid), { name: data.name, location: data.location, photoUrl: data.photoUrl ?? null, ...(agentBio === undefined ? {} : { bio: agentBio }), ...agentContacts, updatedAt: serverTimestamp() }, { merge: true });
      await agentBatch.commit();
    } catch { return { agentDirectoryUpdated: false }; }
  }
  return { agentDirectoryUpdated: true };
}
export async function uploadImages(path: string, files: File[]) {
  // Processing serially avoids holding several full-size canvases in memory
  // on phones. Upload order remains the cover-photo order selected by the user.
  const urls: string[] = [];
  for (const original of files) {
    const file = path.startsWith('listings/') ? await watermarkPropertyPhoto(original) : original;
    const safeName = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const item = ref(storage(), `${path}/${safeName}`);
    await uploadBytes(item, file, { contentType: file.type });
    urls.push(await getDownloadURL(item));
  }
  return urls;
}
export async function createListing(listingId: string, uid: string, ownerName: string, input: Omit<Listing, 'id' | 'ownerId' | 'ownerName' | 'photoUrls' | 'status' | 'viewCount'>, files: File[], contact?: { name: string; phone: string }) {
  const purpose = input.transactionType || input.purpose || 'rent';
  const compatibleInput = { ...input, purpose, transactionType: purpose, salePrice: purpose === 'sale' ? input.salePrice : 0 };
  // A form retains this ID through retries, including a failed photo/contact step.
  // The transaction also handles two simultaneous requests for the same ID.
  const listingRef = doc(db(), 'listings', listingId);
  const existingPhotos = await runTransaction(db(), async transaction => {
    const existing = await transaction.get(listingRef);
    if (existing.exists()) {
      if (existing.data().ownerId !== uid) throw new Error('This rental belongs to another account.');
      return (existing.data().photoUrls || []) as string[];
    }
    transaction.set(listingRef, { ...compatibleInput, ownerId: uid, ownerName, photoUrls: [], status: 'active', verificationStatus: 'pending', viewCount: 0, saveCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return [] as string[];
  });
  if (contact) await setDoc(doc(db(), 'listings', listingRef.id, 'ownerContact', 'info'), contact);
  if (files.length && !existingPhotos.length) {
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

function publicAgentPayload(profile: Pick<Profile, 'name' | 'location' | 'photoUrl' | 'agentBio' | 'publicPhone' | 'whatsappNumber'>) {
  return {
    name: profile.name,
    location: profile.location || '',
    photoUrl: profile.photoUrl || null,
    bio: profile.agentBio || '',
    ...(profile.publicPhone ? { publicPhone: profile.publicPhone } : {}),
    ...(profile.whatsappNumber ? { whatsappNumber: profile.whatsappNumber } : {}),
    status: 'active',
    updatedAt: serverTimestamp(),
  };
}

async function runAuditedAdminAction(
  setup: (batch: ReturnType<typeof writeBatch>) => void,
  fallback: () => Promise<void>,
) {
  const batch = writeBatch(db());
  setup(batch);
  try {
    await batch.commit();
    return { audited: true };
  } catch (error) {
    if ((error as { code?: string }).code !== 'permission-denied') throw error;
    await fallback();
    return { audited: false };
  }
}

export async function decideListingVerification(listing: Listing, approve: boolean, actorId: string, reason = '') {
  const payload = { verificationStatus: approve ? 'verified' : 'rejected', verificationReason: reason || null, ...(approve ? { verifiedAt: serverTimestamp(), verifiedBy: actorId } : {}), updatedAt: serverTimestamp() };
  return runAuditedAdminAction(
    batch => {
      batch.update(doc(db(), 'listings', listing.id), payload);
      batch.set(doc(collection(db(), 'adminDecisions')), { action: 'listing', targetId: listing.id, targetName: listing.title, decision: approve ? 'verified' : 'rejected', reason, actorId, createdAt: serverTimestamp() });
    },
    () => updateDoc(doc(db(), 'listings', listing.id), payload),
  );
}

export async function adminSetListingStatus(listing: Listing, status: 'active' | 'paused' | 'rented', actorId: string) {
  const listingId = assertDocumentId(listing.id, 'listing');
  const payload = { status, updatedAt: serverTimestamp() };
  return runAuditedAdminAction(
    batch => {
      batch.update(doc(db(), 'listings', listingId), payload);
      batch.set(doc(collection(db(), 'adminDecisions')), { action: 'listing', targetId: listingId, targetName: listing.title, decision: status, reason: '', actorId, createdAt: serverTimestamp() });
    },
    () => updateDoc(doc(db(), 'listings', listingId), payload),
  );
}

export async function adminDeleteListing(listing: Listing, actorId: string) {
  const listingId = assertDocumentId(listing.id, 'listing');
  return runAuditedAdminAction(
    batch => {
      batch.delete(doc(db(), 'listings', listingId));
      batch.set(doc(collection(db(), 'adminDecisions')), { action: 'listing', targetId: listingId, targetName: listing.title, decision: 'deleted', reason: '', actorId, createdAt: serverTimestamp() });
    },
    () => deleteDoc(doc(db(), 'listings', listingId)),
  );
}

export async function setUserBan(profile: Profile, actorId: string) {
  if (isSoleSuperAdminProfile(profile) || profile.id === actorId) {
    throw new Error('The sole Superadmin account cannot be suspended.');
  }
  const next = !profile.isBanned;
  return runAuditedAdminAction(
    batch => {
      batch.update(doc(db(), 'users', profile.id), { isBanned: next, updatedAt: serverTimestamp() });
      if (profile.agentStatus === 'verified') {
        if (next) batch.delete(doc(db(), 'agentsPublic', profile.id));
        else batch.set(doc(db(), 'agentsPublic', profile.id), publicAgentPayload(profile), { merge: true });
      }
      batch.set(doc(collection(db(), 'adminDecisions')), { action: 'user', targetId: profile.id, targetName: profile.name, decision: next ? 'banned' : 'unbanned', reason: '', actorId, createdAt: serverTimestamp() });
    },
    async () => {
      await updateDoc(doc(db(), 'users', profile.id), { isBanned: next, updatedAt: serverTimestamp() });
      if (profile.agentStatus === 'verified') {
        try {
          if (next) await deleteDoc(doc(db(), 'agentsPublic', profile.id));
          else await setDoc(doc(db(), 'agentsPublic', profile.id), publicAgentPayload(profile), { merge: true });
        } catch { /* Directory rules may not be deployed yet. */ }
      }
    },
  );
}

export async function adminSetUserRole(person: Profile, role: 'customer' | 'owner' | 'agent', actorId: string) {
  const userId = assertDocumentId(person.id, 'user');
  if (isSoleSuperAdminProfile(person) || userId === actorId) {
    throw new Error('The sole Superadmin role cannot be changed.');
  }
  const payload = { role, updatedAt: serverTimestamp() };
  return runAuditedAdminAction(
    batch => {
      batch.update(doc(db(), 'users', userId), payload);
      batch.set(doc(collection(db(), 'adminDecisions')), { action: 'userRole', targetId: userId, targetName: person.name, decision: role, reason: '', actorId, createdAt: serverTimestamp() });
    },
    () => updateDoc(doc(db(), 'users', userId), payload),
  );
}

export async function adminSetAgentVerification(person: Profile, verified: boolean, actorId: string) {
  const userId = assertDocumentId(person.id, 'user');
  if (person.isBanned && verified) {
    throw new Error('Restore this account before verifying them as an agent.');
  }
  const nextStatus = verified ? 'verified' : 'none';
  return runAuditedAdminAction(
    batch => {
      batch.update(doc(db(), 'users', userId), { agentStatus: nextStatus, updatedAt: serverTimestamp() });
      if (verified) batch.set(doc(db(), 'agentsPublic', userId), publicAgentPayload(person), { merge: true });
      else batch.delete(doc(db(), 'agentsPublic', userId));
      batch.set(doc(collection(db(), 'adminDecisions')), { action: 'agent', targetId: userId, targetName: person.name, decision: verified ? 'verified' : 'revoked', reason: '', actorId, createdAt: serverTimestamp() });
    },
    async () => {
      await updateDoc(doc(db(), 'users', userId), { agentStatus: nextStatus, updatedAt: serverTimestamp() });
      try {
        if (verified) await setDoc(doc(db(), 'agentsPublic', userId), publicAgentPayload(person), { merge: true });
        else await deleteDoc(doc(db(), 'agentsPublic', userId));
      } catch { /* Directory rules may not be deployed yet. */ }
    },
  );
}

export async function adminDeleteCampaign(adId: string, title: string, actorId: string) {
  const campaignId = assertDocumentId(adId, 'campaign');
  return runAuditedAdminAction(
    batch => {
      batch.delete(doc(db(), 'ads', campaignId));
      batch.set(doc(collection(db(), 'adminDecisions')), { action: 'ad', targetId: campaignId, targetName: title || campaignId, decision: 'deleted', reason: '', actorId, createdAt: serverTimestamp() });
    },
    () => deleteDoc(doc(db(), 'ads', campaignId)),
  );
}

export async function adminCreateUserProfile(
  input: {
    id?: string;
    name: string;
    phone: string;
    email?: string;
    location: string;
    role: 'customer' | 'owner' | 'agent';
    agentStatus?: 'none' | 'verified';
    publicPhone?: string;
    whatsappNumber?: string;
    agentBio?: string;
  },
  actorId: string,
) {
  if (![input.publicPhone || '', input.whatsappNumber || ''].every(validContactNumber)) {
    throw new Error('Enter a valid public phone or WhatsApp number.');
  }
  const uid = (input.id || crypto.randomUUID()).trim();
  const isVerifiedAgent = input.agentStatus === 'verified' || input.role === 'agent';
  const batch = writeBatch(db());
  batch.set(doc(db(), 'usersPublic', uid), {
    name: input.name.trim(),
    photoUrl: null,
    bio: (input.agentBio || '').trim(),
    publicPhone: (input.publicPhone || input.phone || '').trim(),
    whatsappNumber: (input.whatsappNumber || '').trim(),
    updatedAt: serverTimestamp(),
  });
  if (isVerifiedAgent) {
    batch.set(doc(db(), 'agentsPublic', uid), {
      uid,
      name: input.name.trim(),
      location: input.location.trim(),
      photoUrl: null,
      bio: (input.agentBio || '').trim(),
      publicPhone: (input.publicPhone || input.phone || '').trim(),
      whatsappNumber: (input.whatsappNumber || '').trim(),
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  batch.set(doc(collection(db(), 'adminDecisions')), {
    action: 'userProfile',
    targetId: uid,
    targetName: input.name.trim(),
    decision: 'created',
    reason: '',
    actorId,
    createdAt: serverTimestamp(),
  });
  await batch.commit();

  let directoryOnly = false;
  try {
    await setDoc(doc(db(), 'users', uid), {
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: (input.email || '').trim() || null,
      contactEmail: (input.email || '').trim() || null,
      location: input.location.trim(),
      role: input.role,
      agentStatus: isVerifiedAgent ? 'verified' : 'none',
      publicPhone: (input.publicPhone || input.phone || '').trim(),
      whatsappNumber: (input.whatsappNumber || '').trim(),
      agentBio: (input.agentBio || '').trim(),
      isBanned: false,
      photoUrl: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'permission-denied') throw error;
    directoryOnly = true;
  }
  return { id: uid, directoryOnly };
}

export async function adminUpdateUserProfile(
  person: Profile,
  patch: {
    name: string;
    phone: string;
    email?: string;
    location: string;
    role: 'customer' | 'owner' | 'agent';
    agentStatus: 'none' | 'verified';
    isBanned: boolean;
    publicPhone?: string;
    whatsappNumber?: string;
    agentBio?: string;
  },
  actorId: string,
) {
  const userId = assertDocumentId(person.id, 'user');
  if (isSoleSuperAdminProfile(person)) {
    throw new Error('The sole Superadmin profile cannot be modified here.');
  }
  if (![patch.publicPhone || '', patch.whatsappNumber || ''].every(validContactNumber)) {
    throw new Error('Enter a valid public phone or WhatsApp number.');
  }
  if (patch.isBanned && patch.agentStatus === 'verified') {
    throw new Error('Restore this account before verifying them as an agent.');
  }
  const cleanName = patch.name.trim();
  const cleanLocation = patch.location.trim();
  const cleanPhone = patch.phone.trim();
  const cleanEmail = (patch.email || '').trim();
  const cleanPublicPhone = (patch.publicPhone || '').trim();
  const cleanWhatsapp = (patch.whatsappNumber || '').trim();
  const cleanBio = (patch.agentBio || '').trim().slice(0, 500);

  return runAuditedAdminAction(
    batch => {
      batch.update(doc(db(), 'users', userId), {
        name: cleanName,
        phone: cleanPhone,
        contactEmail: cleanEmail || null,
        email: cleanEmail || person.email || null,
        location: cleanLocation,
        role: patch.role,
        agentStatus: patch.agentStatus,
        isBanned: patch.isBanned,
        publicPhone: cleanPublicPhone,
        whatsappNumber: cleanWhatsapp,
        agentBio: cleanBio,
        updatedAt: serverTimestamp(),
      });
      batch.set(
        doc(db(), 'usersPublic', userId),
        {
          name: cleanName,
          photoUrl: person.photoUrl || null,
          bio: cleanBio,
          publicPhone: cleanPublicPhone,
          whatsappNumber: cleanWhatsapp,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      if (patch.agentStatus === 'verified' && !patch.isBanned) {
        batch.set(
          doc(db(), 'agentsPublic', userId),
          {
            uid: userId,
            name: cleanName,
            location: cleanLocation,
            photoUrl: person.photoUrl || null,
            bio: cleanBio,
            publicPhone: cleanPublicPhone,
            whatsappNumber: cleanWhatsapp,
            status: 'active',
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } else {
        batch.delete(doc(db(), 'agentsPublic', userId));
      }
      batch.set(doc(collection(db(), 'adminDecisions')), {
        action: 'userProfile',
        targetId: userId,
        targetName: cleanName,
        decision: 'updated',
        reason: '',
        actorId,
        createdAt: serverTimestamp(),
      });
    },
    () =>
      updateDoc(doc(db(), 'users', userId), {
        name: cleanName,
        phone: cleanPhone,
        contactEmail: cleanEmail || null,
        location: cleanLocation,
        role: patch.role,
        agentStatus: patch.agentStatus,
        isBanned: patch.isBanned,
        updatedAt: serverTimestamp(),
      }),
  );
}

export async function adminDeleteUserProfile(person: Profile, actorId: string) {
  const userId = assertDocumentId(person.id, 'user');
  if (isSoleSuperAdminProfile(person) || userId === actorId) {
    throw new Error('The sole Superadmin account cannot be deleted.');
  }
  return runAuditedAdminAction(
    batch => {
      batch.delete(doc(db(), 'users', userId));
      batch.delete(doc(db(), 'usersPublic', userId));
      batch.delete(doc(db(), 'agentsPublic', userId));
      batch.delete(doc(db(), 'agentApplications', userId));
      batch.set(doc(collection(db(), 'adminDecisions')), {
        action: 'userProfile',
        targetId: userId,
        targetName: person.name,
        decision: 'deleted',
        reason: '',
        actorId,
        createdAt: serverTimestamp(),
      });
    },
    () => deleteDoc(doc(db(), 'users', userId)),
  );
}

export async function adminDeleteInquiry(inquiry: Inquiry, actorId: string) {
  const inquiryId = assertDocumentId(inquiry.id, 'inquiry');
  return runAuditedAdminAction(
    batch => {
      batch.delete(doc(db(), 'inquiries', inquiryId));
      batch.set(doc(collection(db(), 'adminDecisions')), {
        action: 'inquiry',
        targetId: inquiryId,
        targetName: inquiry.listingTitle || inquiry.customerName,
        decision: 'deleted',
        reason: '',
        actorId,
        createdAt: serverTimestamp(),
      });
    },
    () => deleteDoc(doc(db(), 'inquiries', inquiryId)),
  );
}

export async function adminUpdateInquiryStatus(
  inquiry: Inquiry,
  status: 'pending' | 'accepted' | 'declined',
  actorId: string,
  declineReason = '',
) {
  const inquiryId = assertDocumentId(inquiry.id, 'inquiry');
  const payload = {
    status,
    declineReason: status === 'declined' ? declineReason.trim() || null : null,
    updatedAt: serverTimestamp(),
  };
  const result = await runAuditedAdminAction(
    batch => {
      batch.update(doc(db(), 'inquiries', inquiryId), payload);
      batch.set(doc(collection(db(), 'adminDecisions')), {
        action: 'inquiry',
        targetId: inquiryId,
        targetName: inquiry.listingTitle || inquiry.customerName,
        decision: status,
        reason: declineReason.trim(),
        actorId,
        createdAt: serverTimestamp(),
      });
    },
    () => updateDoc(doc(db(), 'inquiries', inquiryId), payload),
  );
  if (status === 'accepted') {
    try {
      await ensureChat(inquiry);
    } catch {
      /* Chat creation is restricted to participants if thread does not exist yet. */
    }
  }
  return result;
}

export async function adminDeleteChatMessage(chatId: string, messageId: string) {
  const cleanChatId = assertDocumentId(chatId, 'chat');
  const cleanMessageId = assertDocumentId(messageId, 'message');
  await deleteDoc(doc(db(), 'chats', cleanChatId, 'messages', cleanMessageId));
}

export async function adminDeleteChat(chatId: string) {
  const cleanChatId = assertDocumentId(chatId, 'chat');
  await deleteDoc(doc(db(), 'chats', cleanChatId));
}

export async function publishAgentProfile(profile: Profile, actorId: string) {
  if (profile.agentStatus !== 'verified' || profile.isBanned) throw new Error('Only an active verified agent can be published.');
  const batch = writeBatch(db());
  batch.set(doc(db(), 'agentsPublic', profile.id), publicAgentPayload(profile), { merge: true });
  batch.set(doc(collection(db(), 'adminDecisions')), { action: 'agentProfile', targetId: profile.id, targetName: profile.name, decision: 'published', reason: '', actorId, createdAt: serverTimestamp() });
  await batch.commit();
}
export async function toggleFavorite(uid: string, listingId: string, active: boolean) {
  const target = doc(db(), 'users', uid, 'favourites', listingId);
  if (active) await deleteDoc(target); else await setDoc(target, { listingId, createdAt: serverTimestamp() });
}
export const countView = (listingId: string) => updateDoc(doc(db(), 'listings', listingId), { viewCount: increment(1) });
