/**
 * MON BÉDOU ORCHESTRATOR — Client BLACKBOX Agent API.
 *
 * Wrapper minimal autour de l'API https://agent.blackbox.ai/api/v1.
 * Utilise fetch natif, un timeout global et une gestion d'erreurs HTTP propre.
 *
 * Endpoints implémentés :
 *   - POST   /tasks                       → createTask
 *   - GET    /tasks/:runId/status         → getStatus
 *   - GET    /tasks/:runId                → getDetails
 *   - GET    /tasks/:runId/logs           → getLogs
 *   - POST   /tasks/:runId/continue       → continueTask (préparé pour le jalon 2)
 */
import type { AppConfig } from './config.js';
import type {
  CreateTaskResponse,
  TaskDetails,
  TaskStatus,
} from './types.js';
import { HttpError } from './types.js';

export interface CreateTaskInput {
  instruction: string;
  repoUrl: string;
  branch: string;
}

class BlackboxClient {
  constructor(private readonly config: AppConfig) {}

  /** En-têtes d'authentification (Bearer token). */
  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.blackboxApiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /** Abstraction de fetch avec timeout + gestion d'erreurs HTTP. */
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.config.blackboxBaseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.httpTimeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: { ...this.authHeaders(), ...(init.headers ?? {}) },
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Timeout BLACKBOX après ${this.config.httpTimeoutMs} ms : ${path}`);
      }
      throw new Error(`Erreur réseau BLACKBOX : ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    const raw = await res.text();
    let parsed: unknown = raw;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      // Laisser le corps brut si ce n'est pas du JSON.
    }

    if (!res.ok) {
      throw new HttpError(res.status, res.statusText, raw);
    }

    return parsed as T;
  }

  /** Crée une tâche sur le repository fourni. Retourne l'id de run. */
  async createTask(input: CreateTaskInput): Promise<string> {
    const data = await this.request<CreateTaskResponse>('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        instruction: input.instruction,
        repo_url: input.repoUrl,
        branch: input.branch,
      }),
    });
    const runId = data.run_id ?? data.task_id ?? data.id;
    if (!runId) {
      throw new Error(
        `Réponse BLACKBOX sans run id : ${JSON.stringify(data)}`
      );
    }
    return String(runId);
  }

  /** Récupère le statut d'un run. */
  async getStatus(runId: string): Promise<TaskStatus> {
    const data = await this.request<TaskDetails>(`/tasks/${runId}/status`);
    const status = data.status ?? data.taskStatus;
    if (!status) {
      throw new Error(`Réponse de statut BLACKBOX invalide : ${JSON.stringify(data)}`);
    }
    return status as TaskStatus;
  }

  /** Récupère les détails complets d'un run. */
  async getDetails(runId: string): Promise<TaskDetails> {
    return this.request<TaskDetails>(`/tasks/${runId}`);
  }

  /** Récupère les logs d'un run (tableau de chaînes). */
  async getLogs(runId: string): Promise<string[]> {
    const data = await this.request<unknown>(`/tasks/${runId}/logs`);
    if (Array.isArray(data)) {
      return data.map((line) => String(line));
    }
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const logs = obj.logs ?? obj.log ?? obj.lines;
      if (Array.isArray(logs)) {
        return logs.map((line) => String(line));
      }
    }
    return [];
  }

  /**
   * Demande une continuation à Blackbox pour un run donné.
   * (Préparé pour le jalon 2 : boucle d'autonomie.)
   * @throws {Error} indique que la continuation n'est pas encore activée côté serveur.
   */
  async continueTask(runId: string, extra?: Record<string, unknown>): Promise<void> {
    const data = await this.request<unknown>(`/tasks/${runId}/continue`, {
      method: 'POST',
      body: JSON.stringify(extra ?? {}),
    });
    // Actuellement, on ne fait que vérifier que l'appel aboutit.
    void data;
  }
}

export { BlackboxClient };
