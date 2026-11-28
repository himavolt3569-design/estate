"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import {
  ExternalLink,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
  adminCreateUserProfile,
  adminDeleteChat,
  adminDeleteChatMessage,
  adminDeleteInquiry,
  adminDeleteListing,
  adminDeleteUserProfile,
  adminSetListingStatus,
  adminUpdateInquiryStatus,
  adminUpdateUserProfile,
  decideAgentApplication,
  decideListingVerification,
  publishAgentProfile,
  setUserBan,
} from "@/lib/firebase/actions";
import { configured, db } from "@/lib/firebase/client";
import { useDocs } from "@/lib/firebase/hooks";
import { useListingReports } from "@/lib/firebase/property-features";
import type {
  AdminDecision,
  AgentApplication,
  Chat,
  Inquiry,
  Listing,
  Profile,
  PublicAgent,
} from "@/lib/firebase/types";
import { isForSale, listingPrice } from "@/lib/listing-commerce";
import {
  formatAdminDecisionSummary,
  isSoleSuperAdminProfile,
} from "@/lib/superadmin";
import { AdminReports } from "./admin-reports";
import { useAuth } from "./auth-provider";
import { ListingAnalytics } from "./listing-analytics";
import { money } from "./listing-card";
import { useSignedInText } from "./signed-in-copy";
import { useSiteLanguage, useSiteText } from "./site-language";

type WorkspaceTab = "listings" | "users" | "messages" | "reports";

type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  imageUrl?: string;
  isRead?: boolean;
  createdAt?: { toDate?: () => Date };
};

function secondsOf(value: unknown) {
  return Number((value as { seconds?: number } | undefined)?.seconds || 0);
}

