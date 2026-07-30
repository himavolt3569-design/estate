import { cn } from '@/lib/utils';

/**
 * The verification seal: a survey monument.
 *
 * A survey monument is the brass disc a surveyor sets into the ground to mark a
 * point that has actually been measured. Circular, cross-haired, centre-punched.
 * It is the correct object for "we went there and confirmed this", which is
 * exactly what our verification claims, and it is not a marketing checkmark.
 *
 * It is also the system's only true circle at small sizes, which is deliberate:
 * every container around it is hard-cornered, so the disc reads as a different
 * class of object. The circle comes out of Poppins' own bowls.
 *
 * Used sparingly, only where something has genuinely been verified.
 */
export function Seal({
  className,
  size = 20,
  title = 'Verified',
}: {
  className?: string;
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label={title}
      className={cn('text-emerald-600', className)}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="12" cy="12" r="7.1" stroke="currentColor" strokeWidth="0.55" opacity="0.5" />
      {/* Cross hairs, broken at the centre the way a monument is struck. */}
      <path
        d="M12 2v3.2M12 18.8V22M2 12h3.2M18.8 12H22"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="square"
      />
      <path d="M8.9 12.1l2.1 2.1 4.1-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

/**
 * The parcel glyph.
 *
 * One ropani divides into four aana, and each aana divides again. The mark is
 * that subdivision held at two levels, with a single cell filled: a plot,
 * measured. It is the logo and the structural motif of the whole interface.
 */
export function ParcelMark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn('text-royal-700', className)}
    >
      <rect x="1.5" y="1.5" width="21" height="21" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 1.5v21M1.5 12h21" stroke="currentColor" strokeWidth="1" />
      <path d="M6.75 1.5v10.5M1.5 6.75h10.5" stroke="currentColor" strokeWidth="0.5" opacity="0.55" />
      <rect x="12" y="12" width="10.5" height="10.5" fill="currentColor" opacity="0.14" />
    </svg>
  );
}

/**
 * The wordmark. Both scripts are Poppins, so the Nepali sits at the same optical
 * weight as the Latin instead of looking like a caption appended to it.
 */
export function Wordmark({
  className,
  tone = 'dark',
}: {
  className?: string;
  tone?: 'dark' | 'light';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <ParcelMark className={tone === 'light' ? 'text-white' : 'text-royal-700'} />
      <span className="inline-flex items-baseline gap-2">
        <span
          className={cn(
            'text-[1.0625rem] leading-none font-semibold tracking-[-0.035em]',
            tone === 'light' ? 'text-white' : 'text-ink-900',
          )}
        >
          Kitta
        </span>
        <span
          aria-hidden
          className={cn(
            'text-[0.8125rem] leading-none font-light',
            tone === 'light' ? 'text-royal-300' : 'text-ink-400',
          )}
        >
          कित्ता
        </span>
      </span>
    </span>
  );
}
