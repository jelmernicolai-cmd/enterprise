'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function LanguageSwitch() {
  const pathname = usePathname() || '/';
  const isEn = pathname.startsWith('/en');

  const toNl = isEn ? pathname.replace(/^\/en/, '') || '/' : pathname;
  const toEn = isEn ? pathname : `/en${pathname === '/' ? '' : pathname}`;

  return (
    <div className="flex items-center gap-2">
      <Link href={toNl} className={!isEn ? 'font-semibold underline' : 'opacity-70 hover:opacity-100'}>NL</Link>
      <span className="opacity-40">/</span>
      <Link href={toEn} className={isEn ? 'font-semibold underline' : 'opacity-70 hover:opacity-100'}>EN</Link>
    </div>
  );
}
