"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  Input,
  Select,
  Surface,
  Textarea,
} from "@/components/ui/primitives";
import { useAuth } from "@/components/merokotha/auth-provider";
import {
  ListingPhotoEditor,
  type EditablePhoto,
} from "@/components/merokotha/listing-photo-editor";
import { useSignedInText } from "@/components/merokotha/signed-in-copy";
import { uploadImages } from "@/lib/firebase/actions";
import { configured, db, storage } from "@/lib/firebase/client";
import {
  cleanContactNumber,
  listingContact,
  validContactNumber,
} from "@/lib/contact";
import { ListingTourEditor } from "@/components/merokotha/listing-tour-editor";
import type { Listing } from "@/lib/firebase/types";

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!configured || !id) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      doc(db(), "listings", id),
      (snapshot) => {
        setListing(
          snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as Listing)
            : null,
        );
        setLoading(false);
      },
      (error) => {
        toast.error(error.message);
        setLoading(false);
      },
    );
  }, [id]);
  if (loading) return <Surface className="p-8">Loading rental…</Surface>;
  if (!listing) return <Surface className="p-8">Listing unavailable.</Surface>;
  if (!user || user.uid !== listing.ownerId)
    return (
      <Surface className="p-8">
        Only the listing owner can edit this rental.
      </Surface>
    );
  return (
    <EditForm
      key={listing.id}
      listing={listing}
      profileName={profile?.name || listing.ownerName}
    />
  );
}

