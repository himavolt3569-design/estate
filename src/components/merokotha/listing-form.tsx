"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { GeoPoint } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Camera, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Surface, Textarea } from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/select-menu";
import { createListing } from "@/lib/firebase/actions";
import { cleanContactNumber, validContactNumber } from "@/lib/contact";
import { FACILITY_GROUPS } from "@/lib/listing-facilities";
import {
  DETAIL_TEMPLATES,
  generateListingDetails,
  PROPERTY_LABELS,
  PROPERTY_TYPES,
  TEMPLATES_PER_TYPE,
  type ListingDetailsDraft,
  type PropertyType,
} from "@/lib/listing-details";
import { ListingPhotoPicker } from "./listing-photo-picker";
import { ListingLocationSearch } from "./listing-location-search";
import { useAuth } from "./auth-provider";
import { useSiteLanguage, useSiteText } from "./site-language";

const LocationPickerMap = dynamic(
  () => import("@/components/map/LocationPickerMap"),
  { ssr: false },
);

export function ListingForm() {
  const t = useSiteText();
  const { locale } = useSiteLanguage();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const submissionId = useRef<string | null>(null);
  const [agent, setAgent] = useState(false);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<ListingDetailsDraft>({
    type: "room",
    rent: "",
    deposit: "0",
    floor: "0",
    totalFloors: "1",
    furnishing: "unfurnished",
    availableFrom: new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kathmandu",
    }),
    address: "",
    nearbyLandmarks: "",
    facilities: [],
  });
  const [templateIndex, setTemplateIndex] = useState(0);
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [customDescription, setCustomDescription] = useState<string | null>(
    null,
  );
  const generated = generateListingDetails(draft, templateIndex, locale);
  const titleValue = customTitle ?? generated.title;
  const descriptionValue = customDescription ?? generated.description;
  const setDetail = <K extends keyof ListingDetailsDraft>(
    key: K,
    value: ListingDetailsDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  if (!user || !profile)
    return (
      <Surface className="p-6">
        {t(
          "Sign in and complete your profile to post a rental.",
          "घरजग्गा राख्न साइन इन गरी प्रोफाइल पूरा गर्नुहोस्।",
        )}
      </Surface>
    );
  if (profile.isBanned)
    return (
      <Surface className="p-6">
        {t(
          "This account cannot post listings.",
          "यो खाताबाट विज्ञापन राख्न मिल्दैन।",
        )}
      </Surface>
    );
  const verifiedAgent = profile.agentStatus === "verified";

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const number = (key: string) => Number(form.get(key) || 0);
      const title = String(form.get("title") || "").trim();
      const rent = number("rentPerMonth");
      if (!title || rent <= 0)
        throw new Error("Enter a title and monthly rent greater than zero.");
      if (
        files.some(
          (file) =>
            !file.type.startsWith("image/") || file.size >= 5 * 1024 * 1024,
        )
      ) {
        throw new Error("Each photo must be an image smaller than 5 MB.");
      }
      if (
        agent &&
        (!String(form.get("contactName") || "").trim() ||
          !String(form.get("contactPhone") || "").trim())
      ) {
        throw new Error(
          "The real owner name and phone are required for agent listings.",
        );
      }
      const publicCallNumber = cleanContactNumber(
        String(form.get("publicCallNumber") || ""),
      );
      const publicWhatsAppNumber = cleanContactNumber(
        String(form.get("publicWhatsAppNumber") || ""),
      );
      if (
        !validContactNumber(publicCallNumber) ||
        !validContactNumber(publicWhatsAppNumber)
      ) {
        throw new Error("Enter a valid contact or WhatsApp number.");
      }

      submissionId.current ||= crypto.randomUUID();
      const id = await createListing(
        submissionId.current,
        user.uid,
        form.get("contactIsAnonymous") === "on"
          ? "Private lister"
          : profile.name,
        {
          title,
          roomType: String(form.get("roomType")),
          rentPerMonth: rent,
          depositAmount: number("depositAmount"),
          floor: number("floor"),
          totalFloors: number("totalFloors"),
          furnishing: String(form.get("furnishing")),
          facilities: draft.facilities,
          description: String(form.get("description") || ""),
          address: String(form.get("address") || ""),
          nearbyLandmarks: String(form.get("nearbyLandmarks") || ""),
          availableFrom: new Date(
            String(
              form.get("availableFrom") ||
                new Date().toISOString().slice(0, 10),
            ),
          ),
          geoPoint: point ? new GeoPoint(point.lat, point.lng) : null,
          agentId: agent ? user.uid : null,
          verificationStatus: "pending",
          publicCallNumber,
          publicWhatsAppNumber,
          contactIsAnonymous: form.get("contactIsAnonymous") === "on",
        },
        files,
        agent
          ? {
              name: String(form.get("contactName")),
              phone: String(form.get("contactPhone")),
            }
          : undefined,
      );
      toast.success(t("Rental posted", "घरजग्गा राखियो"));
      router.push(`/listing/${id}`);
    } catch (error) {
      submitting.current = false;
      toast.error(
        error instanceof Error ? error.message : "Could not post listing",
      );
    } finally {
      if (!submitting.current) setBusy(false);
    }
  };

  return (
    <Surface className="overflow-visible p-5 sm:p-7 xl:p-8">
      <div className="mb-7 flex flex-wrap items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-crimson-50 text-crimson-700">
          <Camera aria-hidden className="size-5" />
        </span>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            {t("Post a rental", "घरजग्गा राख्नुहोस्")}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {t(
              "Add the details and photos. Your preview updates as you go.",
              "विवरण र फोटो थप्नुहोस्। पूर्वावलोकन तुरुन्तै बदलिन्छ।",
            )}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {t(
              "Your listing becomes active immediately and enters the admin verification queue.",
              "विज्ञापन तुरुन्त सक्रिय हुन्छ र प्रशासकको समीक्षामा जान्छ।",
            )}
          </p>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start"
      >
        <div className="order-2 min-w-0 space-y-6 xl:order-1">
          <section
            aria-labelledby="property-details-heading"
            className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6"
          >
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-crimson-700">
                01 / {t("Property", "घरजग्गा")}
              </p>
              <h3
                id="property-details-heading"
                className="mt-1 text-lg font-semibold text-ink-900"
              >
                {t("Tell people about the place", "ठाउँबारे जानकारी दिनुहोस्")}
              </h3>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={t("Title", "शीर्षक")}
                htmlFor="title"
                required
                className="sm:col-span-2"
              >
                <Input
                  id="title"
                  name="title"
                  required
                  value={titleValue}
                  onChange={(event) => setCustomTitle(event.target.value)}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  <span>
                    {customTitle === null
                      ? t(
                          "Suggested from your property and location.",
                          "घरजग्गा र स्थानबाट तयार गरिएको शीर्षक।",
                        )
                      : t(
                          "Your title edits are preserved.",
                          "तपाईंले सम्पादन गरेको शीर्षक सुरक्षित छ।",
                        )}
                  </span>
                  {customTitle !== null && (
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
                  )}
                </div>
              </Field>
              <Field label={t("Type", "प्रकार")} htmlFor="roomType">
                <SelectMenu
                  id="roomType"
                  name="roomType"
                  value={draft.type}
                  onValueChange={(value) =>
                    setDetail("type", value as PropertyType)
                  }
                  options={PROPERTY_TYPES.map((type) => ({
                    value: type,
                    label: PROPERTY_LABELS[type][locale],
                  }))}
                />
              </Field>
              <Field
                label={t("Monthly rent (Rs.)", "मासिक भाडा (रु.)")}
                htmlFor="rentPerMonth"
                required
              >
                <Input
                  id="rentPerMonth"
                  name="rentPerMonth"
                  type="number"
                  min="1"
                  required
                  placeholder="25,000"
                  value={draft.rent}
                  onChange={(event) => setDetail("rent", event.target.value)}
                />
              </Field>
              <Field
                label={t("Deposit (Rs.)", "धरौटी (रु.)")}
                htmlFor="depositAmount"
              >
                <Input
                  id="depositAmount"
                  name="depositAmount"
                  type="number"
                  min="0"
                  value={draft.deposit}
                  onChange={(event) => setDetail("deposit", event.target.value)}
                />
              </Field>
              <Field label={t("Furnishing", "फर्निसिङ")} htmlFor="furnishing">
                <SelectMenu
                  id="furnishing"
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
              <Field label={t("Floor", "तला")} htmlFor="floor">
                <Input
                  id="floor"
                  name="floor"
                  type="number"
                  value={draft.floor}
                  onChange={(event) => setDetail("floor", event.target.value)}
                />
              </Field>
              <Field
                label={t("Total floors", "जम्मा तला")}
                htmlFor="totalFloors"
              >
                <Input
                  id="totalFloors"
                  name="totalFloors"
                  type="number"
                  min="1"
                  value={draft.totalFloors}
                  onChange={(event) =>
                    setDetail("totalFloors", event.target.value)
                  }
                />
              </Field>
              <Field
                label={t("Available from", "उपलब्ध हुने मिति")}
                htmlFor="availableFrom"
                className="sm:col-span-2"
              >
                <Input
                  id="availableFrom"
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

          <section
            aria-labelledby="location-heading"
            className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6"
          >
            <div className="mb-5 flex items-start gap-2">
              <MapPin aria-hidden className="mt-0.5 size-5 text-crimson-700" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-crimson-700">
                  02 / {t("Location", "स्थान")}
                </p>
                <h3
                  id="location-heading"
                  className="mt-1 text-lg font-semibold text-ink-900"
                >
                  {t("Help people find it", "ठाउँ पत्ता लगाउन सहयोग गर्नुहोस्")}
                </h3>
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
              <Field label={t("Address", "ठेगाना")} htmlFor="address">
                <Input
                  id="address"
                  name="address"
                  placeholder={t("Street, area, city", "सडक, टोल, शहर")}
                  value={draft.address}
                  onChange={(event) => setDetail("address", event.target.value)}
                />
              </Field>
              <Field
                label={t("Nearby landmarks", "नजिकका चिनारी")}
                htmlFor="nearbyLandmarks"
              >
                <Input
                  id="nearbyLandmarks"
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

          <section
            aria-labelledby="extra-details-heading"
            className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6"
          >
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-crimson-700">
                03 / {t("Details", "विवरण")}
              </p>
              <h3
                id="extra-details-heading"
                className="mt-1 text-lg font-semibold text-ink-900"
              >
                {t("Make the listing useful", "उपयोगी जानकारी थप्नुहोस्")}
              </h3>
            </div>
            <div className="space-y-6">
              <fieldset aria-describedby="facilities-help">
                <legend className="text-sm font-medium text-ink-800">
                  {t("Facilities", "सुविधाहरू")}
                </legend>
                <p id="facilities-help" className="mt-1 text-xs text-ink-500">
                  {t(
                    "Select only the features this property offers.",
                    "यस घरजग्गामा भएका सुविधाहरू मात्र छान्नुहोस्।",
                  )}
                </p>
                <div className="mt-4 space-y-4">
                  {FACILITY_GROUPS.map((group) => (
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
                              checked={draft.facilities.includes(option.value)}
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
                              option.value === "WiFi" ? "Wi-Fi" : option.value,
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
                          "तपाईंले सम्पादन गरेको विवरण सुरक्षित छ।",
                        )}
                  </p>
                  {customDescription === null ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setTemplateIndex(
                          (current) => (current + 1) % TEMPLATES_PER_TYPE,
                        )
                      }
                    >
                      <RefreshCw aria-hidden />
                      {t("Try another template", "अर्को ढाँचा हेर्नुहोस्")}
                    </Button>
                  ) : (
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
                </div>
                <Field label={t("Description", "विवरण")} htmlFor="description">
                  <Textarea
                    id="description"
                    name="description"
                    value={descriptionValue}
                    onChange={(event) =>
                      setCustomDescription(event.target.value)
                    }
                    className="min-h-72"
                    aria-describedby="description-help"
                  />
                </Field>
                <p
                  id="description-help"
                  className="mt-2 text-xs leading-relaxed text-ink-500"
                >
                  {t(
                    "Filled from the property, location and facilities above. Edit freely; your changes stay until you choose suggested details again.",
                    "माथिका घरजग्गा, स्थान र सुविधाबाट तयार गरिएको छ। सम्पादन गर्न सक्नुहुन्छ; सुझाव गरिएको विवरण फेरि नछान्दासम्म तपाईंका परिवर्तन सुरक्षित रहन्छन्।",
                  )}
                </p>
              </div>
            </div>
          </section>

          {verifiedAgent && (
            <section className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6">
              <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
                <input
                  type="checkbox"
                  checked={agent}
                  onChange={(event) => setAgent(event.target.checked)}
                />
                {t(
                  "Post on behalf of a property owner",
                  "घरधनीको तर्फबाट विज्ञापन राख्नुहोस्",
                )}
              </label>
              {agent && (
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field
                    label={t("Real owner name", "वास्तविक घरधनीको नाम")}
                    htmlFor="contactName"
                  >
                    <Input id="contactName" name="contactName" required />
                  </Field>
                  <Field
                    label={t(
                      "Real owner phone (private)",
                      "घरधनीको फोन (गोप्य)",
                    )}
                    htmlFor="contactPhone"
                  >
                    <Input id="contactPhone" name="contactPhone" required />
                  </Field>
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-crimson-700">
              04 / {t("Contact", "सम्पर्क")}
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              {t(
                "How should renters reach you?",
                "भाडामा बस्न चाहनेले कसरी सम्पर्क गर्ने?",
              )}
            </h3>
            <p className="mt-2 text-sm text-ink-500">
              {t(
                "Choose either public contact method, both, or neither. Renters can always send an inquiry here. Agents should use their own numbers; the real owner number above stays private.",
                "फोन वा व्हाट्सएप नम्बर राख्न वा खाली छोड्न सक्नुहुन्छ। यहाँबाट सोधपुछ सधैं पठाउन मिल्छ। एजेन्टले आफ्नो नम्बर राख्नुपर्छ; घरधनीको नम्बर गोप्य रहन्छ।",
              )}
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field
                label={t("Call number (optional)", "फोन नम्बर (वैकल्पिक)")}
                htmlFor="publicCallNumber"
              >
                <Input
                  id="publicCallNumber"
                  name="publicCallNumber"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+977 98XXXXXXXX"
                />
              </Field>
              <Field
                label={t(
                  "WhatsApp number (optional)",
                  "व्हाट्सएप नम्बर (वैकल्पिक)",
                )}
                htmlFor="publicWhatsAppNumber"
              >
                <Input
                  id="publicWhatsAppNumber"
                  name="publicWhatsAppNumber"
                  type="tel"
                  placeholder="+977 98XXXXXXXX"
                />
              </Field>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" name="contactIsAnonymous" />{" "}
              {t(
                "Hide my display name on the public listing",
                "सार्वजनिक विज्ञापनमा मेरो नाम लुकाउनुहोस्",
              )}
            </label>
          </section>

          <Button disabled={busy} className="w-full sm:w-auto">
            {busy
              ? t("Posting…", "राखिँदैछ…")
              : t("Publish rental", "घरजग्गा प्रकाशित गर्नुहोस्")}
          </Button>
        </div>

        <div className="order-1 min-w-0 xl:order-2">
          <ListingPhotoPicker
            onChange={setFiles}
            draft={{ ...draft, title: titleValue }}
            disabled={busy}
          />
        </div>
      </form>
    </Surface>
  );
}
