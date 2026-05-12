import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { CSSProperties } from 'react';
import { authIsConfigured } from '../../src/auth-session';

export const runtime = 'nodejs';

type SignupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function errorMessage(error?: string) {
  switch (error) {
    case 'invalid_username':
      return 'Use 3–32 lowercase letters, numbers, underscores, or hyphens.';
    case 'invalid_email':
      return 'Enter a valid email address.';
    case 'weak_password':
      return 'Password must be at least 12 characters.';
    case 'username_taken':
      return 'That username is already taken.';
    case 'email_taken':
      return 'That email is already registered.';
    case 'disabled':
      return 'Signup backend is not configured yet.';
    case 'server':
      return 'Signup failed. Try again.';
    default:
      return '';
  }
}

const page: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'radial-gradient(circle at top right, rgba(240,195,106,0.24), transparent 34%), #12110f',
  color: '#f7f2ea',
  fontFamily: 'var(--sans)',
};

const card: CSSProperties = {
  width: '100%',
  maxWidth: 440,
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 28,
  background: 'rgba(255,255,255,0.065)',
  boxShadow: '0 28px 80px rgba(0,0,0,0.38)',
  padding: 32,
};

const input: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 16,
  background: 'rgba(0,0,0,0.28)',
  color: '#fff',
  fontSize: 16,
  padding: '13px 14px',
  outline: 'none',
};

const button: CSSProperties = {
  width: '100%',
  border: 0,
  borderRadius: 16,
  background: '#f0c36a',
  color: '#17120a',
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 700,
  padding: '14px 16px',
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  if (!authIsConfigured()) redirect('/');

  const params = (await searchParams) ?? {};
  const next = getParam(params, 'next') || '/';
  const error = getParam(params, 'error');
  const message = errorMessage(error);

  return (
    <main style={page}>
      <section style={card}>
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: '0 0 12px', color: '#c9b78f', fontSize: 12, fontWeight: 700, letterSpacing: '0.32em', textTransform: 'uppercase' }}>
            Account access
          </p>
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: '-0.045em', lineHeight: 1 }}>Create account</h1>
          <p style={{ margin: '14px 0 0', color: '#c7bcaa', fontSize: 14, lineHeight: 1.6 }}>
            Create a real Open Design account. The first user becomes admin automatically.
          </p>
        </div>

        {message ? (
          <div style={{ marginBottom: 18, border: '1px solid rgba(248,113,113,0.35)', borderRadius: 16, background: 'rgba(239,68,68,0.12)', color: '#fecaca', padding: '12px 14px', fontSize: 14 }}>
            {message}
          </div>
        ) : null}

        <form action='/api/auth/signup' method='post' style={{ display: 'grid', gap: 16 }}>
          <input type='hidden' name='next' value={next} />
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: '#e8dfd1', fontSize: 14, fontWeight: 600 }}>Username</span>
            <input name='username' autoComplete='username' required minLength={3} maxLength={32} pattern='[a-zA-Z0-9_-]+' style={input} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: '#e8dfd1', fontSize: 14, fontWeight: 600 }}>Email</span>
            <input name='email' type='email' autoComplete='email' required style={input} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: '#e8dfd1', fontSize: 14, fontWeight: 600 }}>Password</span>
            <input name='password' type='password' autoComplete='new-password' required minLength={12} style={input} />
          </label>
          <button type='submit' style={button}>Create account</button>
        </form>

        <p style={{ margin: '18px 0 0', color: '#b8ad9d', fontSize: 14, textAlign: 'center' }}>
          Already have an account?{' '}
          <Link href={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} style={{ color: '#f0c36a', fontWeight: 700 }}>
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