function EditForm({
  listing,
  profileName,
}: {
  listing: Listing;
  profileName: string;
}) {
  const tr = useSignedInText();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<EditablePhoto[]>(() =>
    (listing.photoUrls || []).map((url) => ({ id: url, url })),
  );
  const contact = listingContact(listing);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const call = cleanContactNumber(String(form.get("publicCallNumber") || ""));
    const whatsapp = cleanContactNumber(
      String(form.get("publicWhatsAppNumber") || ""),
    );
    if (!validContactNumber(call) || !validContactNumber(whatsapp)) {
      toast.error("Enter a valid call or WhatsApp number.");
      return;
    }
    setBusy(true);
    try {
      const added = photos.filter((photo) => photo.file);
      const uploaded = added.length
        ? await uploadImages(
            `listings/${listing.id}`,
            added.map((photo) => photo.file!),
          )
        : [];
      const newUrls = new Map(
        added.map((photo, index) => [photo.id, uploaded[index]!]),
      );
      const photoUrls = photos.map(
        (photo) => newUrls.get(photo.id) || photo.url,
      );
      const anonymous = form.get("contactIsAnonymous") === "on";
      await updateDoc(doc(db(), "listings", listing.id), {
        title: String(form.get("title") || "").trim(),
        roomType: String(form.get("roomType")),
        rentPerMonth: Number(form.get("rentPerMonth")),
        depositAmount: Number(form.get("depositAmount")),
        floor: Number(form.get("floor")),
        totalFloors: Number(form.get("totalFloors")),
        furnishing: String(form.get("furnishing")),
        address: String(form.get("address") || "").trim(),
        nearbyLandmarks: String(form.get("nearbyLandmarks") || "").trim(),
        description: String(form.get("description") || "").trim(),
        facilities: String(form.get("facilities") || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        publicCallNumber: call,
        publicWhatsAppNumber: whatsapp,
        publicContactNumber: deleteField(),
        contactIsAnonymous: anonymous,
        ownerName: anonymous ? "Private lister" : profileName,
        photoUrls,
        verificationStatus: "pending",
        verifiedAt: deleteField(),
        verifiedBy: deleteField(),
        verificationReason: deleteField(),
        reviewedAt: deleteField(),
        reviewedBy: deleteField(),
        reviewReason: deleteField(),
        updatedAt: serverTimestamp(),
      });
      const removed = (listing.photoUrls || []).filter(
        (url) => !photoUrls.includes(url),
      );
      const outcomes = await Promise.allSettled(
        removed.map(async (url) => {
          const item = ref(storage(), url);
          if (item.fullPath.startsWith(`listings/${listing.id}/`))
            await deleteObject(item);
        }),
      );
      if (outcomes.some((result) => result.status === "rejected"))
        toast.warning(
          "Rental saved, but some removed files could not be deleted from storage.",
        );
      else toast.success("Rental updated");
      router.push(`/listing/${listing.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save rental",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Surface className="mx-auto max-w-5xl p-6 md:p-8">
        <h1 className="text-2xl font-semibold">{tr("Edit rental")}</h1>
        <p className="mb-6 mt-2 text-sm text-ink-500">
          {tr(
            "Changing the details or photos sends a verified rental back for review.",
          )}
        </p>
        <form
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
          onSubmit={save}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field label={tr("Title")} htmlFor="edit-title">
              <Input
                id="edit-title"
                name="title"
                defaultValue={listing.title}
                required
              />
            </Field>
            <Field label={tr("Type")} htmlFor="edit-type">
              <Select
                id="edit-type"
                name="roomType"
                defaultValue={listing.roomType}
              >
                {[
                  "room",
                  "flat",
                  "apartment",
                  "house",
                  "office",
                  "shop",
                  "land",
                ].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr("Monthly rent (Rs.)")} htmlFor="edit-rent">
              <Input
                id="edit-rent"
                name="rentPerMonth"
                type="number"
                min="1"
                defaultValue={listing.rentPerMonth}
                required
              />
            </Field>
            <Field label={tr("Deposit (Rs.)")} htmlFor="edit-deposit">
              <Input
                id="edit-deposit"
                name="depositAmount"
                type="number"
                min="0"
                defaultValue={listing.depositAmount || 0}
              />
            </Field>
            <Field label={tr("Floor")} htmlFor="edit-floor">
              <Input
                id="edit-floor"
                name="floor"
                type="number"
                defaultValue={listing.floor || 0}
              />
            </Field>
            <Field label={tr("Total floors")} htmlFor="edit-total-floors">
              <Input
                id="edit-total-floors"
                name="totalFloors"
                type="number"
                min="1"
                defaultValue={listing.totalFloors || 1}
              />
            </Field>
            <Field label={tr("Address")} htmlFor="edit-address">
              <Input
                id="edit-address"
                name="address"
                defaultValue={listing.address || ""}
              />
            </Field>
            <Field label={tr("Nearby landmarks")} htmlFor="edit-landmarks">
              <Input
                id="edit-landmarks"
                name="nearbyLandmarks"
                defaultValue={listing.nearbyLandmarks || ""}
              />
            </Field>
            <Field label={tr("Furnishing")} htmlFor="edit-furnishing">
              <Select
                id="edit-furnishing"
                name="furnishing"
                defaultValue={listing.furnishing || "unfurnished"}
              >
                <option value="unfurnished">Unfurnished</option>
                <option value="semiFurnished">Semi furnished</option>
                <option value="furnished">Furnished</option>
              </Select>
            </Field>
            <Field
              label={tr("Facilities, separated by commas")}
              htmlFor="edit-facilities"
            >
              <Input
                id="edit-facilities"
                name="facilities"
                defaultValue={(listing.facilities || []).join(", ")}
              />
            </Field>
            <Field
              label={tr("Description")}
              htmlFor="edit-description"
              className="md:col-span-2"
            >
              <Textarea
                id="edit-description"
                name="description"
                defaultValue={listing.description || ""}
              />
            </Field>
            <Field label={tr("Call number (optional)")} htmlFor="edit-call">
              <Input
                id="edit-call"
                name="publicCallNumber"
                type="tel"
                defaultValue={contact.call}
              />
            </Field>
            <Field
              label={tr("WhatsApp number (optional)")}
              htmlFor="edit-whatsapp"
            >
              <Input
                id="edit-whatsapp"
                name="publicWhatsAppNumber"
                type="tel"
                defaultValue={contact.whatsapp}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                name="contactIsAnonymous"
                defaultChecked={listing.contactIsAnonymous || false}
              />{" "}
              Hide my display name on the public listing
            </label>
            <Button disabled={busy} className="md:col-span-2">
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
          <ListingPhotoEditor
            photos={photos}
            onChange={setPhotos}
            disabled={busy}
          />
        </form>
      </Surface>
      <ListingTourEditor listing={listing} />
    </>
  );
}
