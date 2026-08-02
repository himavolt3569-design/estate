'use client';

import {
  Check,
  ChevronDown,
  Copy,
  Loader2,
  QrCode,
  ReceiptText,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/primitives';
import { formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { signQrImages, submitPaymentProof } from '../actions';

type Method = {
  id: string;
  provider: 'esewa' | 'khalti' | 'imepay' | 'connectips' | 'bank';
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  branch: string | null;
  qrImagePath: string | null;
  instructions: string | null;
  isDefault: boolean;
};

type Options = {
  enabled: boolean;
  payeeId?: string;
  referenceCode?: string;
  propertyTitle?: string;
  isOwner?: boolean;
  methods: Method[];
};

type MyPayment = {
  id: string;
  amount: number;
  purpose: string;
  reference: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  createdAt: string;
};

const PROVIDER_LABEL: Record<Method['provider'], string> = {
  esewa: 'eSewa',
  khalti: 'Khalti',
  imepay: 'IME Pay',
  connectips: 'connectIPS',
  bank: 'Bank transfer',
};

const PURPOSES = [
  { value: 'booking', label: 'Booking / token' },
  { value: 'advance', label: 'Advance' },
  { value: 'deposit', label: 'Security deposit' },
  { value: 'rent', label: 'Rent' },
  { value: 'commission', label: 'Commission' },
  { value: 'other', label: 'Something else' },
] as const;

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * How to pay for this listing, and how to prove that you did.
 *
 * Everything behind this button already existed and had no caller: the payment
 * methods, the private proofs bucket, the payments table with its one-way
 * status machine, and the admin review queue. A buyer simply had no route into
 * any of it.
 *
 * Loaded on demand rather than with the page, for two reasons. The account
 * numbers and QR codes are the part of a listing worth scraping, so they should
 * not sit in the initial payload of a page that anonymous crawlers read; and the
 * listing route is ISR-cached, so a payment panel rendered on the server would
 * be cached along with it.
 */
export function PaymentPanel({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  const [mine, setMine] = useState<MyPayment[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const [{ data, error: rpcError }, { data: paid }] = await Promise.all([
        supabase.rpc('get_property_payment_options', { p_property_id: propertyId }),
        supabase.rpc('my_property_payments', { p_property_id: propertyId }),
      ]);

      if (rpcError) {
        setError(rpcError.message.replace(/^.*?:\s*/, ''));
        return;
      }

      const payload = data as unknown as Options;
      setOptions(payload);
      setMine((paid ?? []) as unknown as MyPayment[]);

      // The bucket is private, so paths have to be exchanged for signed URLs.
      const paths = payload.methods.map((m) => m.qrImagePath).filter((p): p is string => Boolean(p));
      if (paths.length > 0) setQrUrls(await signQrImages(paths));

      setOpen(true);
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div>
        <Button
          variant="secondary"
          className="w-full justify-start"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? <Loader2 aria-hidden className="animate-spin" /> : <ReceiptText aria-hidden />}
          {loading ? 'Loading…' : 'How to pay'}
        </Button>
        {error && (
          <p role="alert" className="mt-2 text-xs text-clay-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!options?.enabled) {
    return (
      <p className="text-sm text-ink-500">
        The lister has not published payment details for this property. Message them to agree how
        to pay.
      </p>
    );
  }

  if (options.methods.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        Payment details are switched on for this listing but none have been added yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2.5 text-2xs leading-relaxed text-ink-600">
        Kitta does not process payments and never holds your money. You pay the lister directly and
        file the receipt here so both sides have a record.
      </div>

      <ul className="space-y-3">
        {options.methods.map((method) => (
          <MethodCard
            key={method.id}
            method={method}
            qrUrl={method.qrImagePath ? qrUrls[method.qrImagePath] : undefined}
            reference={options.referenceCode ?? ''}
          />
        ))}
      </ul>

      {mine.length > 0 && (
        <div className="rounded-lg border border-ink-200 p-3">
          <p className="label mb-2">What you have sent</p>
          <ul className="space-y-1.5">
            {mine.map((payment) => (
              <li key={payment.id} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="nums text-ink-800">{formatPrice(payment.amount)}</span>
                <span
                  className={cn(
                    'font-medium',
                    payment.status === 'approved' && 'text-emerald-700',
                    payment.status === 'rejected' && 'text-clay-700',
                    payment.status === 'pending' && 'text-ink-500',
                  )}
                >
                  {payment.status === 'pending'
                    ? 'Waiting for review'
                    : payment.status === 'approved'
                      ? 'Accepted'
                      : 'Not accepted'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!options.isOwner && (
        <ProofForm
          propertyId={propertyId}
          payeeId={options.payeeId!}
          methods={options.methods}
          reference={options.referenceCode ?? ''}
          onSubmitted={(payment) => setMine((prev) => [payment, ...prev])}
        />
      )}
    </div>
  );
}

function MethodCard({
  method,
  qrUrl,
  reference,
}: {
  method: Method;
  qrUrl?: string;
  reference: string;
}) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(method.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy. Select the number and copy it by hand.');
    }
  }

  return (
    <li className="rounded-lg border border-ink-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">
            {PROVIDER_LABEL[method.provider]}
            {method.isDefault && (
              <span className="ml-2 text-2xs font-normal text-ink-400">Preferred</span>
            )}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-600">{method.accountName}</p>
        </div>
        {method.qrImagePath && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowQr((v) => !v)}>
            <QrCode aria-hidden className="size-3.5" />
            {showQr ? 'Hide QR' : 'Show QR'}
          </Button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <code className="nums min-w-0 flex-1 truncate rounded bg-ink-50 px-2 py-1.5 text-xs text-ink-900">
          {method.accountNumber}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={`Copy ${PROVIDER_LABEL[method.provider]} account number`}
          className="shrink-0 rounded border border-ink-200 p-1.5 text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
        >
          {copied ? (
            <Check aria-hidden className="size-3.5 text-emerald-600" />
          ) : (
            <Copy aria-hidden className="size-3.5" />
          )}
        </button>
      </div>

      {method.bankName && (
        <p className="mt-1.5 text-2xs text-ink-500">
          {method.bankName}
          {method.branch ? ` · ${method.branch}` : ''}
        </p>
      )}

      {showQr && (
        <div className="mt-3">
          {qrUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt={`${PROVIDER_LABEL[method.provider]} payment QR code`}
                className="mx-auto size-48 rounded-lg border border-ink-200 bg-white object-contain p-2"
              />
              <p className="mt-1.5 text-center text-2xs text-ink-400">
                Scan in your {PROVIDER_LABEL[method.provider]} app
              </p>
            </>
          ) : (
            <p className="text-center text-2xs text-ink-400">The QR could not be loaded.</p>
          )}
        </div>
      )}

      {reference && (
        <p className="mt-2 text-2xs leading-relaxed text-ink-500">
          Put <span className="nums font-medium text-ink-700">{reference}</span> in the remarks so
          the lister can match your payment.
        </p>
      )}

      {method.instructions && (
        <p className="mt-1.5 text-2xs leading-relaxed text-ink-600">{method.instructions}</p>
      )}
    </li>
  );
}

function ProofForm({
  propertyId,
  payeeId,
  methods,
  reference,
  onSubmitted,
}: {
  propertyId: string;
  payeeId: string;
  methods: Method[];
  reference: string;
  onSubmitted: (payment: MyPayment) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]['value']>('booking');
  const [methodId, setMethodId] = useState(methods[0]?.id ?? '');
  const [txnRef, setTxnRef] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const rupees = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setError('Enter the amount you sent.');
      return;
    }
    if (!file) {
      setError('Attach a screenshot or PDF of the receipt.');
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      setError('The receipt must be a JPG, PNG, WEBP or PDF.');
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      setError('That file is larger than 5 MB.');
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Sign in again to continue.');
        return;
      }

      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      // The storage policy requires the first path segment to be the payer's id.
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setError(`Could not upload the receipt. ${uploadError.message}`);
        return;
      }

      const result = await submitPaymentProof({
        propertyId,
        payeeId,
        paymentMethodId: methodId || null,
        amount: rupees,
        purpose,
        reference: txnRef,
        note,
      proofPath: path,
      });

      if (!result.ok) {
        // The row was refused, so the orphaned upload should not linger.
        await supabase.storage.from('payment-proofs').remove([path]);
        setError(result.error);
        return;
      }

      onSubmitted({
        id: result.data.id,
        amount: Math.round(rupees * 100),
        purpose,
        reference: txnRef || null,
        status: 'pending',
        rejectionReason: null,
        createdAt: new Date().toISOString(),
      });

      toast.success('Receipt filed. The lister and our team can see it now.');
      setOpen(false);
      setAmount('');
      setTxnRef('');
      setNote('');
      setFile(null);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" className="w-full justify-start" onClick={() => setOpen(true)}>
        <Upload aria-hidden />I have paid, file the receipt
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-ink-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-900">File a receipt</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink-500 hover:text-ink-800"
        >
          Cancel
        </button>
      </div>

      <Field label="Amount sent (NPR)" htmlFor="pay-amount" required>
        <Input
          id="pay-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ''))}
          placeholder="50000"
          className="nums"
        />
      </Field>

      <Field label="What is it for" htmlFor="pay-purpose">
        <div className="relative">
          <select
            id="pay-purpose"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value as typeof purpose)}
            className="h-11 w-full appearance-none rounded-sm border border-ink-200 bg-white px-3 pr-9 text-sm focus-visible:border-royal-500 focus-visible:outline-none"
          >
            {PURPOSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-400"
          />
        </div>
      </Field>

      {methods.length > 1 && (
        <Field label="Which account you paid" htmlFor="pay-method">
          <div className="relative">
            <select
              id="pay-method"
              value={methodId}
              onChange={(event) => setMethodId(event.target.value)}
              className="h-11 w-full appearance-none rounded-sm border border-ink-200 bg-white px-3 pr-9 text-sm focus-visible:border-royal-500 focus-visible:outline-none"
            >
              {methods.map((method) => (
                <option key={method.id} value={method.id}>
                  {PROVIDER_LABEL[method.provider]} · {method.accountName}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-400"
            />
          </div>
        </Field>
      )}

      <Field
        label="Transaction reference"
        htmlFor="pay-ref"
        hint={reference ? `Quote ${reference} in the remarks too` : 'Optional'}
      >
        <Input
          id="pay-ref"
          value={txnRef}
          onChange={(event) => setTxnRef(event.target.value)}
          placeholder="From your payment app"
          className="nums"
        />
      </Field>

      <Field label="Receipt" htmlFor="pay-proof" required hint="Screenshot or PDF, up to 5 MB">
        <input
          id="pay-proof"
          type="file"
          accept={ACCEPTED.join(',')}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full text-xs file:mr-3 file:rounded-sm file:border file:border-ink-200 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium hover:file:bg-ink-50"
        />
      </Field>

      <Field label="Note for the lister" htmlFor="pay-note" hint="Optional">
        <Textarea
          id="pay-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Sent from my eSewa this morning."
        />
      </Field>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-xs text-clay-700">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy} className="w-full">
        {busy && <Loader2 aria-hidden className="animate-spin" />}
        {busy ? 'Filing…' : 'File the receipt'}
      </Button>

      <p className="text-2xs leading-relaxed text-ink-400">
        The receipt is private. Only you, the lister and our review team can open it.
      </p>
    </form>
  );
}
