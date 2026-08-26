#!/usr/bin/env node
/**
 * MON BÉDOU ORCHESTRATOR — Point d'entrée CLI (Jalon 1 / POC).
 *
 * Flux :
 *  1. Reçoit un objectif texte (argument CLI).
 *  2. Envoie l'objectif à OpenAI → instruction structurée pour Blackbox.
 *  3. Envoie l'instruction à BLACKBOX Agent API (avec le repo Mon Bédou).
 *  4. Suit le run jusqu'à un statut terminal : completed/failed/cancelled/interrupted.
 *  5. Récupère les logs et le résultat.
 *  6. Affiche clairement le résultat dans le terminal.
 *
 * Code PREPARÉ pour le jalon 2 : l'appel POST /tasks/:runId/continue est exposé
 * via BlackboxClient.continueTask() (voir blackbox.ts).
 *
 * Usage :  npm run orchestrator -- "objectif de travail"
 */
import { loadConfig, maskSecret } from './config.js';
import { buildBlackboxInstruction } from './openai.js';
import { BlackboxClient } from './blackbox.js';
import {
  HttpError,
  type RunResult,
  type TerminalStatus,
} from './types.js';

const TERMINAL_STATUSES: TerminalStatus[] = [
  'completed',
  'failed',
  'cancelled',
  'interrupted',
];

/** Affiche un séparateur lisible dans le terminal. */
function separator(title: string): void {
  const line = '='.repeat(72);
  console.log(`\n${line}\n  ${title}\n${line}`);
}

/** Affiche les logs Bruts du run. */
function printLogs(logs: string[]): void {
  separator('LOGS DU RUN');
  if (!logs || logs.length === 0) {
    console.log('  (aucun log retourné)');
    return;
  }
  for (const line of logs) {
    console.log(`  ${line}`);
  }
}

/** Boucle de suivi du run jusqu'à un statut terminal. */
async function waitForTerminal(
  client: BlackboxClient,
  runId: string,
  pollIntervalMs: number
): Promise<TerminalStatus> {
  for (;;) {
    const status = await client.getStatus(runId);
    console.log(`  [statut] ${status}`);
    if (TERMINAL_STATUSES.includes(status as TerminalStatus)) {
      return status as TerminalStatus;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}

/** Exécute le flux complet pour un objectif. */
async function runObjective(objective: string): Promise<RunResult> {
  const config = loadConfig();

  separator('MON BÉDOU ORCHESTRATOR — JALON 1 / POC');
  console.log(`  Objectif : ${objective}`);
  console.log(`  Modèle OpenAI : ${config.openaiModel}`);
  console.log(`  Repo BLACKBOX : ${config.blackboxRepoUrl} (${config.blackboxBranch})`);
  // On ne loggue jamais les clés complètes, uniquement un masque court.
  console.log(`  OPENAI   (masqué) : ${maskSecret(config.openaiApiKey)}`);
  console.log(`  BLACKBOX (masqué) : ${maskSecret(config.blackboxApiKey)}`);

  // 2. Objectif → instruction structurée via OpenAI.
  separator('ÉTAPE 1 — GÉNÉRATION DE L\'INSTRUCTION (OpenAI)');
  const instr = await buildBlackboxInstruction(objective, config);
  console.log('  Instruction générée :');
  console.log(`  ${instr.instruction}`);

  // 3. Envoi à BLACKBOX Agent API.
  separator('ÉTAPE 2 — ENVOI À BLACKBOX AGENT');
  const client = new BlackboxClient(config);
  const runId = await client.createTask({
    instruction: instr.instruction,
    repoUrl: config.blackboxRepoUrl,
    branch: config.blackboxBranch,
  });
  console.log(`  Run créé : ${runId}`);

  // 4. Suivi jusqu'au statut terminal.
  separator('ÉTAPE 3 — SUIVI DU RUN');
  const terminalStatus = await waitForTerminal(client, runId, config.pollIntervalMs);

  // 5. Récupération des logs et du résultat.
  const [details, logs] = await Promise.all([
    client.getDetails(runId),
    client.getLogs(runId),
  ]);

  const result: RunResult = {
    runId,
    status: terminalStatus,
    details,
    logs,
    continueAvailable: true,
  };
  return result;
}

/** Point d'entrée principal. */
async function main(): Promise<void> {
  const objective = process.argv.slice(2).join(' ').trim();
  if (!objective) {
    console.error(
      'Usage : npm run orchestrator -- "objectif de travail"\n' +
        'Exemple : npm run orchestrator -- "Audite le repository Mon Bédou ..."'
    );
    process.exitCode = 1;
    return;
  }

  try {
    const result = await runObjective(objective);

    // 6. Affichage clair du résultat.
    separator('RÉSULTAT');
    console.log(`  statut        : ${result.status}`);
    console.log(`  run_id        : ${result.runId}`);
    console.log(`  continuation  : ${result.continueAvailable ? 'disponible (jalon 2)' : 'non'}`);
    printLogs(result.logs);

    if (result.status === 'completed') {
      console.log('\n  ✅ Run MON BÉDOU terminé avec succès.');
    } else {
      console.log(`\n  ⚠️  Run terminé en statut : ${result.status}.`);
    }
  } catch (err) {
    console.error('\n❌ Erreur de l\'orchestrateur :');
    if (err instanceof HttpError) {
      console.error(`  HTTP ${err.status} ${err.statusText}`);
      console.error(`  ${err.body}`);
    } else {
      console.error(`  ${(err as Error)?.message ?? err}`);
    }
    process.exitCode = 1;
  }
}

main();
