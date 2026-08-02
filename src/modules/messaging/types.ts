export type ConversationProperty = {
  id: string;
  title: string;
  slug: string;
  price: number;
  pricePeriod: 'month' | 'year' | 'night' | null;
  locality: string;
  provinceSlug: string | null;
  locationSlug: string;
  cover: { renditions: Record<string, string> | null; storagePath: string | null } | null;
} | null;

export type ConversationPartner = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
} | null;

export type ConversationSummary = {
  id: string;
  subject: string | null;
  updatedAt: string;
  property: ConversationProperty;
  other: ConversationPartner;
  lastMessage: { body: string; createdAt: string; senderId: string } | null;
  unread: number;
};

export type ConversationMessage = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  subject: string | null;
  property: ConversationProperty;
  other: ConversationPartner;
  messages: ConversationMessage[];
};
