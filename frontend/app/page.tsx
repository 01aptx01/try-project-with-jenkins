import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: '3rem 1.5rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
        Meridian
      </h1>
      <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Relationship Manager Advisory Platform
      </p>
      <Link
        href="/dashboard"
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-contrast)',
          borderRadius: 'var(--radius-md)',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Go to Morning Action Plan
      </Link>
    </main>
  );
}
