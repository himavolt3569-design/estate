"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import {
  GeoPoint,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { Camera, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  Input,
  Surface,
  Textarea,
} from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/select-menu";
import { useAuth } from "@/components/hamrokotha/auth-provider";
import { LandFields } from "@/components/hamrokotha/land-fields";
import { ListingLocationSearch } from "@/components/hamrokotha/listing-location-search";
import {
  ListingPhotoEditor,
  type EditablePhoto,
} from "@/components/hamrokotha/listing-photo-editor";
import { ListingTourEditor } from "@/components/hamrokotha/listing-tour-editor";
import { useSignedInText } from "@/components/hamrokotha/signed-in-copy";
import {
  useSiteLanguage,
  useSiteText,
} from "@/components/hamrokotha/site-language";
import {
  cleanContactNumber,
  listingContact,
  validContactNumber,
} from "@/lib/contact";
import { uploadImages } from "@/lib/firebase/actions";
import { configured, db, storage } from "@/lib/firebase/client";
import type { Listing } from "@/lib/firebase/types";
import { landFromForm } from "@/lib/land";
import {
  canSell,
  isForSale,
  listingPrice,
  validListingPrice,
  type TransactionType,
} from "@/lib/listing-commerce";
import {
  DETAIL_TEMPLATES,
  PROPERTY_LABELS,
  PROPERTY_TYPES,
  TEMPLATES_PER_TYPE,
  generateListingDetails,
  type ListingDetailsDraft,
  type PropertyType,
} from "@/lib/listing-details";
import { FACILITY_GROUPS, LAND_FACILITIES } from "@/lib/listing-facilities";

const LocationPickerMap = dynamic(
  () => import("@/components/map/LocationPickerMap"),
  { ssr: false },
);

function formatDateInput(value: Listing["availableFrom"]) {
  if (!value) {
    return new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kathmandu",
    });
  }
  const date =
    value instanceof Date
      ? value
      : typeof (value as { toDate?: () => Date } | undefined)?.toDate ===
          "function"
        ? (value as { toDate: () => Date }).toDate()
        : new Date();
  return Number.isNaN(date.getTime())
    ? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" })
    : date.toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });
}

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

  const isSuperAdmin = profile?.role === "superAdmin";
  if (loading) return <Surface className="p-8">Loading rental…</Surface>;
  if (!listing) return <Surface className="p-8">Listing unavailable.</Surface>;
  const canEdit = Boolean(
    user && (user.uid === listing.ownerId || isSuperAdmin),
  );
  if (!canEdit) {
    return (
      <Surface className="p-8">
        Only the listing owner can edit this rental.
      </Surface>
    );
  }

  const editingAsAdmin = Boolean(isSuperAdmin && user?.uid !== listing.ownerId);
  return (
    <div className="space-y-8">
      <EditForm
        key={listing.id}
        listing={listing}
        profileName={
          editingAsAdmin
            ? listing.ownerName || "Property lister"
            : profile?.name || listing.ownerName
        }
        editingAsAdmin={editingAsAdmin}
      />
      <ListingTourEditor listing={listing} />
    </div>
  );
}