function formatTime(value: unknown, locale: "en" | "ne" = "en") {
  const date = (value as { toDate?: () => Date } | undefined)?.toDate?.();
  return date
    ? date.toLocaleString(locale === "ne" ? "ne-NP" : "en-NP", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
}

export function AdminPanel() {
  const tr = useSignedInText();
  const t = useSiteText();
  const { locale } = useSiteLanguage();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "superAdmin";
  const actor = isAdmin ? user?.uid || "" : "";

  const listings = useDocs<Listing>(isAdmin ? "listings" : "");
  const applications = useDocs<AgentApplication>(
    isAdmin ? "agentApplications" : "",
  );
  const users = useDocs<Profile>(isAdmin ? "users" : "");
  const inquiries = useDocs<Inquiry>(isAdmin ? "inquiries" : "");
  const decisions = useDocs<AdminDecision>(isAdmin ? "adminDecisions" : "");
  const publicAgents = useDocs<PublicAgent>(isAdmin ? "agentsPublic" : "");
  const openReports = useListingReports(actor, true, "open");

  const [tab, setTab] = useState<WorkspaceTab>("listings");
  const [listingSearch, setListingSearch] = useState("");
  const [listingView, setListingView] = useState<
    "all" | "pending" | "verified" | "inactive"
  >("all");
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [appFilter, setAppFilter] = useState("pending");
  const [creatingUser, setCreatingUser] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [messageFilter, setMessageFilter] = useState<
    "all" | "chats" | "pending" | "accepted" | "declined"
  >("all");
  const [chatMap, setChatMap] = useState<Record<string, Chat>>({});

  // Discover existing chat documents from inquiry participant tuples using
  // admin single-document get (Firestore rules restrict collection-wide chat list).
  const candidateChatIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of inquiries.items) {
      if (item.ownerId && item.customerId && item.listingId) {
        ids.add(`c_${item.ownerId}_${item.customerId}_${item.listingId}`);
      }
    }
    return [...ids];
  }, [inquiries.items]);

  useEffect(() => {
    if (!configured || !isAdmin || candidateChatIds.length === 0) {
      setChatMap({});
      return;
    }
    let cancelled = false;
    void Promise.all(
      candidateChatIds.map(async (chatId) => {
        try {
          const snap = await getDoc(doc(db(), "chats", chatId));
          if (snap.exists()) {
            return [chatId, { id: snap.id, ...snap.data() } as Chat] as const;
          }
        } catch {
          /* Skip unreadable legacy threads. */
        }
        return null;
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, Chat> = {};
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1];
      }
      setChatMap(next);
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, candidateChatIds]);

  if (!isAdmin) return null;

  const pendingListingsCount = listings.items.filter((item) => {
    const verification = item.verificationStatus || "unreviewed";
    return verification === "pending" || verification === "unreviewed";
  }).length;
  const pendingAgentsCount = applications.items.filter(
    (item) => item.status === "pending",
  ).length;

  const filteredListings = [...listings.items]
    .filter((item) => {
      const verification = item.verificationStatus || "unreviewed";
      if (
        listingView === "pending" &&
        verification !== "pending" &&
        verification !== "unreviewed"
      )
        return false;
      if (listingView === "verified" && verification !== "verified")
        return false;
      if (listingView === "inactive" && item.status === "active") return false;
      const q = listingSearch.trim().toLowerCase();
      if (!q) return true;
      return `${item.title} ${item.ownerName || ""} ${item.address || ""} ${item.roomType || ""} ${item.id}`
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => secondsOf(b.createdAt) - secondsOf(a.createdAt));

  const filteredUsers = [...users.items]
    .filter((person) => {
      if (userFilter === "verifiedAgent" && person.agentStatus !== "verified")
        return false;
      else if (userFilter === "banned" && !person.isBanned) return false;
      else if (
        ["customer", "owner", "agent"].includes(userFilter) &&
        person.role !== userFilter
      )
        return false;
      const q = userSearch.trim().toLowerCase();
      if (!q) return true;
      return `${person.name} ${person.phone || ""} ${person.email || ""} ${person.contactEmail || ""} ${person.location || ""}`
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => {
      if (isSoleSuperAdminProfile(a) && !isSoleSuperAdminProfile(b)) return -1;
      if (!isSoleSuperAdminProfile(a) && isSoleSuperAdminProfile(b)) return 1;
      return a.name.localeCompare(b.name);
    });

  const filteredApps = applications.items.filter(
    (app) => appFilter === "all" || app.status === appFilter,
  );

  const filteredInquiries = [...inquiries.items]
    .filter((item) => {
      const chatId = `c_${item.ownerId}_${item.customerId}_${item.listingId}`;
      const hasChat = Boolean(chatMap[chatId]);
      if (messageFilter === "chats" && !hasChat) return false;
      if (
        ["pending", "accepted", "declined"].includes(messageFilter) &&
        item.status !== messageFilter
      )
        return false;
      const q = messageSearch.trim().toLowerCase();
      if (!q) return true;
      const chat = chatMap[chatId];
      return `${item.listingTitle} ${item.customerName} ${item.ownerName || ""} ${item.message || ""} ${chat?.lastMessage || ""}`
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => secondsOf(b.createdAt) - secondsOf(a.createdAt));

  const recentDecisions = [...decisions.items]
    .sort((a, b) => secondsOf(b.createdAt) - secondsOf(a.createdAt))
    .slice(0, 20);

  const errors = [listings, applications, users, inquiries, decisions, publicAgents]
    .map((result) => result.error)
    .filter(Boolean);

  const tabs: { key: WorkspaceTab; label: string; count?: number }[] = [
    {
      key: "listings",
      label: t("Listings", "घरजग्गा"),
      count: listings.items.length,
    },
    {
      key: "users",
      label: t("People & Profiles", "प्रयोगकर्ता र प्रोफाइल"),
      count: users.items.length,
    },
    {
      key: "messages",
      label: t("Inquiries & Messages", "सोधपुछ र सन्देश"),
      count: inquiries.items.length,
    },
    {
      key: "reports",
      label: t("Reports & Analytics", "उजुरी र तथ्याङ्क"),
      count: openReports.items.length || undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="sr-only">
        <h2>{tr("Administration")}</h2>
      </div>

      {errors.length > 0 && (
        <Surface
          role="alert"
          className="border-clay-200 bg-clay-50 p-4 text-sm text-clay-700"
        >
          Some admin data could not load. Confirm the superAdmin role and
          deployed rules. {errors.join(" · ")}
        </Surface>
      )}

      {/* Clean 4-Tab Workspace Bar */}
      <div
        role="tablist"
        aria-label={t("Admin sections", "प्रशासन खण्डहरू")}
        className="flex flex-wrap items-center gap-2 border-b border-ink-200 pb-3"
      >
        {tabs.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.key)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors ${
                active
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50"
              }`}
            >
              <span>{item.label}</span>
              {item.count !== undefined && (
                <span
                  className={`nums rounded-full px-2 py-0.5 text-xs ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-ink-100 text-ink-700"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: LISTINGS */}
      {tab === "listings" && (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-64 max-w-full">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
                  />
                  <Input
                    aria-label={t("Search listings", "घरजग्गा खोज्नुहोस्")}
                    value={listingSearch}
                    onChange={(event) => setListingSearch(event.target.value)}
                    placeholder={t(
                      "Search title, owner, address…",
                      "शीर्षक, घरधनी वा ठेगाना खोज्नुहोस्…",
                    )}
                    className="h-10 pl-9"
                  />
                </div>
                {(
                  [
                    ["all", t("All", "सबै")],
                    [
                      "pending",
                      `${t("Needs check", "जाँच बाँकी")} (${pendingListingsCount})`,
                    ],
                    ["verified", t("Verified", "प्रमाणित")],
                    ["inactive", t("Paused / Rented", "रोकिएको / भाडामा")],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setListingView(value)}
                    className={`min-h-10 rounded-lg border px-3 text-xs font-medium transition-colors ${
                      listingView === value
                        ? "border-royal-700 bg-royal-50 text-royal-800"
                        : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-500">
                {t(
                  `Showing ${filteredListings.length} of ${listings.items.length}`,
                  `कुल ${listings.items.length} मध्ये ${filteredListings.length}`,
                )}
              </p>
            </div>

            {filteredListings.length === 0 && !listings.loading ? (
              <Surface className="p-6 text-sm text-ink-500">
                {tr("No rentals in this view.")}
              </Surface>
            ) : (
              <div className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
                {filteredListings.map((item) => (
                  <ListingRow key={item.id} item={item} actor={actor} />
                ))}
              </div>
            )}
          </section>

          {/* Keep Report moderation accessible directly on the default admin screen */}
          <div className="border-t border-ink-200 pt-6">
            <AdminReports />
          </div>
        </div>
      )}

      {/* TAB 2: PEOPLE & PROFILES */}
      {tab === "users" && (
        <div className="space-y-8">
          {/* Pending Agent Applications */}
          {(pendingAgentsCount > 0 || appFilter !== "pending") && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-ink-900">
                  {tr("Agent applications")}{" "}
                  {pendingAgentsCount > 0 && (
                    <span className="ml-1 text-sm font-medium text-ochre-700">
                      ({pendingAgentsCount} {t("pending", "बाँकी")})
                    </span>
                  )}
                </h3>
                <Select
                  aria-label="Filter agent applications"
                  value={appFilter}
                  onChange={(event) => setAppFilter(event.target.value)}
                  className="h-10 w-40"
                >
                  <option value="pending">{tr("Pending")}</option>
                  <option value="approved">{tr("Approved")}</option>
                  <option value="rejected">{tr("Rejected")}</option>
                  <option value="all">{tr("All")}</option>
                </Select>
              </div>
              {filteredApps.length === 0 ? (
                <Surface className="p-4 text-sm text-ink-500">
                  {tr("No applications in this view.")}
                </Surface>
              ) : (
                <div className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
                  {filteredApps.map((app) => (
                    <AgentApplicationRow
                      key={app.id}
                      app={app}
                      actor={actor}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Users CRUD */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-64 max-w-full">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
                  />
                  <Input
                    aria-label="Search users"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder={tr("Search name, phone or email")}
                    className="h-10 pl-9"
                  />
                </div>
                <Select
                  aria-label="Filter users"
                  value={userFilter}
                  onChange={(event) => setUserFilter(event.target.value)}
                  className="h-10 w-44"
                >
                  <option value="all">{tr("All users")}</option>
                  <option value="customer">{tr("Customers")}</option>
                  <option value="owner">{tr("Owners")}</option>
                  <option value="agent">{tr("Agent role")}</option>
                  <option value="verifiedAgent">{tr("Verified agents")}</option>
                  <option value="banned">
                    {t("Suspended", "रोकिएका")}
                  </option>
                </Select>
              </div>
              <Button
                type="button"
                size="sm"
                variant={creatingUser ? "secondary" : "royal"}
                onClick={() => setCreatingUser((open) => !open)}
              >
                <Plus aria-hidden className="size-4" />
                {creatingUser
                  ? t("Close", "बन्द गर्नुहोस्")
                  : t("Add profile", "नयाँ प्रोफाइल थप्नुहोस्")}
              </Button>
            </div>

            {creatingUser && (
              <CreateProfileForm
                actor={actor}
                onClose={() => setCreatingUser(false)}
              />
            )}

            <div className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
              {filteredUsers.map((person) => (
                <UserProfileRow
                  key={person.id}
                  person={person}
                  actor={actor}
                  isPublished={
                    !publicAgents.error &&
                    publicAgents.items.some((agent) => agent.id === person.id)
                  }
                />
              ))}
              {filteredUsers.length === 0 && !users.loading && (
                <p className="p-6 text-sm text-ink-500">
                  {t("No profiles match this filter.", "यो खोजसँग मिल्ने प्रोफाइल छैन।")}
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: INQUIRIES & MESSAGES */}
      {tab === "messages" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64 max-w-full">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
                />
                <Input
                  aria-label={t("Search inquiries and chats", "सोधपुछ र सन्देश खोज्नुहोस्")}
                  value={messageSearch}
                  onChange={(event) => setMessageSearch(event.target.value)}
                  placeholder={t(
                    "Search user, property, or message…",
                    "व्यक्ति, घरजग्गा वा सन्देश खोज्नुहोस्…",
                  )}
                  className="h-10 pl-9"
                />
              </div>
              {(
                [
                  ["all", t("All", "सबै")],
                  ["chats", t("With chats", "च्याट भएका")],
                  ["pending", tr("Pending")],
                  ["accepted", tr("Accepted")],
                  ["declined", tr("Declined")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMessageFilter(value)}
                  className={`min-h-10 rounded-lg border px-3 text-xs font-medium transition-colors ${
                    messageFilter === value
                      ? "border-royal-700 bg-royal-50 text-royal-800"
                      : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-500">
              {Object.keys(chatMap).length}{" "}
              {t("active chat threads found", "सक्रिय कुराकानीहरू")}
            </p>
          </div>

          {filteredInquiries.length === 0 && !inquiries.loading ? (
            <Surface className="p-6 text-sm text-ink-500">
              {t("No inquiries or messages in this view.", "यस दृश्यमा कुनै सोधपुछ वा सन्देश छैन।")}
            </Surface>
          ) : (
            <div className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
              {filteredInquiries.map((item) => {
                const chatId = `c_${item.ownerId}_${item.customerId}_${item.listingId}`;
                return (
                  <InquiryAndChatRow
                    key={item.id}
                    inquiry={item}
                    chatId={chatId}
                    chat={chatMap[chatId]}
                    actor={actor}
                    locale={locale}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 4: REPORTS & ANALYTICS */}
      {tab === "reports" && (
        <div className="space-y-10">
          <AdminReports />
          <div className="border-t border-ink-200 pt-8">
            <ListingAnalytics
              listings={listings.items}
              inquiries={inquiries.items}
              admin
            />
          </div>
          <section className="space-y-3 border-t border-ink-200 pt-8">
            <h3 className="text-lg font-semibold text-ink-900">
              {tr("Recent decisions")}
            </h3>
            {recentDecisions.length === 0 && !decisions.loading ? (
              <p className="text-sm text-ink-500">
                {tr("No decisions recorded yet.")}
              </p>
            ) : (
              <div className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
                {recentDecisions.map((item) => (
                  <div key={item.id} className="px-4 py-3 text-sm">
                    <p className="font-medium text-ink-900">
                      {formatAdminDecisionSummary(item, locale)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {formatTime(item.createdAt, locale)}
                      {item.reason ? ` · ${item.reason}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ListingRow({ item, actor }: { item: Listing; actor: string }) {
  const tr = useSignedInText();
  const t = useSiteText();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const verification = item.verificationStatus || "unreviewed";
  const sale = isForSale(item);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-ink-100">
            {item.photoUrls?.[0] && (
              <img
                src={item.photoUrls[0]}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/listing/${item.id}`}
                className="truncate font-semibold text-royal-700 hover:underline"
              >
                {item.title}
              </Link>
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
                  ? tr("Verified")
                  : verification === "rejected"
                    ? tr("Rejected")
                    : t("Pending", "बाँकी")}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-ink-600">
              {money(listingPrice(item))}{" "}
              {sale ? t("asking", "बिक्री") : t("/ mo", "/ महिना")} ·{" "}
              {item.roomType} · {item.ownerName || "Owner"}
              {item.address ? ` · ${item.address}` : ""}
            </p>
          </div>
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
                  () => decideListingVerification(item, true, actor),
                  t("Verified", "प्रमाणित भयो"),
                )
              }
            >
              {tr("Verify")}
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
              {tr("Reject")}
            </Button>
          )}
          <Button asChild size="sm" variant="secondary">
            <Link href={`/listing/${item.id}/edit`}>
              <Pencil aria-hidden className="size-3.5" />
              {tr("Edit")}
            </Link>
          </Button>
          <Select
            aria-label={`Status for ${item.title}`}
            value={item.status}
            disabled={busy}
            className="h-9 w-28 text-xs"
            onChange={(event) => {
              const next = event.target.value as "active" | "paused" | "rented";
              void run(
                () => adminSetListingStatus(item, next, actor),
                t("Status updated", "अवस्था अद्यावधिक भयो"),
              );
            }}
          >
            <option value="active">{tr("Active")}</option>
            <option value="paused">{tr("Paused")}</option>
            <option value="rented">{tr("Rented")}</option>
          </Select>
          {!confirmDelete ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy}
              aria-label={`Delete ${item.title}`}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden className="size-3.5" />
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => adminDeleteListing(item, actor),
                    t("Listing deleted", "घरजग्गा हटाइयो"),
                  )
                }
              >
                {t("Confirm", "पक्का")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                {t("Cancel", "रद्द")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {rejectOpen && (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
          <Input
            aria-label={`Rejection reason for ${item.title}`}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder={t("Reason for rejection…", "अस्वीकार गर्नुको कारण…")}
            className="h-9 min-w-[200px] flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy || !rejectReason.trim()}
            onClick={() =>
              void run(async () => {
                await decideListingVerification(
                  item,
                  false,
                  actor,
                  rejectReason.trim(),
                );
                setRejectReason("");
                setRejectOpen(false);
              }, t("Listing rejected", "घरजग्गा अस्वीकृत भयो"))
            }
          >
            {t("Confirm Reject", "अस्वीकार पक्का")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRejectOpen(false)}
          >
            {t("Cancel", "रद्द")}
          </Button>
        </div>
      )}
    </div>
  );
}

function AgentApplicationRow({
  app,
  actor,
}: {
  app: AgentApplication;
  actor: string;
}) {
  const tr = useSignedInText();
  const t = useSiteText();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const run = async (fn: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink-900">{app.fullName}</p>
            <Badge
              tone={
                app.status === "approved"
                  ? "verified"
                  : app.status === "rejected"
                    ? "rejected"
                    : "pending"
              }
            >
              {tr(app.status)}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-ink-600">
            {app.phone} · {app.location}
            {app.notes ? ` · ${app.notes}` : ""}
          </p>
        </div>
        {app.status === "pending" && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="approve"
              disabled={busy}
              onClick={() =>
                void run(
                  () => decideAgentApplication(app, true, actor),
                  t("Agent approved", "एजेन्ट स्वीकृत भयो"),
                )
              }
            >
              {tr("Approve")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => setRejectOpen((open) => !open)}
            >
              {tr("Reject")}
            </Button>
          </div>
        )}
      </div>

      {rejectOpen && (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
          <Input
            aria-label={`Rejection reason for ${app.fullName}`}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder={t("Reason for rejection…", "अस्वीकार गर्नुको कारण…")}
            className="h-9 min-w-[200px] flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy || !rejectReason.trim()}
            onClick={() =>
              void run(async () => {
                await decideAgentApplication(
                  app,
                  false,
                  actor,
                  rejectReason.trim(),
                );
                setRejectReason("");
                setRejectOpen(false);
              }, t("Application rejected", "आवेदन अस्वीकृत भयो"))
            }
          >
            {t("Confirm Reject", "अस्वीकार पक्का")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRejectOpen(false)}
          >
            {t("Cancel", "रद्द")}
          </Button>
        </div>
      )}
    </div>
  );
}

function CreateProfileForm({
  actor,
  onClose,
}: {
  actor: string;
  onClose: () => void;
}) {
  const tr = useSignedInText();
  const t = useSiteText();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [role, setRole] = useState<"customer" | "owner" | "agent">("agent");
  const [verified, setVerified] = useState(true);
  const [bio, setBio] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      const result = await adminCreateUserProfile(
        {
          name,
          phone,
          email,
          location,
          role,
          agentStatus: verified ? "verified" : "none",
          publicPhone: phone,
          agentBio: bio,
        },
        actor,
      );
      toast.success(
        result.directoryOnly
          ? t(
              "Public directory profile created.",
              "सार्वजनिक एजेन्ट प्रोफाइल थपियो।",
            )
          : t("User profile created.", "प्रयोगकर्ता प्रोफाइल थपियो।"),
      );
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create profile.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Surface className="border-royal-200 p-5">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-ink-900">
            {t("Add profile", "नयाँ प्रोफाइल थप्नुहोस्")}
          </h4>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            {t("Cancel", "रद्द")}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={tr("Name")} htmlFor="new-user-name" required>
            <Input
              id="new-user-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>
          <Field label={tr("Phone")} htmlFor="new-user-phone">
            <Input
              id="new-user-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>
          <Field label={tr("Email address")} htmlFor="new-user-email">
            <Input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label={tr("Location")} htmlFor="new-user-location">
            <Input
              id="new-user-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </Field>
          <Field label={t("Role", "भूमिका")} htmlFor="new-user-role">
            <Select
              id="new-user-role"
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "customer" | "owner" | "agent")
              }
            >
              <option value="customer">{tr("customer")}</option>
              <option value="owner">{tr("owner")}</option>
              <option value="agent">{tr("agent")}</option>
            </Select>
          </Field>
          <Field
            label={t("Bio / Notes", "परिचय")}
            htmlFor="new-user-bio"
            className="sm:col-span-2"
          >
            <Input
              id="new-user-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 pt-6 text-sm text-ink-800">
            <input
              type="checkbox"
              checked={verified}
              onChange={(event) => setVerified(event.target.checked)}
              className="size-4 accent-royal-700"
            />
            {tr("Verified agent")}
          </label>
        </div>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? t("Saving…", "सेभ हुँदैछ…") : t("Create profile", "प्रोफाइल बनाउनुहोस्")}
        </Button>
      </form>
    </Surface>
  );
}

function UserProfileRow({
  person,
  actor,
  isPublished,
}: {
  person: Profile;
  actor: string;
  isPublished: boolean;
}) {
  const tr = useSignedInText();
  const t = useSiteText();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(person.name || "");
  const [phone, setPhone] = useState(person.phone || "");
  const [email, setEmail] = useState(person.contactEmail || person.email || "");
  const [location, setLocation] = useState(person.location || "");
  const [role, setRole] = useState<"customer" | "owner" | "agent">(
    ["customer", "owner", "agent"].includes(person.role)
      ? (person.role as "customer" | "owner" | "agent")
      : "customer",
  );
  const [agentStatus, setAgentStatus] = useState<"none" | "verified">(
    person.agentStatus === "verified" ? "verified" : "none",
  );
  const [isBanned, setIsBanned] = useState(Boolean(person.isBanned));
  const [publicPhone, setPublicPhone] = useState(person.publicPhone || "");
  const [whatsappNumber, setWhatsappNumber] = useState(
    person.whatsappNumber || "",
  );
  const [agentBio, setAgentBio] = useState(person.agentBio || "");

  const isMaster = isSoleSuperAdminProfile(person) || person.id === actor;

  const run = async (fn: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink-900">{person.name}</p>
            <Badge tone={isMaster ? "royal" : "neutral"}>
              {isMaster ? t("Sole Superadmin", "एकमात्र सुपर एडमिन") : tr(person.role)}
            </Badge>
            {person.agentStatus === "verified" && (
              <Badge tone="verified">{tr("Verified agent")}</Badge>
            )}
            {person.isBanned && (
              <Badge tone="rejected">{t("Suspended", "रोकिएको")}</Badge>
            )}
          </div>
          <p className="mt-0.5 break-all text-xs text-ink-600">
            {[person.email || person.contactEmail, person.phone, person.location]
              .filter(Boolean)
              .join(" · ") || person.id}
          </p>
        </div>

        {isMaster ? (
          <span className="text-xs font-medium text-ink-500">
            {t("Protected master account", "सुरक्षित मुख्य खाता")}
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => setEditing((open) => !open)}
            >
              <Pencil aria-hidden className="size-3.5" />
              {editing ? t("Close", "बन्द") : t("Edit profile", "सम्पादन")}
            </Button>
            {person.agentStatus === "verified" &&
              !person.isBanned &&
              !isPublished && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => publishAgentProfile(person, actor),
                      t("Agent profile published", "एजेन्ट प्रोफाइल प्रकाशित भयो"),
                    )
                  }
                >
                  {tr("Publish agent profile")}
                </Button>
              )}
            <Button
              type="button"
              size="sm"
              variant={person.isBanned ? "approve" : "secondary"}
              disabled={busy}
              onClick={() =>
                void run(
                  () => setUserBan(person, actor),
                  person.isBanned ? "Account restored" : "Account suspended",
                )
              }
            >
              {person.isBanned ? tr("Unban") : tr("Ban")}
            </Button>
            {!confirmDelete ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy}
                aria-label={`Delete ${person.name}`}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden className="size-3.5" />
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => adminDeleteUserProfile(person, actor),
                      t("User profile deleted", "प्रोफाइल हटाइयो"),
                    )
                  }
                >
                  {t("Confirm", "पक्का")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  {t("Cancel", "रद्द")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {editing && !isMaster && (
        <form
          className="space-y-4 rounded-xl border border-ink-200 bg-ink-50/70 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await adminUpdateUserProfile(
                person,
                {
                  name,
                  phone,
                  email,
                  location,
                  role,
                  agentStatus,
                  isBanned,
                  publicPhone,
                  whatsappNumber,
                  agentBio,
                },
                actor,
              );
              setEditing(false);
            }, t("Profile updated", "प्रोफाइल अद्यावधिक भयो"));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={tr("Name")} htmlFor={`edit-name-${person.id}`} required>
              <Input
                id={`edit-name-${person.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
            <Field label={tr("Phone")} htmlFor={`edit-phone-${person.id}`}>
              <Input
                id={`edit-phone-${person.id}`}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </Field>
            <Field label={tr("Email address")} htmlFor={`edit-email-${person.id}`}>
              <Input
                id={`edit-email-${person.id}`}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label={tr("Location")} htmlFor={`edit-loc-${person.id}`}>
              <Input
                id={`edit-loc-${person.id}`}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </Field>
            <Field label={t("Role", "भूमिका")} htmlFor={`edit-role-${person.id}`}>
              <Select
                id={`edit-role-${person.id}`}
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as "customer" | "owner" | "agent")
                }
              >
                <option value="customer">{tr("customer")}</option>
                <option value="owner">{tr("owner")}</option>
                <option value="agent">{tr("agent")}</option>
              </Select>
            </Field>
            <Field
              label={t("Agent status", "एजेन्ट अवस्था")}
              htmlFor={`edit-agent-${person.id}`}
            >
              <Select
                id={`edit-agent-${person.id}`}
                value={agentStatus}
                onChange={(event) =>
                  setAgentStatus(event.target.value as "none" | "verified")
                }
              >
                <option value="none">{t("Not verified", "प्रमाणित नभएको")}</option>
                <option value="verified">{tr("Verified agent")}</option>
              </Select>
            </Field>
            <Field
              label={t("Public phone", "सार्वजनिक फोन")}
              htmlFor={`edit-pub-phone-${person.id}`}
            >
              <Input
                id={`edit-pub-phone-${person.id}`}
                value={publicPhone}
                onChange={(event) => setPublicPhone(event.target.value)}
              />
            </Field>
            <Field
              label={t("Public WhatsApp", "सार्वजनिक WhatsApp")}
              htmlFor={`edit-wa-${person.id}`}
            >
              <Input
                id={`edit-wa-${person.id}`}
                value={whatsappNumber}
                onChange={(event) => setWhatsappNumber(event.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 pt-6 text-sm text-ink-800">
              <input
                type="checkbox"
                checked={isBanned}
                onChange={(event) => setIsBanned(event.target.checked)}
                className="size-4 accent-clay-600"
              />
              {t("Suspend account", "खाता रोक्नुहोस्")}
            </label>
            <Field
              label={tr("Agent introduction")}
              htmlFor={`edit-bio-${person.id}`}
              className="sm:col-span-2 lg:col-span-3"
            >
              <Textarea
                id={`edit-bio-${person.id}`}
                value={agentBio}
                maxLength={500}
                onChange={(event) => setAgentBio(event.target.value)}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? tr("Saving…") : tr("Save changes")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              {t("Cancel", "रद्द")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function InquiryAndChatRow({
  inquiry,
  chatId,
  chat,
  actor,
  locale,
}: {
  inquiry: Inquiry;
  chatId: string;
  chat?: Chat;
  actor: string;
  locale: "en" | "ne";
}) {
  const tr = useSignedInText();
  const t = useSiteText();
  const [busy, setBusy] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/listing/${inquiry.listingId}`}
              className="font-semibold text-royal-700 hover:underline"
            >
              {inquiry.listingTitle}
            </Link>
            <Badge
              tone={
                inquiry.status === "accepted"
                  ? "verified"
                  : inquiry.status === "declined"
                    ? "rejected"
                    : "pending"
              }
            >
              {tr(inquiry.status)}
            </Badge>
            {chat && (
              <Badge tone="royal">
                <MessageSquare aria-hidden className="size-3" />
                {t("Chat active", "च्याट उपलब्ध")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-ink-700">
            <span className="font-medium">{inquiry.customerName}</span>{" "}
            {t("(Customer)", "(ग्राहक)")} →{" "}
            <span className="font-medium">{inquiry.ownerName || "Owner"}</span>{" "}
            {t("(Owner / Agent)", "(घरधनी / एजेन्ट)")}
            {inquiry.createdAt
              ? ` · ${formatTime(inquiry.createdAt, locale)}`
              : ""}
          </p>
          {inquiry.message && (
            <p className="text-sm text-ink-800">{inquiry.message}</p>
          )}
          {chat?.lastMessage && (
            <p className="text-xs text-ink-500">
              {t("Latest chat message", "पछिल्लो च्याट सन्देश")}:{" "}
              <span className="text-ink-700">{chat.lastMessage}</span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label={`Inquiry status for ${inquiry.listingTitle}`}
            value={inquiry.status}
            disabled={busy}
            className="h-9 w-28 text-xs"
            onChange={(event) => {
              const next = event.target.value as
                | "pending"
                | "accepted"
                | "declined";
              void run(
                () => adminUpdateInquiryStatus(inquiry, next, actor),
                t("Inquiry updated", "सोधपुछ अद्यावधिक भयो"),
              );
            }}
          >
            <option value="pending">{tr("pending")}</option>
            <option value="accepted">{tr("accepted")}</option>
            <option value="declined">{tr("declined")}</option>
          </Select>

          {chat && (
            <>
              <Button
                type="button"
                size="sm"
                variant={showMessages ? "royal" : "secondary"}
                onClick={() => setShowMessages((open) => !open)}
              >
                <MessageSquare aria-hidden className="size-3.5" />
                {showMessages
                  ? t("Hide messages", "सन्देश लुकाउनुहोस्")
                  : t("Read messages", "सन्देश हेर्नुहोस्")}
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/chat/${chatId}`}>
                  <ExternalLink aria-hidden className="size-3.5" />
                  {t("Full view", "पूरा खोल्नुहोस्")}
                </Link>
              </Button>
            </>
          )}

          {!confirmDelete ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy}
              aria-label={`Delete inquiry from ${inquiry.customerName}`}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden className="size-3.5" />
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => adminDeleteInquiry(inquiry, actor),
                    t("Inquiry deleted", "सोधपुछ हटाइयो"),
                  )
                }
              >
                {t("Confirm", "पक्का")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                {t("Cancel", "रद्द")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {showMessages && chat && (
        <AdminChatInspector chatId={chatId} chat={chat} locale={locale} />
      )}
    </div>
  );
}

function AdminChatInspector({
  chatId,
  chat,
  locale,
}: {
  chatId: string;
  chat: Chat;
  locale: "en" | "ne";
}) {
  const t = useSiteText();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    return onSnapshot(
      query(
        collection(db(), "chats", chatId, "messages"),
        orderBy("createdAt", "asc"),
      ),
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage),
        );
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [chatId]);

  const senderName = (senderId: string) => {
    if (senderId === chat.ownerId)
      return `${chat.ownerName || "Owner"} (${t("Owner / Agent", "घरधनी / एजेन्ट")})`;
    if (senderId === chat.customerId)
      return `${chat.customerName || "Customer"} (${t("Customer", "ग्राहक")})`;
    return senderId;
  };

  return (
    <div className="space-y-3 rounded-xl border border-ink-200 bg-ink-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 pb-2 text-xs text-ink-600">
        <span>
          {chat.customerName || "Customer"} ↔ {chat.ownerName || "Owner"}
        </span>
        <button
          type="button"
          className="font-medium text-clay-700 hover:underline"
          onClick={() => {
            if (!window.confirm("Delete this entire chat conversation?"))
              return;
            void adminDeleteChat(chatId)
              .then(() => toast.success("Chat deleted"))
              .catch((err) =>
                toast.error(
                  err instanceof Error ? err.message : "Could not delete chat",
                ),
              );
          }}
        >
          {t("Delete chat thread", "यो च्याट हटाउनुहोस्")}
        </button>
      </div>

      {loading && (
        <p className="text-xs text-ink-500">
          {t("Loading messages…", "सन्देश लोड हुँदैछ…")}
        </p>
      )}
      {error && (
        <p className="text-xs text-clay-700">
          {t("Could not load messages", "सन्देश लोड हुन सकेन")}: {error}
        </p>
      )}
      {!loading && !error && messages.length === 0 && (
        <p className="text-xs text-ink-500">
          {t("No messages sent yet.", "अहिलेसम्म कुनै सन्देश पठाइएको छैन।")}
        </p>
      )}

      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="rounded-lg border border-ink-200 bg-white p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
              <span className="font-semibold text-ink-800">
                {senderName(msg.senderId)}
              </span>
              <div className="flex items-center gap-3">
                <span>{formatTime(msg.createdAt, locale)}</span>
                <button
                  type="button"
                  className="text-clay-700 hover:underline"
                  onClick={() => {
                    if (!window.confirm("Delete this message?")) return;
                    void adminDeleteChatMessage(chatId, msg.id)
                      .then(() => toast.success("Message deleted"))
                      .catch((err) =>
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Could not delete",
                        ),
                      );
                  }}
                >
                  {t("Delete", "हटाउनुहोस्")}
                </button>
              </div>
            </div>
            {msg.imageUrl && (
              <img
                src={msg.imageUrl}
                alt="Chat attachment"
                className="mt-2 max-h-48 rounded-md object-contain"
              />
            )}
            {msg.text && (
              <p className="mt-1 whitespace-pre-wrap text-ink-800">
                {msg.text}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
