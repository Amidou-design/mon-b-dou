/**
 * MON BÉDOU ORCHESTRATOR — Types partagés.
 */

/** Statuts terminaux d'un run Blackbox. */
export type TerminalStatus = 'completed' | 'failed' | 'cancelled' | 'interrupted';

/** Tous les statuts possibles d'un run (terminaux + en cours). */
export type TaskStatus = TerminalStatus | 'pending' | 'running' | 'in_progress' | 'queued';

/** Résultat d'une requête de création de tâche auprès de l'API Blackbox. */
export interface CreateTaskResponse {
  task_id?: string;
  run_id?: string;
  id?: string;
  status?: string;
  [key: string]: unknown;
}

/** Détails d'une tâche/run Blackbox. */
export interface TaskDetails {
  task_id?: string;
  run_id?: string;
  id?: string;
  status: TaskStatus;
  [key: string]: unknown;
}

/** Résultat agrégé retourné par l'orchestrateur en fin de run. */
export interface RunResult {
  runId: string;
  status: TerminalStatus;
  details: TaskDetails;
  logs: string[];
  continueAvailable: boolean;
}

/** Instruction structurée produite par OpenAI, destinée à Blackbox. */
export interface BlackboxInstruction {
  instruction: string;
  metadata?: Record<string, unknown>;
}

/** Réponse de l'appel OpenAI (chat completions). */
export interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAiChatResponse {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason?: string;
  }>;
  error?: { message: string };
}

/** Erreur HTTP normalisée. */
export class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;

  constructor(status: number, statusText: string, body: string) {
    super(`HTTP ${status} ${statusText}: ${body}`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}
