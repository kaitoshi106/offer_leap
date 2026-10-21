'use client';

import type { SignInMethod } from '@offerleap/shared';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/atoms';

/** How an account signs in, as badges ("Password", "Google"); a dash when it has no way in yet. */
export function SignInMethods({ methods }: { methods: SignInMethod[] }) {
  const t = useTranslations('admin.signInMethods');
  if (methods.length === 0) return <span className="text-fg-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {methods.map((method) => (
        <Badge key={method} tone="neutral">
          {t(method)}
        </Badge>
      ))}
    </span>
  );
}
