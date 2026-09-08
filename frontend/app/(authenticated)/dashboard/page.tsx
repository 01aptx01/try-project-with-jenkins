import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Morning Action Plan — Meridian',
  description: 'Priority clients and next best action queue',
};

export default function DashboardPage() {
  return (
    <section>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        Morning Action Plan
      </h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
        Review prioritized clients and immediate action recommendations
      </p>
    </section>
  );
}
