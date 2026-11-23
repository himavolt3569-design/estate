"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Eye,
  Heart,
  Layers3,
  MapPin,
  Megaphone,
  Pencil,
  ShieldCheck,
  Sofa,
  Trash2,
  Wallet,
  Home,
  XCircle,
} from "lucide-react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { Seal } from "@/components/brand/Seal";
import { Button } from "@/components/ui/button";
import { Badge, Input, Select, Surface } from "@/components/ui/primitives";
import {
  adminDeleteListing,
  adminSetListingStatus,
  decideListingVerification,
  toggleFavorite,
} from "@/lib/firebase/actions";
import { configured, db } from "@/lib/firebase/client";
import type { Listing } from "@/lib/firebase/types";
import { useAuth } from "@/components/merokotha/auth-provider";
import { money } from "@/components/merokotha/listing-card";
import { useSiteLanguage } from "@/components/merokotha/site-language";
import { recordListingVisit } from "@/lib/firebase/property-features";
import { ListingTour } from "@/components/merokotha/listing-tour";
import { DetailAd } from '@/components/merokotha/detail-ad';
import { AgentSummary, usePublicLister } from '@/components/merokotha/agent-summary';
import { listingListerId, listingListerName } from '@/lib/public-lister';
import { ListingEngagement } from '@/components/merokotha/listing-engagement';
import { ListingRecommendations } from '@/components/merokotha/listing-recommendations';
import { landFacts } from '@/lib/land';
import { isForSale, listingPrice } from '@/lib/listing-commerce';
import { ListingGallery } from '@/components/merokotha/listing-gallery';
import { ListingContactPanel } from '@/components/merokotha/listing-contact-panel';
import { ListingReportForm } from "@/components/merokotha/listing-report";

