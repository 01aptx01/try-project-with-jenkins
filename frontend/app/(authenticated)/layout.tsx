import type { ReactNode } from 'react';
import { SessionProvider } from '../../components/session-provider.js';
import { AppShell } from '../../components/app-shell.js';

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SessionProvider requireAuth={true}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