function EditForm({
  listing,
  profileName,
  editingAsAdmin = false,
}: {
  listing: Listing;
  profileName: string;
  editingAsAdmin?: boolean;
}) {
  const tr = useSignedInText();
  const t = useSiteText();
  const { locale } = useSiteLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>(
    isForSale(listing) ? "sale" : "rent",
  );
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(() =>
    listing.geoPoint
      ? { lat: listing.geoPoint.latitude, lng: listing.geoPoint.longitude }
      : null,
  );
  const [photos, setPhotos] = useState<EditablePhoto[]>(() =>
    (listing.photoUrls || []).map((url) => ({ id: url, url })),
  );
  const [draft, setDraft] = useState<ListingDetailsDraft>(() => ({
    type: (PROPERTY_TYPES.includes(listing.roomType as PropertyType)
      ? listing.roomType
      : "room") as PropertyType,
    land: listing.land || null,
    rent: String(listingPrice(listing) || ""),
    deposit: String(listing.depositAmount ?? 0),
    floor: String(listing.floor ?? 0),
    totalFloors: String(listing.totalFloors ?? 1),
    furnishing: listing.furnishing || "unfurnished",
    availableFrom: formatDateInput(listing.availableFrom),
    address: listing.address || "",
    nearbyLandmarks: listing.nearbyLandmarks || "",
    facilities: listing.facilities || [],
  }));
  const [templateIndex, setTemplateIndex] = useState(0);
  const [customTitle, setCustomTitle] = useState<string | null>(
    listing.title || "",
  );
  const [customDescription, setCustomDescription] = useState<string | null>(
    listing.description || "",
  );

  const contact = listingContact(listing);
  const generated = generateListingDetails(
    { ...draft, transactionType },
    templateIndex,
    locale,
  );
  const titleValue = customTitle ?? generated.title;
  const descriptionValue = customDescription ?? generated.description;

  const setDetail = <K extends keyof ListingDetailsDraft>(
    key: K,
    value: ListingDetailsDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (window.location.hash !== "#edit-call") return;
    const input = document.getElementById("edit-call");
    input?.focus({ preventScroll: true });
    input?.scrollIntoView({ block: "center" });
  }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const call = cleanContactNumber(
      String(form.get("publicCallNumber") || ""),
    );
    const whatsapp = cleanContactNumber(
      String(form.get("publicWhatsAppNumber") || ""),
    );
    if (!validContactNumber(call) || !validContactNumber(whatsapp)) {
      toast.error("Enter a valid call or WhatsApp number.");
      return;
    }
    const priceValue = Number(form.get("rentPerMonth"));
    if (!validListingPrice(draft.type, transactionType, priceValue)) {
      toast.error("Enter a valid price. Flats are rental-only.");
      return;
    }
    setBusy(true);
    try {
      const land =
        draft.type === "land"
          ? landFromForm(
              form,
              listing.roomType !== "land" || Boolean(listing.land),
            )
          : null;
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
      const verificationPatch = editingAsAdmin
        ? {
            verificationStatus: listing.verificationStatus || "pending",
          }
        : {
            verificationStatus: "pending",
            verifiedAt: deleteField(),
            verifiedBy: deleteField(),
            verificationReason: deleteField(),
            reviewedAt: deleteField(),
            reviewedBy: deleteField(),
            reviewReason: deleteField(),
          };
      await updateDoc(doc(db(), "listings", listing.id), {
        title: String(form.get("title") || "").trim(),
        roomType: draft.type,
        transactionType,
        purpose: transactionType,
        rentPerMonth: transactionType === "sale" ? 0 : priceValue,
        salePrice: transactionType === "sale" ? priceValue : 0,
        depositAmount:
          transactionType === "sale" ? 0 : Number(form.get("depositAmount") || 0),
        land,
        floor:
          draft.type === "land"
            ? deleteField()
            : Number(form.get("floor") || 0),
        totalFloors:
          draft.type === "land"
            ? deleteField()
            : Number(form.get("totalFloors") || 1),
        furnishing:
          draft.type === "land" ? deleteField() : draft.furnishing,
        address: String(form.get("address") || "").trim(),
        nearbyLandmarks: String(form.get("nearbyLandmarks") || "").trim(),
        availableFrom: new Date(
          String(
            form.get("availableFrom") ||
              new Date().toISOString().slice(0, 10),
          ),
        ),
        geoPoint: point ? new GeoPoint(point.lat, point.lng) : null,
        description: String(form.get("description") || "").trim(),
        facilities: draft.facilities,
        publicCallNumber: call,
        publicWhatsAppNumber: whatsapp,
        publicContactNumber: deleteField(),
        contactIsAnonymous: anonymous,
        ownerName: anonymous ? "Private lister" : profileName,
        photoUrls,
        ...verificationPatch,
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
      if (outcomes.some((result) => result.status === "rejected")) {
        toast.warning(
          "Rental saved, but some removed files could not be deleted from storage.",
        );
      } else {
        toast.success("Rental updated");
      }
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
    <Surface className="overflow-visible p-5 sm:p-7 xl:p-8">
      {editingAsAdmin && (
        <div className="mb-6 rounded-xl border border-royal-200 bg-royal-50 px-4 py-3 text-sm text-royal-900">
          <strong className="font-semibold">Superadmin Mode:</strong>{" "}
          {t(
            `Editing this property on behalf of ${listing.ownerName || "the owner"}. Existing verification status is preserved.`,
            `${listing.ownerName || "घरधनी"} को तर्फबाट यो घरजग्गा सम्पादन गर्दै हुनुहुन्छ। हालको प्रमाणीकरण अवस्था यथावत् रहन्छ।`,
          )}
        </div>
      )}

      <div className="mb-7 flex flex-wrap items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-crimson-50 text-crimson-700">
          <Camera aria-hidden className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            {tr("Edit rental")}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {editingAsAdmin
              ? t(
                  "Update any detail, location, facilities, auto-generated copy, or photos. Your preview updates as you go.",
                  "विवरण, स्थान, सुविधा, सुझाव गरिएको विवरण वा फोटो सम्पादन गर्नुहोस्। पूर्वावलोकन तुरुन्तै बदलिन्छ।",
                )
              : tr(
                  "Changing the details or photos sends a verified rental back for review.",
                )}
          </p>
        </div>
      </div>

      <form
        onSubmit={save}
        className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start"
      >
        <div className="order-2 min-w-0 space-y-6 xl:order-1">
          {/* 01 / Property */}
          <section
            aria-labelledby="edit-property-heading"
            className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6"
          >
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-crimson-700">
                01 / {t("Property", "घरजग्गा")}
              </p>
              <h2
                id="edit-property-heading"
                className="mt-1 text-lg font-semibold text-ink-900"
              >
                {t("Tell people about the place", "ठाउँबारे जानकारी दिनुहोस्")}
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={tr("Title")}
                htmlFor="edit-title"
                required
                className="sm:col-span-2"
              >
                <Input
                  id="edit-title"
                  name="title"
                  required
                  value={titleValue}
                  onChange={(event) => setCustomTitle(event.target.value)}
                />
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                  <span>
                    {customTitle === null
                      ? t(
                          "Suggested from your property and location.",
                          "घरजग्गा र स्थानबाट तयार गरिएको शीर्षक।",
                        )
                      : t(
                          "Your title edits are preserved.",
                          "तपाईंले राखेको शीर्षक सुरक्षित छ।",
                        )}
                  </span>
                  {customTitle !== null ? (
                    <button
                      type="button"
                      className="font-medium text-royal-700 underline"
                      onClick={() => setCustomTitle(null)}
                    >
                      {t(
                        "Use suggested title",
                        "सुझाव गरिएको शीर्षक प्रयोग गर्नुहोस्",
                      )}
                    </button>
                  ) : (
                    listing.title && (
                      <button
                        type="button"
                        className="font-medium text-ink-600 underline"
                        onClick={() => setCustomTitle(listing.title)}
                      >
                        {t("Keep saved title", "पुरानै शीर्षक राख्नुहोस्")}
                      </button>
                    )
                  )}
                </div>
              </Field>

              <Field label={tr("Type")} htmlFor="edit-type">
                <SelectMenu
                  id="edit-type"
                  name="roomType"
                  value={draft.type}
                  onValueChange={(value) => {
                    setDraft((current) => ({
                      ...current,
                      type: value as PropertyType,
                      facilities:
                        value === "land"
                          ? current.facilities.filter((item) =>
                              LAND_FACILITIES.includes(item),
                            )
                          : current.facilities,
                    }));
                    if (!canSell(value)) setTransactionType("rent");
                  }}
                  options={PROPERTY_TYPES.map((type) => ({
                    value: type,
                    label: PROPERTY_LABELS[type][locale],
                  }))}
                />
              </Field>

              <Field
                label={t("Listing purpose", "विज्ञापनको उद्देश्य")}
                htmlFor="edit-purpose"
              >
                <SelectMenu
                  id="edit-purpose"
                  value={transactionType}
                  onValueChange={(value) =>
                    setTransactionType(value as TransactionType)
                  }
                  options={[
                    { value: "rent", label: t("Rent", "भाडा") },
                    ...(canSell(draft.type)
                      ? [{ value: "sale", label: t("Sell", "बिक्री") }]
                      : []),
                  ]}
                />
                {draft.type === "flat" && (
                  <p className="mt-1 text-xs text-ink-500">
                    {t(
                      "Flats are available for rent only.",
                      "फ्ल्याट भाडाका लागि मात्र राख्न मिल्छ।",
                    )}
                  </p>
                )}
              </Field>

              <Field
                label={
                  transactionType === "sale"
                    ? t(
                        draft.type === "land"
                          ? "Total asking price (Rs.)"
                          : "Asking price (Rs.)",
                        "बिक्री मूल्य (रु.)",
                      )
                    : tr("Monthly rent (Rs.)")
                }
                htmlFor="edit-rent"
                required
              >
                <Input
                  id="edit-rent"
                  name="rentPerMonth"
                  type="number"
                  min="1"
                  required
                  value={draft.rent}
                  onChange={(event) => setDetail("rent", event.target.value)}
                />
              </Field>

              {transactionType === "rent" && (
                <Field label={tr("Deposit (Rs.)")} htmlFor="edit-deposit">
                  <Input
                    id="edit-deposit"
                    name="depositAmount"
                    type="number"
                    min="0"
                    value={draft.deposit}
                    onChange={(event) =>
                      setDetail("deposit", event.target.value)
                    }
                  />
                </Field>
              )}

              {draft.type === "land" ? (
                <LandFields
                  value={draft.land}
                  required={
                    listing.roomType !== "land" || Boolean(listing.land)
                  }
                  onChange={(form) => {
                    try {
                      setDetail("land", landFromForm(form, false));
                    } catch {
                      setDetail("land", null);
                    }
                  }}
                />
              ) : (
                <>
                  <Field label={tr("Furnishing")} htmlFor="edit-furnishing">
                    <SelectMenu
                      id="edit-furnishing"
                      name="furnishing"
                      value={draft.furnishing}
                      onValueChange={(value) => setDetail("furnishing", value)}
                      options={[
                        {
                          value: "unfurnished",
                          label: t("Unfurnished", "फर्निसिङ नभएको"),
                        },
                        {
                          value: "semiFurnished",
                          label: t("Semi furnished", "आंशिक फर्निसिङ"),
                        },
                        {
                          value: "furnished",
                          label: t("Furnished", "फर्निसिङ भएको"),
                        },
                      ]}
                    />
                  </Field>

                  <Field label={tr("Floor")} htmlFor="edit-floor">
                    <Input
                      id="edit-floor"
                      name="floor"
                      type="number"
                      value={draft.floor}
                      onChange={(event) =>
                        setDetail("floor", event.target.value)
                      }
                    />
                  </Field>

                  <Field label={tr("Total floors")} htmlFor="edit-total-floors">
                    <Input
                      id="edit-total-floors"
                      name="totalFloors"
                      type="number"
                      min="1"
                      value={draft.totalFloors}
                      onChange={(event) =>
                        setDetail("totalFloors", event.target.value)
                      }
                    />
                  </Field>
                </>
              )}

              <Field
                label={t("Available from", "उपलब्ध हुने मिति")}
                htmlFor="edit-available-from"
                className="sm:col-span-2"
              >
                <Input
                  id="edit-available-from"
                  name="availableFrom"
                  type="date"
                  value={draft.availableFrom}
                  onChange={(event) =>
                    setDetail("availableFrom", event.target.value)
                  }
                />
              </Field>
            </div>
          </section>

          {/* 02 / Location */}
          <section
            aria-labelledby="edit-location-heading"
            className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6"
          >
            <div className="mb-5 flex items-start gap-2">
              <MapPin aria-hidden className="mt-0.5 size-5 text-crimson-700" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-crimson-700">
                  02 / {t("Location", "स्थान")}
                </p>
                <h2
                  id="edit-location-heading"
                  className="mt-1 text-lg font-semibold text-ink-900"
                >
                  {t(
                    "Help people find it",
                    "ठाउँ पत्ता लगाउन सहयोग गर्नुहोस्",
                  )}
                </h2>
              </div>
            </div>

            <ListingLocationSearch
              onSelect={(place) => {
                setDraft((current) => ({
                  ...current,
                  address: place.address,
                  nearbyLandmarks: place.name,
                }));
                setPoint({ lat: place.lat, lng: place.lng });
              }}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={tr("Address")} htmlFor="edit-address">
                <Input
                  id="edit-address"
                  name="address"
                  placeholder={t("Street, area, city", "सडक, टोल, शहर")}
                  value={draft.address}
                  onChange={(event) => setDetail("address", event.target.value)}
                />
              </Field>
              <Field label={tr("Nearby landmarks")} htmlFor="edit-landmarks">
                <Input
                  id="edit-landmarks"
                  name="nearbyLandmarks"
                  value={draft.nearbyLandmarks}
                  onChange={(event) =>
                    setDetail("nearbyLandmarks", event.target.value)
                  }
                />
              </Field>
            </div>

            <p className="mb-2 mt-5 text-sm font-medium text-ink-800">
              {t("Choose a map location", "नक्सामा स्थान छान्नुहोस्")}
            </p>
            <LocationPickerMap
              initialPosition={point || undefined}
              onChange={setPoint}
              className="h-72 rounded-xl"
            />
          </section>

          {/* 03 / Details & Auto-generate */}
          <section
            aria-labelledby="edit-details-heading"
            className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6"
          >
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-crimson-700">
                03 / {t("Details", "विवरण")}
              </p>
              <h2
                id="edit-details-heading"
                className="mt-1 text-lg font-semibold text-ink-900"
              >
                {t("Make the listing useful", "उपयोगी जानकारी थप्नुहोस्")}
              </h2>
            </div>

            <div className="space-y-6">
              <fieldset aria-describedby="edit-facilities-help">
                <legend className="text-sm font-medium text-ink-800">
                  {t("Facilities", "सुविधाहरू")}
                </legend>
                <p
                  id="edit-facilities-help"
                  className="mt-1 text-xs text-ink-500"
                >
                  {t(
                    "Select only the features this property offers.",
                    "यस घरजग्गामा भएका सुविधाहरू मात्र छान्नुहोस्।",
                  )}
                </p>
                <div className="mt-4 space-y-4">
                  {FACILITY_GROUPS.map((group) => ({
                    ...group,
                    options: group.options.filter(
                      (option) =>
                        draft.type !== "land" ||
                        LAND_FACILITIES.includes(option.value),
                    ),
                  }))
                    .filter((group) => group.options.length)
                    .map((group) => (
                      <div key={group.label}>
                        <p className="mb-2 text-xs font-semibold text-ink-500">
                          {t(group.label, group.ne)}
                        </p>
                        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                          {group.options.map((option) => (
                            <label
                              key={option.value}
                              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink-700 hover:bg-ink-50"
                            >
                              <input
                                type="checkbox"
                                name="facilities"
                                value={option.value}
                                checked={draft.facilities.includes(
                                  option.value,
                                )}
                                onChange={(event) =>
                                  setDetail(
                                    "facilities",
                                    event.target.checked
                                      ? [...draft.facilities, option.value]
                                      : draft.facilities.filter(
                                          (value) => value !== option.value,
                                        ),
                                  )
                                }
                                className="size-4 shrink-0 accent-royal-700"
                              />
                              {t(
                                option.value === "WiFi"
                                  ? "Wi-Fi"
                                  : option.value,
                                option.ne,
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </fieldset>

              <div className="border-t border-ink-100 pt-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-ink-500">
                    {customDescription === null
                      ? t(
                          `Template ${templateIndex + 1} of ${TEMPLATES_PER_TYPE} for this type · ${DETAIL_TEMPLATES.length} total`,
                          `यस प्रकारको ढाँचा ${templateIndex + 1} / ${TEMPLATES_PER_TYPE} · जम्मा ${DETAIL_TEMPLATES.length}`,
                        )
                      : t(
                          "Your description edits are preserved.",
                          "तपाईंले राखेको विवरण सुरक्षित छ।",
                        )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {customDescription !== null && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setCustomDescription(null)}
                      >
                        {t(
                          "Use suggested details",
                          "सुझाव गरिएको विवरण प्रयोग गर्नुहोस्",
                        )}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (customDescription !== null) {
                          setCustomDescription(null);
                        } else {
                          setTemplateIndex(
                            (current) => (current + 1) % TEMPLATES_PER_TYPE,
                          );
                        }
                      }}
                    >
                      <RefreshCw aria-hidden />
                      {t("Try another template", "अर्को ढाँचा हेर्नुहोस्")}
                    </Button>
                  </div>
                </div>
                <Field label={tr("Description")} htmlFor="edit-description">
                  <Textarea
                    id="edit-description"
                    name="description"
                    value={descriptionValue}
                    onChange={(event) =>
                      setCustomDescription(event.target.value)
                    }
                    className="min-h-72"
                    aria-describedby="edit-description-help"
                  />
                </Field>
                <p
                  id="edit-description-help"
                  className="mt-2 text-xs leading-relaxed text-ink-500"
                >
                  {t(
                    "Auto-generated details use the property, location and facilities above. Edit freely at any time.",
                    "माथिका घरजग्गा, स्थान र सुविधाबाट सुझाव गरिएको विवरण तयार हुन्छ। तपाईंले चाहेअनुसार सम्पादन गर्न सक्नुहुन्छ।",
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* 04 / Contact */}
          <section
            aria-labelledby="edit-contact-heading"
            className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-crimson-700">
              04 / {t("Contact", "सम्पर्क")}
            </p>
            <h2
              id="edit-contact-heading"
              className="mt-1 text-lg font-semibold text-ink-900"
            >
              {t(
                "How should renters reach you?",
                "भाडामा बस्न चाहनेले कसरी सम्पर्क गर्ने?",
              )}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label={tr("Call number (optional)")} htmlFor="edit-call">
                <Input
                  id="edit-call"
                  className="scroll-mt-28"
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
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                name="contactIsAnonymous"
                defaultChecked={listing.contactIsAnonymous || false}
              />{" "}
              {t(
                "Hide my display name on the public listing",
                "सार्वजनिक विज्ञापनमा मेरो नाम लुकाउनुहोस्",
              )}
            </label>
          </section>

          <Button disabled={busy} className="w-full sm:w-auto">
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>

        <div className="order-1 min-w-0 xl:order-2">
          <ListingPhotoEditor
            photos={photos}
            onChange={setPhotos}
            disabled={busy}
            draft={{
              transactionType,
              ...draft,
              title: titleValue,
            }}
          />
        </div>
      </form>
    </Surface>
  );
}
