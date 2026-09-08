import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { ClientListView } from '../../../components/client-list-view.js';

export const metadata: Metadata = {
  title: 'Client Directory — Meridian',
  description: 'Manage and review assigned client relationships',
};

export default function ClientsPage() {
  return (
    <Suspense
      fallback={
        <div role="status" aria-label="Loading client directory">
          Loading client directory...
        </div>
      }
    >
      <ClientListView />
    </Suspense>
  );
}
