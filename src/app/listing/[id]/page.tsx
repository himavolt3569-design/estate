"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Eye,
  Heart,
  Layers3,
  MapPin,
  Phone,
  Sofa,
  Wallet,
  Home,
} from "lucide-react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { Seal } from "@/components/brand/Seal";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Field,
  Input,
  Surface,
  Textarea,
} from "@/components/ui/primitives";
import { sendInquiry, toggleFavorite } from "@/lib/firebase/actions";
import { configured, db } from "@/lib/firebase/client";
import type { Listing } from "@/lib/firebase/types";
import { useAuth } from "@/components/merokotha/auth-provider";
import { money } from "@/components/merokotha/listing-card";
import { useSiteLanguage } from "@/components/merokotha/site-language";
import { listingContact, whatsAppNumber } from "@/lib/contact";
import { recordListingVisit } from "@/lib/firebase/property-features";
import { ListingTour } from "@/components/merokotha/listing-tour";
import { ListingReportForm } from "@/components/merokotha/listing-report";

export default function ListingPage() {
  const { ui, locale } = useSiteLanguage();
  const { id } = useParams<{ id: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agentName, setAgentName] = useState("Agent");
  const [agentProfileAvailable, setAgentProfileAvailable] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (!configured || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setListing(null);
    setActivePhoto(0);
    const stop = onSnapshot(
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
        setListing(null);
        if (error.code !== "permission-denied")
          toast.error("Could not load this rental. Please try again.");
        setLoading(false);
      },
    );
    return stop;
  }, [id]);

  useEffect(() => {
    if (!user || !id) {
      setFavorite(false);
      return;
    }
    void getDoc(doc(db(), "users", user.uid, "favourites", id))
      .then((snapshot) => setFavorite(snapshot.exists()))
      .catch(() => {});
  }, [user, id]);

  useEffect(() => {
    if (!listing?.agentId) {
      setAgentProfileAvailable(false);
      return;
    }
    let current = true;
    void getDoc(doc(db(), "agentsPublic", listing.agentId))
      .then(async (snapshot) => {
        if (!current) return;
        if (snapshot.exists()) {
          setAgentName(String(snapshot.data().name || "Agent"));
          setAgentProfileAvailable(true);
        } else if (user) {
          const fallback = await getDoc(
            doc(db(), "usersPublic", listing.ownerId),
          );
          if (current) setAgentName(String(fallback.data()?.name || "Agent"));
        }
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [user, listing?.agentId, listing?.ownerId]);

  useEffect(() => {
    if (listing && !authLoading) void recordListingVisit(listing, user?.uid);
  }, [listing, user?.uid, authLoading]);

  if (loading)
    return (
      <Surface className="p-8 text-sm text-ink-500">
        {ui.loadingDetails}
      </Surface>
    );
  if (!listing)
    return (
      <Surface className="p-8">
        <h1 className="text-xl font-semibold">{ui.unavailable}</h1>
        <p className="mt-2 text-sm text-ink-500">{ui.unavailableText}</p>
        <Button asChild variant="secondary" className="mt-5">
          <Link href="/">{ui.browse}</Link>
        </Button>
      </Surface>
    );

  const position = listing.geoPoint;
  const photos = listing.photoUrls || [];
  const contact = listingContact(listing);
  const details = [
    {
      label: ui.propertyTypeLabel,
      value: listing.roomType || ui.notProvided,
      icon: Home,
    },
    {
      label: ui.deposit,
      value:
        listing.depositAmount != null
          ? money(listing.depositAmount)
          : ui.notProvided,
      icon: Wallet,
    },
    {
      label: ui.floor,
      value:
        listing.floor != null
          ? listing.totalFloors != null
            ? `${listing.floor} / ${listing.totalFloors}`
            : String(listing.floor)
          : ui.notProvided,
      icon: Layers3,
    },
    {
      label: ui.furnishing,
      value: listing.furnishing || ui.notProvided,
      icon: Sofa,
    },
    {
      label: ui.available,
      value: listing.availableFrom
        ? (listing.availableFrom instanceof Date
            ? listing.availableFrom
            : typeof listing.availableFrom.toDate === "function"
              ? listing.availableFrom.toDate()
              : new Date()
          ).toLocaleDateString(locale === "ne" ? "ne-NP" : "en-NP", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : ui.notProvided,
      icon: CalendarDays,
    },
    { label: ui.views, value: String(listing.viewCount || 0), icon: Eye },
  ];

  return (
    <div className="pb-12">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-2 text-sm text-ink-500"
      >
        <Link href="/" className="flex items-center gap-1 hover:text-royal-700">
          <ArrowLeft aria-hidden className="size-4" /> {ui.back}
        </Link>
        <span aria-hidden>/</span>
        <span className="max-w-[60vw] truncate text-ink-800">
          {listing.title}
        </span>
      </nav>

      {photos.length ? (
        <section
          aria-label="Property photos"
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_96px]"
        >
          <div className="relative flex h-[260px] items-center justify-center overflow-hidden rounded-2xl bg-ink-100 sm:h-[380px] lg:h-[440px]">
            <img
              src={photos[Math.min(activePhoto, photos.length - 1)]}
              alt={`${listing.title}, photo ${Math.min(activePhoto, photos.length - 1) + 1} of ${photos.length}`}
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-3 right-3 rounded-full bg-royal-950/80 px-3 py-1 text-xs font-medium text-white">
              {Math.min(activePhoto, photos.length - 1) + 1} / {photos.length}
            </span>
          </div>
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[440px] lg:flex-col lg:overflow-y-auto lg:pb-0">
              {photos.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  onClick={() => setActivePhoto(index)}
                  aria-label={`Show photo ${index + 1}`}
                  aria-pressed={activePhoto === index}
                  className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 sm:h-20 sm:w-24 ${activePhoto === index ? "border-crimson-600" : "border-transparent hover:border-ink-300"}`}
                >
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="flex h-[240px] items-center justify-center rounded-2xl bg-ink-100 text-ink-400 sm:h-[360px]">
          {ui.noPhoto}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-10">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="royal">{ui.forRent}</Badge>
              <Badge>{listing.roomType || ui.propertyType}</Badge>
              {listing.agentId && <Badge tone="royal">{ui.agentListing}</Badge>}
              {listing.verificationStatus === "verified" && (
                <Badge tone="verified">
                  <Seal size={12} /> {ui.verifiedListing}
                </Badge>
              )}
            </div>
            {listing.verificationStatus === "rejected" &&
              listing.verificationReason && (
                <p className="mt-4 rounded-lg bg-clay-50 p-3 text-sm text-clay-700">
                  {ui.reviewNote}: {listing.verificationReason}
                </p>
              )}
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
              {listing.title}
            </h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500">
              <MapPin aria-hidden className="size-4" />
              {listing.address || ui.locationOnMap}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-4xl font-semibold tracking-tight text-ink-900">
                {money(listing.rentPerMonth)}{" "}
                <span className="text-base font-normal text-ink-500">
                  {ui.month}
                </span>
              </p>
              {user && user.uid !== listing.ownerId && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void toggleFavorite(user.uid, id, favorite)
                      .then(() => setFavorite(!favorite))
                      .catch((error) => toast.error(error.message))
                  }
                >
                  <Heart
                    aria-hidden
                    className={`size-4 ${favorite ? "fill-current text-crimson-600" : ""}`}
                  />
                  {favorite ? ui.savedLabel : ui.save}
                </Button>
              )}
            </div>
          </header>

          <ListingTour scenes={listing.tourScenes} />

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200 sm:grid-cols-3">
            {details.map((item) => (
              <div key={item.label} className="bg-white p-4">
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
                  <item.icon aria-hidden className="size-4" />
                  {item.label}
                </dt>
                <dd className="mt-2 break-words text-sm font-semibold text-ink-900">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          <section className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-7">
            <p className="label text-crimson-700">{ui.fromLister}</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-900">
              {ui.about}
            </h2>
            <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-ink-700">
              {listing.description || ui.noDescription}
            </p>
          </section>

          {Boolean(listing.facilities?.length) && (
            <section>
              <p className="label text-crimson-700">{ui.whatItHas}</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink-900">
                {ui.facilities}
              </h2>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {listing.facilities?.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-ink-700">
                    <span aria-hidden className="text-emerald-700">
                      •
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <p className="label text-crimson-700">{ui.findIt}</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-900">
              {ui.location}
            </h2>
            <p className="mt-3 text-sm text-ink-600">
              {listing.address || ui.addressMissing}
              {listing.nearbyLandmarks
                ? ` · ${ui.near} ${listing.nearbyLandmarks}`
                : ""}
            </p>
            {position && (
              <a
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-royal-700 underline underline-offset-4"
                target="_blank"
                rel="noreferrer"
                href={`https://www.openstreetmap.org/?mlat=${position.latitude}&mlon=${position.longitude}#map=16/${position.latitude}/${position.longitude}`}
              >
                {ui.openMap} <ExternalLink aria-hidden className="size-4" />
              </a>
            )}
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24">
          <Surface className="p-6">
            <p className="label">{ui.monthlyRent}</p>
            <p className="mt-2 text-3xl font-semibold text-royal-700">
              {money(listing.rentPerMonth)}
            </p>
            <p className="mt-4 border-t border-ink-100 pt-4 text-sm text-ink-600">
              {ui.listedBy}{" "}
              {listing.agentId &&
              agentProfileAvailable &&
              !listing.contactIsAnonymous ? (
                <Link
                  href={`/agents/${listing.agentId}`}
                  className="font-semibold text-royal-700 hover:underline"
                >
                  {agentName}
                </Link>
              ) : (
                <span className="font-semibold text-ink-900">
                  {listing.contactIsAnonymous
                    ? ui.privateLister
                    : listing.agentId
                      ? agentName
                      : listing.ownerName}
                </span>
              )}
            </p>
          </Surface>
          {contact.call || contact.whatsapp ? (
            <Surface className="p-6">
              <p className="label text-crimson-700">{ui.contact}</p>
              <div className="mt-4 space-y-3">
                {contact.call && (
                  <a
                    className="flex items-center gap-2 font-semibold text-royal-800 hover:underline"
                    href={`tel:${contact.call.replace(/[^+\d]/g, "")}`}
                  >
                    <Phone aria-hidden className="size-4" />
                    {ui.call}: {contact.call}
                  </a>
                )}
                {contact.whatsapp && (
                  <a
                    className="flex items-center gap-2 font-semibold text-royal-800 hover:underline"
                    href={`https://wa.me/${whatsAppNumber(contact.whatsapp)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ui.whatsapp}: {contact.whatsapp}
                  </a>
                )}
              </div>
            </Surface>
          ) : (
            <Surface className="p-6 text-sm text-ink-500">
              {ui.noDirectNumber}
            </Surface>
          )}
          {user?.uid !== listing.ownerId && (
            <Surface className="p-6">
              <p className="label text-crimson-700">{ui.contact}</p>
              <h2 className="mt-2 text-xl font-semibold text-ink-900">
                {ui.ask}
              </h2>
              {!user ? (
                <Button asChild className="mt-5 w-full">
                  <Link
                    href={`/sign-in?next=${encodeURIComponent(`/listing/${listing.id}`)}`}
                  >
                    {ui.signInInquire}
                  </Link>
                </Button>
              ) : !profile ? (
                <Button asChild className="mt-5 w-full">
                  <Link href="/dashboard">{ui.completeProfile}</Link>
                </Button>
              ) : (
                <form
                  className="mt-5 space-y-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (busy) return;
                    setBusy(true);
                    const form = event.currentTarget;
                    const data = new FormData(form);
                    try {
                      await sendInquiry(
                        listing,
                        user,
                        profile.name,
                        String(data.get("message")),
                        new Date(String(data.get("moveInDate"))),
                      );
                      toast.success("Inquiry sent");
                      form.reset();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not send inquiry",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Field label={ui.message} htmlFor="message">
                    <Textarea
                      id="message"
                      name="message"
                      required
                      maxLength={1000}
                    />
                  </Field>
                  <Field label={ui.moveInDate} htmlFor="moveInDate">
                    <Input
                      id="moveInDate"
                      name="moveInDate"
                      type="date"
                      required
                    />
                  </Field>
                  <Button
                    className="w-full"
                    disabled={busy || profile.isBanned}
                  >
                    {ui.sendInquiry}
                  </Button>
                </form>
              )}
            </Surface>
          )}
          <ListingReportForm key={listing.id} listing={listing} />
        </aside>
      </div>
    </div>
  );
}
