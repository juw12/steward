import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Nav } from '@/components/nav';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'Steward Dashboard',
    template: '%s | Steward',
  },
  description:
    'Governance dashboard for AI guardrails — monitor audit logs, policies, and live traffic',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen flex-col">
            <Nav />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
              Steward — AI Governance Layer
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
