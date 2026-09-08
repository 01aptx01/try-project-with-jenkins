import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FamilySection } from '../../../../../components/family-section.js';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Family Network — Meridian',
  description: '1-hop direct family network visualization',
};

export default async function ClientFamilyPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link
          href={`/clients/${id}`}
          style={{
            color: 'var(--primary)',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          ← Back to Client Profile
        </Link>
      </div>

      <Suspense
        fallback={
          <div role="status" aria-label="Loading family network">
            Loading family network...
          </div>
        }
      >
        <FamilySection clientId={id} defaultExpanded={true} />
      </Suspense>
    </div>
  );
}
