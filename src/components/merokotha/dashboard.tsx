"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Flag,
  BadgeCheck,
  Building2,
  Camera,
  Heart,
  Search,
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Plus,
  Settings,
  ShieldCheck,
} from "lucide-react";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Field,
  Input,
  Select,
  Surface,
  Textarea,
} from "@/components/ui/primitives";
import {
  createProfile,
  decideInquiry,
  ensureChat,
  submitAgentApplication,
  updateProfile,
  uploadImages,
} from "@/lib/firebase/actions";
import { db } from "@/lib/firebase/client";
import { useDocs } from "@/lib/firebase/hooks";
import type {
  AgentApplication,
  Chat,
  Inquiry,
  Listing,
  Profile,
  RecordDoc,
} from "@/lib/firebase/types";
import { ListingCard, money } from "./listing-card";
import { ListingForm } from "./listing-form";
import { AdminPanel } from "./admin-panel";
import { ListingAnalytics } from "./listing-analytics";
import { MyListingReports } from "./listing-report";
import { SavedSearchPanel } from "./saved-search-panel";
import { useAuth } from "./auth-provider";
import { useSiteLanguage, useSiteText } from "./site-language";
import { useSignedInText } from "./signed-in-copy";
import type { Locale } from "@/i18n/config";

const dashboardItems = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "post", label: "Post rental", icon: Plus },
  { key: "listings", label: "My listings", icon: Building2 },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "reports", label: "My reports", icon: Flag },
  { key: "favorites", label: "Saved rentals", icon: Heart },
  { key: "searches", label: "Saved searches", icon: Search },
  { key: "inquiries", label: "Inquiries", icon: MessageSquare },
  { key: "chats", label: "Messages", icon: MessagesSquare },
  { key: "agent", label: "Agent verification", icon: BadgeCheck },
  { key: "profile", label: "Profile", icon: Settings },
  { key: "admin", label: "Administration", icon: ShieldCheck },
] as const;
const dashboardCopy = {
  en: {
    analytics: "Analytics",
    reports: "My reports",
    overview: "Overview",
    post: "Post rental",
    listings: "My listings",
    favorites: "Saved rentals",
    searches: "Saved searches",
    inquiries: "Inquiries",
    chats: "Messages",
    agent: "Agent verification",
    profile: "Profile",
    admin: "Administration",
    account: "Your account",
    hello: "Hello",
    agentStatus: "Agent status",
  },
  ne: {
    analytics: "तथ्याङ्क",
    reports: "मेरा उजुरीहरू",
    overview: "सारांश",
    post: "घरजग्गा राख्नुहोस्",
    listings: "मेरा विज्ञापन",
    favorites: "सेभ गरिएका",
    searches: "सेभ गरिएका खोज",
    inquiries: "सोधपुछ",
    chats: "सन्देश",
    agent: "एजेन्ट प्रमाणीकरण",
    profile: "प्रोफाइल",
    admin: "प्रशासन",
    account: "तपाईंको खाता",
    hello: "नमस्कार",
    agentStatus: "एजेन्टको अवस्था",
  },
} as const;

function DashboardTabs({
  tab,
  role,
  locale,
}: {
  tab: string;
  role: string;
  locale: Locale;
}) {
  return (
    <nav className="dashboard-nav" aria-label="Dashboard">
      {dashboardItems
        .filter((item) => item.key !== "admin" || role === "superAdmin")
        .map((item) => (
          <Link
            key={item.key}
            href={`/dashboard?tab=${item.key}`}
            aria-current={tab === item.key ? "page" : undefined}
          >
            <item.icon aria-hidden className="size-4.5 shrink-0 text-ink-400" />
            {dashboardCopy[locale][item.key]}
          </Link>
        ))}
    </nav>
  );
}