export default function ListingPage() {
  const { ui, locale } = useSiteLanguage();
  const { id } = useParams<{ id: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const listerId = listingListerId(listing);
  const { person: agent, loading: agentLoading } = usePublicLister(listerId);
  const isSuperAdmin = profile?.role === "superAdmin";

  useEffect(() => {
    if (!configured || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setListing(null);
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
  ].filter(item => (!isForSale(listing) || item.label !== ui.deposit) && (listing.roomType !== 'land' || ![ui.floor, ui.furnishing].includes(item.label)));
  if (listing.roomType === 'land') details.splice(1, 0, ...landFacts(listing.land, locale).map(fact => ({ ...fact, icon: MapPin })));

  return (
    <div className="pb-12">
      {isSuperAdmin && user && (
        <SuperadminListingControls
          listing={listing}
          actorId={user.uid}
          locale={locale}
        />
      )}
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

      <DetailAd key={`title-${listing.id}`} slot="title" listingId={listing.id} />

      <ListingGallery key={listing.id} photos={photos} title={listing.title} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-10">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="royal">{isForSale(listing) ? (locale === 'ne' ? 'बिक्रीमा' : 'For sale') : ui.forRent}</Badge>
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
            <div className="mt-4"><ListingEngagement listing={listing} /></div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-4xl font-semibold tracking-tight text-ink-900">
                {money(listingPrice(listing))}{" "}
                <span className="text-base font-normal text-ink-500">
                  {isForSale(listing) ? (locale === 'ne' ? 'माग गरिएको मूल्य' : 'asking price') : ui.month}
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

          <DetailAd slot="price" listingId={listing.id} />

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
            <h2 className="mt-2 text-2xl font-semibold text-ink-900">
              {ui.about}
            </h2>
            <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-ink-700">
              {listing.description || ui.noDescription}
            </p>
          </section>

          {Boolean(listing.facilities?.length) && (
            <section>
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
            <p className="label">{isForSale(listing) ? (locale === 'ne' ? 'बिक्री मूल्य' : 'Asking price') : ui.monthlyRent}</p>
            <p className="mt-2 text-3xl font-semibold text-royal-700">
              {money(listingPrice(listing))}
            </p>
            <div className="mt-5 border-t border-ink-100 pt-5"><AgentSummary agent={agent} loading={agentLoading} profileId={listerId} listingId={listing.id} fallbackName={listing.contactIsAnonymous ? ui.privateLister : listingListerName(listing, listerId) || (listing.agentId ? (locale === 'ne' ? 'एजेन्ट' : 'Agent') : (locale === 'ne' ? 'विज्ञापनदाता' : 'Property lister'))} /></div>
          </Surface>
          <DetailAd key={`agent-${listing.id}`} slot="agent" listingId={listing.id} dismissKey={listing.agentId || listing.id} />
          <ListingContactPanel key={listing.id} listing={listing} />
          <ListingReportForm key={listing.id} listing={listing} />
        </aside>
      </div>
      <div className="mt-10"><DetailAd slot="recommendations" listingId={listing.id} /></div>
      <ListingRecommendations listing={listing} />
    </div>
  );
}

function SuperadminListingControls({
  listing,
  actorId,
  locale,
}: {
  listing: Listing;
  actorId: string;
  locale: "en" | "ne";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const verification = listing.verificationStatus || "unreviewed";
  const tr = (enText: string, neText: string) =>
    locale === "ne" ? neText : enText;

  const run = async (fn: () => Promise<unknown>, successMessage: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Surface
      aria-label={tr("Superadmin Quick Controls", "सुपर एडमिन द्रुत नियन्त्रण")}
      className="thread-top mb-6 overflow-hidden border-royal-200 bg-royal-50/40 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-royal-900">
              <ShieldCheck aria-hidden className="size-4 text-royal-700" />
              {tr("Superadmin Quick Controls", "सुपर एडमिन द्रुत नियन्त्रण")}
            </span>
            <Badge
              tone={
                verification === "verified"
                  ? "verified"
                  : verification === "rejected"
                    ? "rejected"
                    : "pending"
              }
            >
              {verification === "verified"
                ? tr("Verified", "प्रमाणित")
                : verification === "rejected"
                  ? tr("Rejected", "अस्वीकृत")
                  : tr("Waiting for check", "जाँच बाँकी")}
            </Badge>
            <Badge tone={listing.status === "active" ? "royal" : "neutral"}>
              {listing.status === "active"
                ? tr("Active (Live)", "सक्रिय (लाइभ)")
                : listing.status === "paused"
                  ? tr("Paused (Hidden)", "रोकिएको")
                  : tr("Rented", "भाडामा गएको")}
            </Badge>
          </div>
          <p className="text-xs text-ink-600">
            {tr(
              "Posted by",
              "राख्ने व्यक्ति",
            )}{" "}
            <span className="font-medium text-ink-900">
              {listing.ownerName || "Owner"}
            </span>
            .{" "}
            {tr(
              "You can verify, edit, pause, promote, or remove this property directly.",
              "तपाईं यो घरजग्गा सिधै प्रमाणित, सम्पादन, रोक्न, प्रचार वा हटाउन सक्नुहुन्छ।",
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {verification !== "verified" && (
            <Button
              type="button"
              size="sm"
              variant="approve"
              disabled={busy}
              onClick={() =>
                void run(
                  () => decideListingVerification(listing, true, actorId),
                  tr("Property verified", "घरजग्गा प्रमाणित भयो"),
                )
              }
            >
              <CheckCircle2 aria-hidden className="size-4" />
              {tr("Verify Property", "प्रमाणित गर्नुहोस्")}
            </Button>
          )}
          {verification !== "rejected" && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => setRejectOpen((open) => !open)}
            >
              <XCircle aria-hidden className="size-4" />
              {tr("Reject Property", "अस्वीकार गर्नुहोस्")}
            </Button>
          )}
          <Button asChild size="sm" variant="secondary">
            <Link href={`/listing/${listing.id}/edit`}>
              <Pencil aria-hidden className="size-4" />
              {tr("Edit Property", "सम्पादन गर्नुहोस्")}
            </Link>
          </Button>
          <Select
            aria-label={tr("Change property status", "घरजग्गा अवस्था बदल्नुहोस्")}
            value={listing.status}
            disabled={busy}
            className="h-9 w-36 text-xs"
            onChange={(event) => {
              const next = event.target.value as "active" | "paused" | "rented";
              void run(
                () => adminSetListingStatus(listing, next, actorId),
                tr("Property status updated", "अवस्था अद्यावधिक भयो"),
              );
            }}
          >
            <option value="active">{tr("Active (Live)", "सक्रिय (लाइभ)")}</option>
            <option value="paused">{tr("Paused (Hidden)", "रोकिएको")}</option>
            <option value="rented">{tr("Rented", "भाडामा गएको")}</option>
          </Select>
          <Button asChild size="sm" variant="royal">
            <Link href="/dashboard?tab=ads">
              <Megaphone aria-hidden className="size-4" />
              {tr("Sponsor in Ads", "विज्ञापनमा राख्नुहोस्")}
            </Link>
          </Button>
          {!confirmDelete ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden className="size-4" />
              {tr("Delete", "हटाउनुहोस्")}
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-clay-200 bg-white px-2 py-1">
              <span className="text-xs font-medium text-clay-700">
                {tr("Delete permanently?", "सधैँका लागि हटाउने?")}
              </span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await adminDeleteListing(listing, actorId);
                    router.push("/dashboard?tab=admin");
                  }, tr("Property deleted", "घरजग्गा हटाइयो"))
                }
              >
                {tr("Yes, Delete", "हो, हटाउनुहोस्")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                {tr("Cancel", "रद्द")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {rejectOpen && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-royal-200 pt-3">
          <Input
            aria-label={tr("Reason for rejection", "अस्वीकार गर्नुको कारण")}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder={tr(
              "Write a short note explaining why this property was rejected…",
              "यो घरजग्गा किन अस्वीकार गरियो छोटकरीमा लेख्नुहोस्…",
            )}
            className="h-10 min-w-[220px] flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy || !rejectReason.trim()}
            onClick={() =>
              void run(async () => {
                await decideListingVerification(
                  listing,
                  false,
                  actorId,
                  rejectReason.trim(),
                );
                setRejectReason("");
                setRejectOpen(false);
              }, tr("Property rejected", "घरजग्गा अस्वीकृत भयो"))
            }
          >
            {tr("Confirm Rejection", "अस्वीकार पक्का गर्नुहोस्")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRejectOpen(false)}
          >
            {tr("Cancel", "रद्द")}
          </Button>
        </div>
      )}
    </Surface>
  );
}
