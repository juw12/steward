'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';
import { ProxyStatus } from './proxy-status';

const links = [
  { href: '/', label: 'Overview' },
  { href: '/audit', label: 'Audit' },
  { href: '/policies', label: 'Policies' },
  { href: '/live', label: 'Live' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Steward
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'bg-primary/10 text-primary dark:bg-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ProxyStatus />
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 border-t border-border px-4 py-2 sm:hidden">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium',
              pathname === link.href
                ? 'bg-primary/10 text-primary dark:bg-primary/20'
                : 'text-muted-foreground'
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