export function Dashboard() {
  const tr = useSignedInText();
  const { user, profile, loading } = useAuth();
  const { locale } = useSiteLanguage();
  const params = useSearchParams();
  const tab = params.get("tab") || "overview";
  const uid = user && profile ? user.uid : "";
  const own = useDocs<Listing>(uid ? "listings" : "", "ownerId", uid);
  const favorites = useDocs<RecordDoc>(uid ? `users/${uid}/favourites` : "");
  const outgoing = useDocs<Inquiry>(uid ? "inquiries" : "", "customerId", uid);
  const incoming = useDocs<Inquiry>(uid ? "inquiries" : "", "ownerId", uid);
  const ownerChats = useDocs<Chat>(uid ? "chats" : "", "ownerId", uid);
  const customerChats = useDocs<Chat>(uid ? "chats" : "", "customerId", uid);
  const [application, setApplication] = useState<AgentApplication | null>(null);
  useEffect(() => {
    if (!uid) return;
    void getDoc(doc(db(), "agentApplications", uid))
      .then((s) =>
        setApplication(
          s.exists() ? ({ id: s.id, ...s.data() } as AgentApplication) : null,
        ),
      )
      .catch((e) => toast.error(e.message));
  }, [uid]);
  if (loading) return <Surface className="p-8">Loading your account…</Surface>;
  if (!user)
    return (
      <Surface className="space-y-4 p-8">
        <h1 className="text-2xl font-semibold">{tr("Sign in to MeroKotha")}</h1>
        <p className="text-ink-500">
          {tr(
            "Choose email and password or Google to continue. If you already use the Android app, choose the same Google account to keep your listings.",
          )}
        </p>
        <Button asChild>
          <Link
            href={`/sign-in?next=${encodeURIComponent(`/dashboard?tab=${tab}`)}`}
          >
            {tr("Sign in")}
          </Link>
        </Button>
      </Surface>
    );
  if (!profile) return <Onboarding user={user} />;
  if (profile.isBanned)
    return (
      <Surface className="p-8">
        {tr("Your account is suspended. Please contact the administrator.")}
      </Surface>
    );
  const chats = [
    ...new Map(
      [...ownerChats.items, ...customerChats.items].map((chat) => [
        chat.id,
        chat,
      ]),
    ).values(),
  ];
  return (
    <div className="dashboard-layout">
      <div>
        <p className="text-sm uppercase tracking-widest text-crimson-600">
          {dashboardCopy[locale].account}
        </p>
        <h1 className="text-3xl font-semibold">
          {dashboardCopy[locale].hello}, {profile.name}
        </h1>
        <p className="text-sm text-ink-500">
          {profile.role} · {dashboardCopy[locale].agentStatus}:{" "}
          {profile.agentStatus || "none"}
        </p>
      </div>
      <DashboardTabs tab={tab} role={profile.role} locale={locale} />
      {tab === "analytics" ? (
        <ListingAnalytics
          listings={own.items}
          inquiries={incoming.items}
          defaultListingId={params.get("listing") || ""}
        />
      ) : tab === "reports" ? (
        <MyListingReports />
      ) : tab === "post" ? (
        <ListingForm />
      ) : tab === "listings" ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">{tr("My listings")}</h2>
          {own.items.map((listing) => (
            <Surface
              key={listing.id}
              className="flex flex-wrap items-center justify-between gap-4 p-4"
            >
              <div>
                <Link
                  href={`/listing/${listing.id}`}
                  className="font-semibold text-royal-700"
                >
                  {listing.title}
                </Link>
                <p className="text-sm text-ink-500">
                  {money(listing.rentPerMonth)} · {listing.status} · Review:{" "}
                  {listing.verificationStatus || "unreviewed"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/dashboard?tab=analytics&listing=${listing.id}`}>
                    {locale === "ne" ? "तथ्याङ्क" : "Analytics"}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/listing/${listing.id}/edit`}>{tr("Edit")}</Link>
                </Button>
                <Select
                  aria-label={`Status for ${listing.title}`}
                  value={listing.status}
                  onChange={(e) =>
                    void updateDoc(doc(db(), "listings", listing.id), {
                      status: e.target.value,
                      updatedAt: serverTimestamp(),
                    }).catch((error) => toast.error(error.message))
                  }
                >
                  <option value="active">{tr("Active")}</option>
                  <option value="paused">{tr("Paused")}</option>
                  <option value="rented">{tr("Rented")}</option>
                </Select>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm("Delete this rental listing?"))
                      void deleteDoc(doc(db(), "listings", listing.id)).catch(
                        (e) => toast.error(e.message),
                      );
                  }}
                >
                  {tr("Delete")}
                </Button>
              </div>
            </Surface>
          ))}
        </div>
      ) : tab === "searches" ? (
        <SavedSearchPanel allowSave showResults activeSearchId={params.get("search") || ""} />
      ) : tab === "favorites" ? (
        <FavoriteList ids={favorites.items.map((f) => f.id)} />
      ) : tab === "inquiries" ? (
        <Inquiries incoming={incoming.items} outgoing={outgoing.items} />
      ) : tab === "chats" ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">{tr("Chats")}</h2>
          {chats.map((chat) => (
            <Link key={chat.id} href={`/chat/${chat.id}`}>
              <Surface className="mb-3 p-5">
                <p className="font-semibold">{chat.listingTitle}</p>
                <p className="text-sm text-ink-500">
                  {chat.ownerId === uid ? chat.customerName : chat.ownerName} ·{" "}
                  {chat.lastMessage || tr("Start a conversation")}
                </p>
                <p className="text-xs text-crimson-600">
                  {chat.ownerId === uid
                    ? chat.unreadOwner || 0
                    : chat.unreadCustomer || 0}{" "}
                  {tr("unread")}
                </p>
              </Surface>
            </Link>
          ))}
        </div>
      ) : tab === "agent" ? (
        <AgentPanel
          uid={uid}
          profile={profile}
          application={application}
          onSubmit={setApplication}
        />
      ) : tab === "profile" ? (
        <ProfilePanel uid={uid} profile={profile} />
      ) : tab === "admin" && profile.role === "superAdmin" ? (
        <AdminPanel />
      ) : (
        <Overview
          profile={profile}
          listings={own.items}
          favorites={favorites.items.length}
          inquiries={[...incoming.items, ...outgoing.items]}
          chats={chats}
          application={application}
        />
      )}
    </div>
  );
}
function Overview({
  profile,
  listings,
  favorites,
  inquiries,
  chats,
  application,
}: {
  profile: Profile;
  listings: Listing[];
  favorites: number;
  inquiries: Inquiry[];
  chats: Chat[];
  application: AgentApplication | null;
}) {
  const tr = useSignedInText();
  const active = listings.filter((item) => item.status === "active").length;
  const awaitingReview = listings.filter(
    (item) => item.verificationStatus === "pending",
  ).length;
  const incoming = inquiries.filter(
    (item) => item.ownerId === profile.id && item.status === "pending",
  );
  const unread = chats.reduce(
    (count, chat) =>
      count +
      (chat.ownerId === profile.id
        ? chat.unreadOwner || 0
        : chat.unreadCustomer || 0),
    0,
  );
  const recent = [...listings]
    .sort((a, b) => {
      const date = (item: Listing) => {
        const value = item.createdAt as { toMillis?: () => number } | undefined;
        return value?.toMillis?.() || 0;
      };
      return date(b) - date(a);
    })
    .slice(0, 3);
  const stats = [
    {
      label: "Active rentals",
      count: active,
      href: "listings",
      note: `${awaitingReview} ${tr("awaiting review")}`,
    },
    {
      label: "Saved places",
      count: favorites,
      href: "favorites",
      note: "Your shortlist",
    },
    {
      label: "Inquiries",
      count: inquiries.length,
      href: "inquiries",
      note: `${incoming.length} ${tr("need a reply")}`,
    },
    {
      label: "Messages",
      count: chats.length,
      href: "chats",
      note: `${unread} ${tr("unread")}`,
    },
  ];
  return (
    <div className="space-y-7">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={`/dashboard?tab=${stat.href}`}>
            <Surface className="h-full p-5 transition-shadow hover:shadow-md">
              <p className="text-sm text-ink-500">{tr(stat.label)}</p>
              <p className="mt-2 text-3xl font-semibold text-royal-800">
                {stat.count}
              </p>
              <p className="mt-2 text-xs text-ink-500">{tr(stat.note)}</p>
            </Surface>
          </Link>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
        <Surface className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="label text-crimson-700">{tr("Your activity")}</p>
              <h2 className="mt-1 text-xl font-semibold">
                {tr("Recent rentals")}
              </h2>
            </div>
            <Link
              href="/dashboard?tab=listings"
              className="text-sm font-semibold text-royal-700"
            >
              {tr("View all")}
            </Link>
          </div>
          {recent.length ? (
            <div className="mt-4 divide-y divide-ink-100">
              {recent.map((item) => (
                <Link
                  key={item.id}
                  href={`/listing/${item.id}`}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                    {item.photoUrls?.[0] && (
                      <img
                        src={item.photoUrls[0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="text-xs text-ink-500">
                      {money(item.rentPerMonth)} · {item.status} ·{" "}
                      {item.verificationStatus || "unreviewed"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-ink-50 p-5 text-sm text-ink-600">
              {tr(
                "No rentals posted yet. Add photos and details to reach nearby renters.",
              )}
            </div>
          )}
        </Surface>
        <Surface className="p-5 sm:p-6">
          <p className="label text-crimson-700">{tr("Next steps")}</p>
          <h2 className="mt-1 text-xl font-semibold">
            {tr("Keep things moving")}
          </h2>
          <div className="mt-5 space-y-3">
            {incoming.length > 0 && (
              <Link
                href="/dashboard?tab=inquiries"
                className="block rounded-xl bg-crimson-50 p-3 text-sm font-medium text-crimson-800"
              >
                {tr("Reply to")} {incoming.length} {tr("new")}{" "}
                {tr(incoming.length === 1 ? "inquiry" : "inquiries")} →
              </Link>
            )}
            {unread > 0 && (
              <Link
                href="/dashboard?tab=chats"
                className="block rounded-xl bg-royal-50 p-3 text-sm font-medium text-royal-800"
              >
                {tr("Open messages")} ({unread} {tr("new")}) →
              </Link>
            )}
            <Link
              href="/dashboard?tab=post"
              className="block rounded-xl border border-ink-100 p-3 text-sm font-medium text-ink-800"
            >
              {tr("Post another rental")} →
            </Link>
            <Link
              href="/"
              className="block rounded-xl border border-ink-100 p-3 text-sm font-medium text-ink-800"
            >
              {tr("Explore available places")} →
            </Link>
            <Link
              href="/dashboard?tab=agent"
              className="block rounded-xl border border-ink-100 p-3 text-sm font-medium text-ink-800"
            >
              {tr("Agent status")}:{" "}
              {tr(
                profile.agentStatus === "verified"
                  ? "verified"
                  : application?.status || "not applied",
              )}{" "}
              →
            </Link>
            {profile.role === "superAdmin" && (
              <Link
                href="/dashboard?tab=admin"
                className="block rounded-xl border border-ink-100 p-3 text-sm font-medium text-ink-800"
              >
                {tr("Review agents, listings and users")} →
              </Link>
            )}
          </div>
        </Surface>
      </div>
      <SavedSearchPanel />
    </div>
  );
}
function Onboarding({ user }: { user: import("firebase/auth").User }) {
  const tr = useSignedInText();
  const t = useSiteText();
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  return (
    <Surface className="mx-auto max-w-xl p-6 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">
        {tr("Complete your profile")}
      </h1>
      <p className="mb-6 text-sm text-ink-500">
        {t(
          "Add your details to use the same Firebase account across the website and Android app.",
          "वेबसाइट र Android मा एउटै Firebase खाता प्रयोग गर्न विवरण थप्नुहोस्।",
        )}
      </p>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const form = new FormData(event.currentTarget);
          const data = {
            name: String(form.get("name")).trim(),
            phone: String(form.get("phone") || "").trim(),
            location: String(form.get("location")).trim(),
            role: String(form.get("role")),
            contactEmail: String(form.get("contactEmail") || "").trim(),
          };
          try {
            await createProfile(user, data);
            if (photo) {
              try {
                const [photoUrl] = await uploadImages(`users/${user.uid}`, [
                  photo,
                ]);
                await updateProfile(user.uid, {
                  name: data.name,
                  location: data.location,
                  photoUrl,
                });
              } catch {
                toast.warning(
                  t(
                    "Profile saved; add your photo later from Account.",
                    "प्रोफाइल सेभ भयो; फोटो पछि खाताबाट थप्नुहोस्।",
                  ),
                );
                return;
              }
            }
            toast.success(t("Profile saved", "प्रोफाइल सेभ भयो"));
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : t("Could not save your profile", "प्रोफाइल सेभ गर्न सकिएन"),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={tr("Name")} htmlFor="name">
          <Input
            id="name"
            name="name"
            autoComplete="name"
            defaultValue={user.displayName || ""}
            required
          />
        </Field>
        <Field
          label={t("Phone number (optional)", "फोन नम्बर (ऐच्छिक)")}
          htmlFor="phone"
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={user.phoneNumber || ""}
          />
        </Field>
        <Field label={tr("Email address")} htmlFor="onboardingEmail">
          <Input
            id="onboardingEmail"
            name="contactEmail"
            type="email"
            autoComplete="email"
            defaultValue={user.email || ""}
          />
        </Field>
        <Field label={tr("Location")} htmlFor="location">
          <Input id="location" name="location" required />
        </Field>
        <Field label={tr("I am mainly here to")} htmlFor="role">
          <Select id="role" name="role">
            <option value="customer">{tr("Find a place")}</option>
            <option value="owner">{tr("Post a rental")}</option>
            <option value="agent">{tr("Work as an agent")}</option>
          </Select>
        </Field>
        <Field
          label={t("Profile photo (optional)", "प्रोफाइल फोटो (ऐच्छिक)")}
          htmlFor="onboardingPhoto"
        >
          <Input
            id="onboardingPhoto"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              if (
                file &&
                (!file.type.startsWith("image/") ||
                  file.size >= 5 * 1024 * 1024)
              ) {
                toast.error(
                  t(
                    "Choose an image under 5 MB.",
                    "५ MB भन्दा सानो फोटो छान्नुहोस्।",
                  ),
                );
                event.target.value = "";
                return;
              }
              setPhoto(file);
            }}
          />
        </Field>
        <Button disabled={busy}>
          {busy ? t("Saving…", "सेभ गर्दै…") : tr("Save profile")}
        </Button>
      </form>
    </Surface>
  );
}
function FavoriteList({ ids }: { ids: string[] }) {
  const tr = useSignedInText();
  const { items } = useDocs<Listing>("listings", "status", "active");
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">{tr("Favorites")}</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items
          .filter((item) => ids.includes(item.id))
          .map((item) => (
            <ListingCard key={item.id} listing={item} />
          ))}
      </div>
    </div>
  );
}
function Inquiries({
  incoming,
  outgoing,
}: {
  incoming: Inquiry[];
  outgoing: Inquiry[];
}) {
  const tr = useSignedInText();
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">{tr("Received inquiries")}</h2>
        {incoming.map((item) => (
          <Surface key={item.id} className="space-y-3 p-5">
            <Link
              href={`/listing/${item.listingId}`}
              className="font-semibold text-royal-700"
            >
              {item.listingTitle}
            </Link>
            <p className="text-sm">
              From {item.customerName}: {item.message}
            </p>
            <Badge
              tone={
                item.status === "accepted"
                  ? "verified"
                  : item.status === "declined"
                    ? "rejected"
                    : "pending"
              }
            >
              {tr(item.status)}
            </Badge>
            {item.status === "pending" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="approve"
                  onClick={() =>
                    void decideInquiry(item, "accepted")
                      .then(() => toast.success("Accepted. Chat is ready."))
                      .catch((e) => toast.error(e.message))
                  }
                >
                  {tr("Accept")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    const reason = window.prompt("Reason for declining?") || "";
                    void decideInquiry(item, "declined", reason).catch((e) =>
                      toast.error(e.message),
                    );
                  }}
                >
                  {tr("Decline")}
                </Button>
              </div>
            )}
            {item.status === "accepted" && <OpenChat inquiry={item} />}
            {item.agentId && item.status === "accepted" && (
              <OwnerContact listingId={item.listingId} />
            )}
          </Surface>
        ))}
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">{tr("Sent inquiries")}</h2>
        {outgoing.map((item) => (
          <Surface key={item.id} className="space-y-2 p-5">
            <Link
              href={`/listing/${item.listingId}`}
              className="font-semibold text-royal-700"
            >
              {item.listingTitle}
            </Link>
            <p className="text-sm text-ink-500">{item.message}</p>
            <Badge
              tone={
                item.status === "accepted"
                  ? "verified"
                  : item.status === "declined"
                    ? "rejected"
                    : "pending"
              }
            >
              {tr(item.status)}
            </Badge>
            {item.status === "accepted" && <OpenChat inquiry={item} />}
            {item.declineReason && (
              <p className="text-sm">Reason: {item.declineReason}</p>
            )}
          </Surface>
        ))}
      </section>
    </div>
  );
}
function OwnerContact({ listingId }: { listingId: string }) {
  const [contact, setContact] = useState<{
    name: string;
    phone: string;
  } | null>(null);
  useEffect(() => {
    void getDoc(doc(db(), "listings", listingId, "ownerContact", "info"))
      .then((s) => {
        if (s.exists()) setContact(s.data() as { name: string; phone: string });
      })
      .catch(() => {});
  }, [listingId]);
  return (
    contact && (
      <p className="text-sm text-ink-600">
        Real owner: {contact.name} · {contact.phone}
      </p>
    )
  );
}
function OpenChat({ inquiry }: { inquiry: Inquiry }) {
  const tr = useSignedInText();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="link"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          router.push(`/chat/${await ensureChat(inquiry)}`);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Could not open chat",
          );
          setBusy(false);
        }
      }}
    >
      {tr("Open chat")}
    </Button>
  );
}
function AgentPanel({
  uid,
  profile,
  application,
  onSubmit,
}: {
  uid: string;
  profile: Profile;
  application: AgentApplication | null;
  onSubmit: (a: AgentApplication) => void;
}) {
  const tr = useSignedInText();
  return (
    <Surface className="max-w-2xl p-6">
      <h2 className="text-2xl font-semibold">{tr("Agent verification")}</h2>
      <p className="my-3 text-sm text-ink-500">
        {tr(
          "Only an administrator can approve an agent application. Approval unlocks posting on behalf of owners.",
        )}
      </p>
      <Badge
        tone={
          profile.agentStatus === "verified"
            ? "verified"
            : application?.status === "rejected"
              ? "rejected"
              : "pending"
        }
      >
        {profile.agentStatus === "verified"
          ? tr("Verified agent")
          : tr(application?.status || "Not applied")}
      </Badge>
      {application?.reason && (
        <p className="mt-3 text-sm">
          {tr("Decision note")}: {application.reason}
        </p>
      )}
      {profile.agentStatus !== "verified" && (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const data = {
              fullName: String(f.get("fullName")),
              phone: String(f.get("phone")),
              location: String(f.get("location")),
              notes: String(f.get("notes")),
            };
            try {
              await submitAgentApplication(uid, data, application);
              onSubmit({ id: uid, uid, ...data, status: "pending" });
              toast.success("Application submitted");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not apply",
              );
            }
          }}
        >
          <Field label={tr("Full name")} htmlFor="fullName">
            <Input
              id="fullName"
              name="fullName"
              defaultValue={application?.fullName || profile.name}
              required
            />
          </Field>
          <Field label={tr("Phone")} htmlFor="agentPhone">
            <Input
              id="agentPhone"
              name="phone"
              defaultValue={application?.phone || profile.phone}
              required
            />
          </Field>
          <Field label={tr("Work location")} htmlFor="agentLocation">
            <Input
              id="agentLocation"
              name="location"
              defaultValue={application?.location || profile.location}
              required
            />
          </Field>
          <Field label={tr("Notes")} htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              defaultValue={application?.notes || ""}
            />
          </Field>
          <Button>{tr("Submit for review")}</Button>
        </form>
      )}
    </Surface>
  );
}
function ProfilePanel({ uid, profile }: { uid: string; profile: Profile }) {
  const t = useSiteText();
  const tr = useSignedInText();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size >= 5 * 1024 * 1024) {
      toast.error("Choose an image smaller than 5 MB.");
      return;
    }
    setPhoto(file);
  };
  return (
    <Surface className="max-w-3xl overflow-hidden p-0">
      <div className="thread h-1" />
      <div className="p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">{tr("Your profile")}</h2>
        <p className="mt-1 text-sm text-ink-500">
          {tr("Keep your contact details and public photo up to date.")}
        </p>
        <form
          className="mt-6 grid gap-7 md:grid-cols-[144px_minmax(0,1fr)]"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              const contactEmail = String(f.get("contactEmail") || "").trim();
              if (
                contactEmail &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
              )
                throw new Error("Enter a valid email address.");
              const result = await updateProfile(
                uid,
                {
                  name: String(f.get("name")).trim(),
                  location: String(f.get("location")).trim(),
                  ...(contactEmail ===
                  (profile.contactEmail || profile.email || "")
                    ? {}
                    : { contactEmail }),
                  ...(profile.agentStatus === "verified" &&
                  String(f.get("agentBio") || "").trim() !==
                    (profile.agentBio || "")
                    ? {
                        agentBio: String(f.get("agentBio") || "")
                          .trim()
                          .slice(0, 500),
                      }
                    : {}),
                  photoUrl: photo
                    ? (await uploadImages(`users/${uid}`, [photo]))[0]
                    : profile.photoUrl,
                },
                profile.agentStatus === "verified",
              );
              setPhoto(null);
              if (result.agentDirectoryUpdated)
                toast.success("Profile updated");
              else
                toast.warning(
                  "Profile updated, but the agent directory could not sync yet.",
                );
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not update",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="w-36">
            <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
              <div className="relative aspect-square bg-gradient-to-br from-royal-50 to-ink-100">
                {preview || profile.photoUrl ? (
                  <img
                    src={preview || profile.photoUrl}
                    alt="Profile photo preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-400">
                    <Camera aria-hidden className="size-10" />
                    <span className="text-xs">
                      {tr("Your photo appears here")}
                    </span>
                  </div>
                )}
              </div>
              <p className="truncate px-3 py-2 text-xs font-semibold">
                {profile.name}
              </p>
            </div>
            <label
              htmlFor="profilePhoto"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                choosePhoto(e.dataTransfer.files[0]);
              }}
              className={`mt-3 flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-2 py-3 text-center text-xs ${dragging ? "border-royal-600 bg-royal-50" : "border-ink-300 bg-ink-50"}`}
            >
              <Camera aria-hidden className="size-5 text-royal-700" />
              <span className="font-medium">
                {tr("Choose or drop a photo")}
              </span>
              <span className="text-xs text-ink-500">
                {tr("Image under 5 MB")}
              </span>
              <input
                id="profilePhoto"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => choosePhoto(e.target.files?.[0])}
              />
            </label>
          </div>
          <div className="space-y-4">
            <Field label={tr("Name")} htmlFor="profileName">
              <Input
                id="profileName"
                name="name"
                defaultValue={profile.name}
                required
              />
            </Field>
            <Field label={tr("Email address")} htmlFor="profileEmail">
              <Input
                id="profileEmail"
                name="contactEmail"
                type="email"
                autoComplete="email"
                defaultValue={profile.contactEmail || profile.email || ""}
                placeholder="you@example.com"
              />
            </Field>
            <p className="text-xs text-ink-500">
              {t(
                "Your contact email is private and does not change how you sign in.",
                "सम्पर्क इमेल गोप्य रहन्छ र साइन इन गर्ने तरिका परिवर्तन गर्दैन।",
              )}
            </p>
            <Field label={tr("Location")} htmlFor="profileLocation">
              <Input
                id="profileLocation"
                name="location"
                defaultValue={profile.location}
              />
            </Field>
            {profile.agentStatus === "verified" && (
              <Field label={tr("Agent introduction")} htmlFor="agentBio">
                <Textarea
                  id="agentBio"
                  name="agentBio"
                  maxLength={500}
                  defaultValue={profile.agentBio || ""}
                  placeholder="Tell renters where you work and how you help"
                />
              </Field>
            )}
            <Field label={tr("Phone")} htmlFor="profilePhone">
              <Input id="profilePhone" value={profile.phone} disabled />
            </Field>
            <Button disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
        <Link
          href="/sign-in?next=%2Fdashboard%3Ftab%3Dprofile"
          className="mt-5 inline-block text-sm font-semibold text-royal-700 hover:underline"
        >
          {t(
            "Manage Google or email sign-in",
            "Google वा इमेल साइन इन व्यवस्थापन गर्नुहोस्",
          )}
        </Link>
      </div>
    </Surface>
  );
}
