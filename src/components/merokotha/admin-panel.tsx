"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Input, Select, Surface } from "@/components/ui/primitives";
import {
  decideAgentApplication,
  decideListingVerification,
  publishAgentProfile,
  setUserBan,
} from "@/lib/firebase/actions";
import { useDocs } from "@/lib/firebase/hooks";
import type {
  AdminDecision,
  AgentApplication,
  Inquiry,
  Listing,
  Profile,
  PublicAgent,
} from "@/lib/firebase/types";
import { useAuth } from "./auth-provider";
import { AdminAds } from "./admin-ads";
import { AdminReports } from "./admin-reports";
import { ListingAnalytics } from "./listing-analytics";
import { useSignedInText } from "./signed-in-copy";

function timestamp(value: unknown) {
  const date = (value as { toDate?: () => Date } | undefined)?.toDate?.();
  return date ? date.toLocaleString() : "";
}

export function AdminPanel() {
  const tr = useSignedInText();
  const { user, profile } = useAuth();
  const listings = useDocs<Listing>("listings");
  const applications = useDocs<AgentApplication>("agentApplications");
  const users = useDocs<Profile>("users");
  const inquiries = useDocs<Inquiry>("inquiries");
  const decisions = useDocs<AdminDecision>("adminDecisions");
  const publicAgents = useDocs<PublicAgent>("agentsPublic");
  const [agentFilter, setAgentFilter] = useState("pending");
  const [listingFilter, setListingFilter] = useState("pending");
  const [userSearch, setUserSearch] = useState("");
  const [userRole, setUserRole] = useState("all");
  const actor = user?.uid || "";
  const agentItems = applications.items.filter(
    (item) => agentFilter === "all" || item.status === agentFilter,
  );
  const listingItems = listings.items.filter(
    (item) =>
      listingFilter === "all" ||
      (item.verificationStatus || "unreviewed") === listingFilter,
  );
  const userItems = users.items.filter(
    (item) =>
      (userRole === "all" ||
        item.role === userRole ||
        (userRole === "verifiedAgent" && item.agentStatus === "verified")) &&
      `${item.name} ${item.phone} ${item.email || ""}`
        .toLowerCase()
        .includes(userSearch.toLowerCase()),
  );
  const recentDecisions = [...decisions.items]
    .sort(
      (a, b) =>
        Number(
          (b.createdAt as { seconds?: number } | undefined)?.seconds || 0,
        ) -
        Number((a.createdAt as { seconds?: number } | undefined)?.seconds || 0),
    )
    .slice(0, 20);
  const errors = [
    listings,
    applications,
    users,
    inquiries,
    decisions,
    publicAgents,
  ]
    .map((result) => result.error)
    .filter(Boolean);

  if (profile?.role !== "superAdmin") return null;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">{tr("Administration")}</h2>
        <p className="mt-1 text-sm text-ink-500">
          {tr(
            "Review agents and rentals, manage accounts, and see recent decisions.",
          )}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            "Customers",
            users.items.filter((person) => person.role === "customer").length,
          ],
          [
            "Verified agents",
            users.items.filter((person) => person.agentStatus === "verified")
              .length,
          ],
          [
            "Pending agents",
            applications.items.filter((item) => item.status === "pending")
              .length,
          ],
          [
            "Pending rentals",
            listings.items.filter(
              (item) => item.verificationStatus === "pending",
            ).length,
          ],
        ].map(([label, count]) => (
          <Surface key={label} className="p-4">
            <p className="text-sm text-ink-500">{tr(String(label))}</p>
            <p className="mt-1 text-2xl font-semibold text-royal-800">
              {count}
            </p>
          </Surface>
        ))}
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
      <AdminReports />
      <ListingAnalytics
        listings={listings.items}
        inquiries={inquiries.items}
        admin
      />
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">{tr("Agent applications")}</h3>
          <Select
            aria-label="Filter agent applications"
            value={agentFilter}
            onChange={(event) => setAgentFilter(event.target.value)}
            className="w-44"
          >
            <option value="pending">{tr("Pending")}</option>
            <option value="approved">{tr("Approved")}</option>
            <option value="rejected">{tr("Rejected")}</option>
            <option value="all">{tr("All")}</option>
          </Select>
        </div>
        {agentItems.length === 0 && !applications.loading && (
          <p className="text-sm text-ink-500">
            {tr("No applications in this view.")}
          </p>
        )}
        {agentItems.map((app) => (
          <Surface
            key={app.id}
            className="flex flex-wrap items-center justify-between gap-4 p-4"
          >
            <div>
              <p className="font-semibold">{app.fullName}</p>
              <p className="text-sm text-ink-500">
                {app.phone} · {app.location}
              </p>
              <p className="mt-1 text-sm">{app.notes}</p>
              {app.reason && (
                <p className="text-sm text-clay-700">
                  Decision note: {app.reason}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
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
              {app.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    variant="approve"
                    onClick={() =>
                      void decideAgentApplication(app, true, actor)
                        .then(() => toast.success("Agent approved"))
                        .catch((error) => toast.error(error.message))
                    }
                  >
                    {tr("Approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      const reason = window.prompt("Reason for rejection?");
                      if (reason?.trim())
                        void decideAgentApplication(
                          app,
                          false,
                          actor,
                          reason.trim(),
                        )
                          .then(() => toast.success("Application rejected"))
                          .catch((error) => toast.error(error.message));
                    }}
                  >
                    {tr("Reject")}
                  </Button>
                </>
              )}
            </div>
          </Surface>
        ))}
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">
            {tr("Listing verification")}
          </h3>
          <Select
            aria-label="Filter listing review"
            value={listingFilter}
            onChange={(event) => setListingFilter(event.target.value)}
            className="w-44"
          >
            <option value="pending">{tr("Pending")}</option>
            <option value="unreviewed">{tr("Unreviewed")}</option>
            <option value="verified">{tr("Verified")}</option>
            <option value="rejected">{tr("Rejected")}</option>
            <option value="all">{tr("All")}</option>
          </Select>
        </div>
        <p className="text-sm text-ink-500">
          {tr(
            "Confirm the poster, contact details, location, photos, and duplicates before verifying.",
          )}
        </p>
        {listingItems.length === 0 && !listings.loading && (
          <p className="text-sm text-ink-500">
            {tr("No rentals in this view.")}
          </p>
        )}
        {listingItems.map((item) => (
          <Surface
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-4 p-4"
          >
            <div>
              <Link
                href={`/listing/${item.id}`}
                className="font-semibold text-royal-700"
              >
                {item.title}
              </Link>
              <p className="text-sm text-ink-500">
                {item.status} · {tr(item.verificationStatus || "unreviewed")} ·{" "}
                {item.ownerName}
              </p>
            </div>
            <div className="flex gap-2">
              {item.verificationStatus !== "verified" && (
                <Button
                  size="sm"
                  variant="approve"
                  onClick={() =>
                    void decideListingVerification(item, true, actor)
                      .then(() => toast.success("Rental verified"))
                      .catch((error) => toast.error(error.message))
                  }
                >
                  {tr("Verify")}
                </Button>
              )}
              {item.verificationStatus !== "rejected" && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    const reason = window.prompt("Reason for rejection?");
                    if (reason?.trim())
                      void decideListingVerification(
                        item,
                        false,
                        actor,
                        reason.trim(),
                      )
                        .then(() => toast.success("Rental rejected"))
                        .catch((error) => toast.error(error.message));
                  }}
                >
                  {tr("Reject")}
                </Button>
              )}
            </div>
          </Surface>
        ))}
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">{tr("Users and customers")}</h3>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Search users"
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder={tr("Search name, phone or email")}
              className="w-56"
            />
            <Select
              aria-label="Filter users"
              value={userRole}
              onChange={(event) => setUserRole(event.target.value)}
              className="w-44"
            >
              <option value="all">{tr("All users")}</option>
              <option value="customer">{tr("Customers")}</option>
              <option value="owner">{tr("Owners")}</option>
              <option value="agent">{tr("Agent role")}</option>
              <option value="verifiedAgent">{tr("Verified agents")}</option>
            </Select>
          </div>
        </div>
        {userItems.map((person) => (
          <Surface
            key={person.id}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div>
              <p className="font-semibold">{person.name}</p>
              <p className="text-sm text-ink-500">
                {person.role} · {person.phone} · Agent:{" "}
                {person.agentStatus || "none"}{" "}
                {person.isBanned ? "· Suspended" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {person.agentStatus === "verified" &&
                !person.isBanned &&
                !publicAgents.error &&
                !publicAgents.items.some((agent) => agent.id === person.id) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void publishAgentProfile(person, actor)
                        .then(() => toast.success("Agent profile published"))
                        .catch((error) => toast.error(error.message))
                    }
                  >
                    {tr("Publish agent profile")}
                  </Button>
                )}
              <Button
                size="sm"
                variant="secondary"
                disabled={person.id === actor}
                onClick={() =>
                  void setUserBan(person, actor)
                    .then(() =>
                      toast.success(
                        person.isBanned
                          ? "Account restored"
                          : "Account suspended",
                      ),
                    )
                    .catch((error) => toast.error(error.message))
                }
              >
                {person.isBanned ? tr("Unban") : tr("Ban")}
              </Button>
            </div>
          </Surface>
        ))}
      </section>
      <section className="space-y-3">
        <h3 className="text-xl font-semibold">{tr("Recent decisions")}</h3>
        {recentDecisions.length === 0 && !decisions.loading && (
          <p className="text-sm text-ink-500">
            {tr("No decisions recorded yet.")}
          </p>
        )}
        {recentDecisions.map((item) => (
          <Surface key={item.id} className="p-4 text-sm">
            <p className="font-medium">
              {item.action} · {item.targetName} · {item.decision}
            </p>
            <p className="mt-1 text-ink-500">
              {timestamp(item.createdAt)}
              {item.reason ? ` · ${item.reason}` : ""}
            </p>
          </Surface>
        ))}
      </section>
      <section className="space-y-3">
        <h3 className="text-xl font-semibold">{tr("Inquiries")}</h3>
        {inquiries.items.map((item) => (
          <Surface key={item.id} className="p-4 text-sm">
            {item.listingTitle} · {item.customerName} → {item.ownerName} ·{" "}
            {item.status}
          </Surface>
        ))}
      </section>
      <AdminAds />
    </div>
  );
}
