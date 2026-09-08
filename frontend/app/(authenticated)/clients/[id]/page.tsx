import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { ClientProfile } from '../../../../components/client-profile.js';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Client Profile Snapshot — Meridian',
  description: 'Single snapshot client relationship and financial overview',
};

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div role="status" aria-label="Loading client profile">
          Loading client profile...
        </div>
      }
    >
      <ClientProfile clientId={id} />
    </Suspense>
  );
}
