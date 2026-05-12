import { redirect } from 'next/navigation';
import type { CSSProperties } from 'react';
import { authIsConfigured } from '../../src/auth-session';

type LoginPageProps = {
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
  background: 'radial-gradient(circle at top left, rgba(201,100,66,0.22), transparent 34%), #12110f',
  color: '#f7f2ea',
  fontFamily: 'var(--sans)',
};

const card: CSSProperties = {
  width: '100%',
  maxWidth: 420,
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

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!authIsConfigured()) redirect('/');

  const params = (await searchParams) ?? {};
  const next = getParam(params, 'next') || '/';
  const error = getParam(params, 'error');

  return (
    <main style={page}>
      <section style={card}>
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: '0 0 12px', color: '#c9b78f', fontSize: 12, fontWeight: 700, letterSpacing: '0.32em', textTransform: 'uppercase' }}>
            Restricted
          </p>
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: '-0.045em', lineHeight: 1 }}>Open Design</h1>
          <p style={{ margin: '14px 0 0', color: '#c7bcaa', fontSize: 14, lineHeight: 1.6 }}>
            Sign in to access Ensar&apos;s private Open Design console.
          </p>
        </div>

        {error ? (
          <div style={{ marginBottom: 18, border: '1px solid rgba(248,113,113,0.35)', borderRadius: 16, background: 'rgba(239,68,68,0.12)', color: '#fecaca', padding: '12px 14px', fontSize: 14 }}>
            Invalid credentials. Access denied.
          </div>
        ) : null}

        <form action='/api/auth/login' method='post' style={{ display: 'grid', gap: 16 }}>
          <input type='hidden' name='next' value={next} />
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: '#e8dfd1', fontSize: 14, fontWeight: 600 }}>Username</span>
            <input name='user' autoComplete='username' required style={input} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: '#e8dfd1', fontSize: 14, fontWeight: 600 }}>Password</span>
            <input name='password' type='password' autoComplete='current-password' required style={input} />
          </label>
          <button type='submit' style={button}>Sign in</button>
        </form>
      </section>
    </main>
  );
}
