/**
 * MON BÉDOU ORCHESTRATOR — Configuration & validation des variables d'environnement.
 *
 * SÉCURITÉ : aucune clé n'est écrite dans le code. Les secrets sont lus depuis
 * l'environnement (fichier `.env` chargé via dotenv) et ne sont jamais loggés.
 */
import 'dotenv/config';

export interface AppConfig {
  openaiApiKey: string;
  openaiModel: string;
  blackboxApiKey: string;
  blackboxBaseUrl: string;
  blackboxRepoUrl: string;
  blackboxBranch: string;
  httpTimeoutMs: number;
  pollIntervalMs: number;
}

/** Liste des variables obligatoires. */
const REQUIRED: string[] = ['OPENAI_API_KEY', 'BLACKBOX_API_KEY'];

function readRequired(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        'Copiez `.env.example` vers `.env` et renseignez vos clés.'
    );
  }
  return value;
}

function readOptional(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Variable d'environnement invalide : ${name} doit être un entier positif.`);
  }
  return n;
}

/** Construit et valide la configuration. @throws si une variable obligatoire manque. */
export function loadConfig(): AppConfig {
  for (const name of REQUIRED) {
    readRequired(name);
  }

  return {
    openaiApiKey: readRequired('OPENAI_API_KEY'),
    openaiModel: readOptional('OPENAI_MODEL', 'gpt-4o-mini'),
    blackboxApiKey: readRequired('BLACKBOX_API_KEY'),
    blackboxBaseUrl: readOptional('BLACKBOX_BASE_URL', 'https://agent.blackbox.ai/api/v1'),
    blackboxRepoUrl: readOptional(
      'BLACKBOX_REPO_URL',
      'https://github.com/Amidou-design/mon-b-dou.git'
    ),
    blackboxBranch: readOptional('BLACKBOX_BRANCH', 'master'),
    httpTimeoutMs: readPositiveInt('HTTP_TIMEOUT_MS', 30000),
    pollIntervalMs: readPositiveInt('POLL_INTERVAL_MS', 5000),
  };
}

/** Masque une clé API pour l'affichage (jamais la clé complète en logs). */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}
