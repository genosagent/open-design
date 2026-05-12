import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

export type UserRole = 'admin' | 'member';

export type UserRecord = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

type UserDatabase = {
  version: 1;
  users: UserRecord[];
};

type CreateUserInput = {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
};

const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 32;
const EMPTY_DB: UserDatabase = { version: 1, users: [] };

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function userStoreMode() {
  const configured = process.env.OPEN_DESIGN_USER_STORE?.trim().toLowerCase();
  if (configured === 'github' || configured === 'file') return configured;
  if (process.env.OPEN_DESIGN_USER_STORE_GITHUB_TOKEN && process.env.OPEN_DESIGN_USER_STORE_GITHUB_REPO) return 'github';
  return 'file';
}

function localStorePath() {
  const configured = process.env.OPEN_DESIGN_USER_STORE_FILE;
  if (configured) return configured.replace(/^~(?=$|\/)/, homedir());
  return resolve(homedir(), '.hermes/open-design/users.json');
}

function githubConfig() {
  const token = process.env.OPEN_DESIGN_USER_STORE_GITHUB_TOKEN;
  const repo = process.env.OPEN_DESIGN_USER_STORE_GITHUB_REPO;
  const path = process.env.OPEN_DESIGN_USER_STORE_GITHUB_PATH || 'users.json';
  const branch = process.env.OPEN_DESIGN_USER_STORE_GITHUB_BRANCH || 'main';
  if (!token || !repo) throw new Error('GitHub user store is not configured');
  return { token, repo, path, branch };
}

function decodeBase64(value: string) {
  return Buffer.from(value.replace(/\n/g, ''), 'base64').toString('utf8');
}

function encodeBase64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function parseDb(raw: string): UserDatabase {
  if (!raw.trim()) return { ...EMPTY_DB, users: [] };
  const parsed = JSON.parse(raw) as Partial<UserDatabase>;
  if (parsed.version !== 1 || !Array.isArray(parsed.users)) return { ...EMPTY_DB, users: [] };
  return { version: 1, users: parsed.users };
}

async function readFileStore(): Promise<UserDatabase> {
  try {
    return parseDb(await readFile(localStorePath(), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...EMPTY_DB, users: [] };
    throw error;
  }
}

async function writeFileStore(db: UserDatabase) {
  const path = localStorePath();
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
  await rename(temp, path);
}

function githubContentsPath(path: string) {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function readGithubStore(): Promise<{ db: UserDatabase; sha?: string }> {
  const { token, repo, path, branch } = githubConfig();
  const url = `https://api.github.com/repos/${repo}/contents/${githubContentsPath(path)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 404) return { db: { ...EMPTY_DB, users: [] } };
  if (!res.ok) throw new Error(`GitHub user store read failed: ${res.status}`);
  const data = (await res.json()) as { content?: string; sha?: string };
  return { db: parseDb(decodeBase64(data.content || '')), sha: data.sha };
}

async function writeGithubStore(db: UserDatabase, sha?: string) {
  const { token, repo, path, branch } = githubConfig();
  const url = `https://api.github.com/repos/${repo}/contents/${githubContentsPath(path)}`;
  const body: Record<string, unknown> = {
    message: 'Update Open Design users',
    content: encodeBase64(`${JSON.stringify(db, null, 2)}\n`),
    branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub user store write failed: ${res.status}`);
}

async function readStore(): Promise<{ db: UserDatabase; sha?: string }> {
  if (userStoreMode() === 'github') return readGithubStore();
  return { db: await readFileStore() };
}

async function writeStore(db: UserDatabase, sha?: string) {
  if (userStoreMode() === 'github') return writeGithubStore(db, sha);
  return writeFileStore(db);
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex'), iterations = PASSWORD_ITERATIONS) {
  const passwordHash = pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_LENGTH, 'sha256').toString('hex');
  return { passwordHash, passwordSalt: salt, passwordIterations: iterations };
}

function passwordMatches(password: string, user: UserRecord) {
  const expected = Buffer.from(user.passwordHash, 'hex');
  const actual = pbkdf2Sync(password, user.passwordSalt, user.passwordIterations, expected.length, 'sha256');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function userStoreIsConfigured() {
  if (userStoreMode() === 'github') return Boolean(process.env.OPEN_DESIGN_USER_STORE_GITHUB_TOKEN && process.env.OPEN_DESIGN_USER_STORE_GITHUB_REPO);
  return true;
}

export async function findUserByLogin(login: string) {
  const normalized = normalizeUsername(login);
  const email = normalizeEmail(login);
  const { db } = await readStore();
  return db.users.find((user) => user.username === normalized || user.email === email) ?? null;
}

export async function verifyUserCredentials(login: string, password: string) {
  const user = await findUserByLogin(login);
  if (!user) return null;
  return passwordMatches(password, user) ? user : null;
}

export async function createUser(input: CreateUserInput) {
  const username = normalizeUsername(input.username);
  const email = normalizeEmail(input.email);
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username)) throw new Error('invalid_username');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('invalid_email');
  if (input.password.length < 12) throw new Error('weak_password');

  const { db, sha } = await readStore();
  if (db.users.some((user) => user.username === username)) throw new Error('username_taken');
  if (db.users.some((user) => user.email === email)) throw new Error('email_taken');

  const timestamp = nowIso();
  const firstUser = db.users.length === 0;
  const user: UserRecord = {
    id: randomBytes(16).toString('hex'),
    username,
    email,
    ...hashPassword(input.password),
    role: input.role ?? (firstUser ? 'admin' : 'member'),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.users.push(user);
  await writeStore(db, sha);
  return user;
}

export async function ensureUser(input: CreateUserInput) {
  const existing = await findUserByLogin(input.username);
  if (existing) return existing;
  return createUser(input);
}
