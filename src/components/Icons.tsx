// Small inline icons. Decorative unless a label is passed.

interface IconProps {
  className?: string;
  label?: string;
}

function a11y(label?: string) {
  return label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
}

export function LogoMark({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 40 32" width="40" height="32" aria-hidden="true">
      <path d="M2 24 L11 8 H29 L38 24 Z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
      <path className="logo-ridge" d="M11 8 H29" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M7 24 V30 H33 V24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPhone({ className, label }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" {...a11y(label)}>
      <path
        d="M6.6 3.5h2.6l1.4 4.2-1.9 1.3a12 12 0 0 0 6.3 6.3l1.3-1.9 4.2 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCheck({ className, label }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" {...a11y(label)}>
      <path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconStar({ className, label }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" {...a11y(label)}>
      <path
        d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconLock({ className, label }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" {...a11y(label)}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconAlert({ className, label }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" {...a11y(label)}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function IconClock({ className, label }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" {...a11y(label)}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
