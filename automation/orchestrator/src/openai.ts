/**
 * MON BÉDOU ORCHESTRATOR — Client OpenAI.
 *
 * Transforme un objectif texte utilisateur en une instruction structurée
 * destinée à l'agent Blackbox. Utilise l'API OpenAI Chat Completions avec
 * fetch natif. Le modèle est configurable via OPENAI_MODEL.
 */
import type { AppConfig } from './config.js';
import type { BlackboxInstruction, OpenAiChatResponse } from './types.js';
import { HttpError } from './types.js';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

/** Construit le message système guidant le LLM vers une instruction exploitable. */
function buildSystemPrompt(): string {
  return [
    'Tu es le module Orchestrateur MON BEDOU. Tu transformes un objectif',
    'humain en une instruction precise et structuree destinee a un agent de',
    'codage autonome (BLACKBOX Agent).',
    '',
    'Regles :',
    " - Reponds UNIQUEMENT avec le texte de l'instruction a donner a l'agent.",
    ' - Sois precis, actionnable et sans ambiguite.',
    " - Si l'objectif demande de l'audit ou de l'analyse, precise explicitement",
    '   "Ne modifie aucun fichier" (mode lecture seule).',
    " - N'invente pas de chemins de fichiers : base-toi uniquement sur l'objectif fourni.",
    ' - Ne revele jamais de cle API et ne demande jamais de cle API.',
  ].join('\n');
}

/**
 * Envoie l'objectif à OpenAI et retourne l'instruction structurée pour Blackbox.
 * @throws {HttpError} en cas de réponse HTTP non-2xx.
 */
export async function buildBlackboxInstruction(
  objective: string,
  config: AppConfig
): Promise<BlackboxInstruction> {
  const body = {
    model: config.openaiModel,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: objective },
    ],
    temperature: 0.2,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.httpTimeoutMs);

  let res: Response;
  try {
    res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Timeout OpenAI après ${config.httpTimeoutMs} ms.`);
    }
    throw new Error(`Erreur réseau OpenAI : ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  const raw = await res.text();
  let data: OpenAiChatResponse;
  try {
    data = JSON.parse(raw) as OpenAiChatResponse;
  } catch {
    throw new HttpError(res.status, res.statusText, raw || '<réponse non-JSON>');
  }

  if (!res.ok) {
    const message = data.error?.message ?? res.statusText;
    throw new HttpError(res.status, message, raw);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Réponse OpenAI vide : aucune instruction générée.');
  }

  return {
    instruction: content,
    metadata: {
      model: config.openaiModel,
      objective: objective,
    },
  };
}

