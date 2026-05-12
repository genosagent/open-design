import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { CSSProperties } from 'react';
import { authIsConfigured, signupIsConfigured } from '../../src/auth-session';

type SignupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
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
  const disabled = !signupIsConfigured();

  return (
    <main style={page}>
      <section style={card}>
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: '0 0 12px', color: '#c9b78f', fontSize: 12, fontWeight: 700, letterSpacing: '0.32em', textTransform: 'uppercase' }}>
            Invite access
          </p>
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: '-0.045em', lineHeight: 1 }}>Create access</h1>
          <p style={{ margin: '14px 0 0', color: '#c7bcaa', fontSize: 14, lineHeight: 1.6 }}>
            Enter the private invite code to create a trusted session for Ensar&apos;s Open Design console.
          </p>
        </div>

        {disabled ? (
          <div style={{ marginBottom: 18, border: '1px solid rgba(251,191,36,0.35)', borderRadius: 16, background: 'rgba(251,191,36,0.12)', color: '#fde68a', padding: '12px 14px', fontSize: 14 }}>
            Signup is not configured yet. Set OPEN_DESIGN_SIGNUP_CODE in Vercel.
          </div>
        ) : null}

        {error ? (
          <div style={{ marginBottom: 18, border: '1px solid rgba(248,113,113,0.35)', borderRadius: 16, background: 'rgba(239,68,68,0.12)', color: '#fecaca', padding: '12px 14px', fontSize: 14 }}>
            Invalid invite code. Access denied.
          </div>
        ) : null}

        <form action='/api/auth/signup' method='post' style={{ display: 'grid', gap: 16 }}>
          <input type='hidden' name='next' value={next} />
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: '#e8dfd1', fontSize: 14, fontWeight: 600 }}>Invite code</span>
            <input name='code' type='password' autoComplete='one-time-code' required disabled={disabled} style={input} />
          </label>
          <button type='submit' disabled={disabled} style={{ ...button, opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>Sign up</button>
        </form>

        <p style={{ margin: '18px 0 0', color: '#b8ad9d', fontSize: 14, textAlign: 'center' }}>
          Already have admin credentials?{' '}
          <Link href={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} style={{ color: '#f0c36a', fontWeight: 700 }}>
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
