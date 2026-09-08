import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { MorningActionPlanView } from '../../../components/morning-action-plan.js';

export const metadata: Metadata = {
  title: 'Morning Action Plan — Meridian',
  description: 'Priority clients and next best action queue',
};

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div role="status" aria-label="Loading morning action plan">
          Loading morning action plan...
        </div>
      }
    >
      <MorningActionPlanView />
    </Suspense>
  );
}
