import type { Metadata } from 'next';
import { LoginForm } from '../../components/login-form.js';

export const metadata: Metadata = {
  title: 'Sign In — Meridian',
  description: 'Sign in to the Meridian Relationship Manager Portal',
};

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <LoginForm />
    </main>
  );
}
