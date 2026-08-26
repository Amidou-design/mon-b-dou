# MON BÉDOU ORCHESTRATOR

Orchestrateur local faisant le pont entre un **LLM (OpenAI)** et l'**API BLACKBOX Agent**, pour automatiser l'analyse et (plus tard) la modification du projet **Mon Bédou**.

> **Jalon actuel : 1 — POC.** Ce jalon valide la communication :
> `Utilisateur → Orchestrateur → OpenAI → BLACKBOX Agent API → GitHub → résultat`.

---

## 📌 Objectif général

```
Utilisateur
   ↓
Orchestrateur
   ↓
LLM (OpenAI)
   ↓
BLACKBOX Agent API
   ↓
GitHub / Mon Bédou
   ↓
Blackbox code / teste / corrige
   ↓
Orchestrateur récupère le résultat
   ↓
LLM analyse le résultat
   ↓
Orchestrateur peut demander une continuation à Blackbox
```

**Jalon 1 (ce POC)** ne construit pas encore l'autonomie complète. Il réalise :

1. Recevoir un objectif texte.
2. Envoyer l'objectif à OpenAI pour produire une **instruction structurée** pour Blackbox.
3. Envoyer cette instruction à **BLACKBOX Agent API**.
4. Fournir à Blackbox le repository `https://github.com/Amidou-design/mon-b-dou.git`.
5. Suivre automatiquement le run jusqu'à : `completed / failed / cancelled / interrupted`.
6. Récupérer les logs et le résultat.
7. Afficher clairement le résultat dans le terminal.
8. Préparer le code pour l'endpoint `POST /tasks/:runId/continue` (jalon 2).

---

## 🛠 Technologies

- **Node.js** (≥ 18.17, `fetch` natif) + **TypeScript**.
- **dotenv** pour les secrets (jamais committés).
- **Aucun secret dans le code** ; masquage des clés dans les logs.

---

## 📁 Structure

```
automation/orchestrator/
├── src/
│   ├── index.ts      # CLI : orchestration du flux complet
│   ├── config.ts     # Lecture + validation des variables d'env
│   ├── types.ts      # Types partagés + HttpError
│   ├── openai.ts     # Client OpenAI (instruction structurée)
│   └── blackbox.ts   # Client BLACKBOX Agent API
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

---

## ⚙️ Installation

```bash
cd automation/orchestrator
npm install
```

## 🔑 Configuration

Créez le fichier `.env` depuis l'exemple :

```bash
cp .env.example .env
```

Puis renseignez vos clés :

| Variable | Obligatoire | Description |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | Clé API OpenAI |
| `OPENAI_MODEL` | ❌ (défaut `gpt-4o-mini`) | Modèle OpenAI configurable |
| `BLACKBOX_API_KEY` | ✅ | Bearer token BLACKBOX Agent |
| `BLACKBOX_REPO_URL` | ❌ (défaut repo Mon Bédou) | Repository à analyser/modifier |
| `BLACKBOX_BRANCH` | ❌ (défaut `master`) | Branche cible |
| `HTTP_TIMEOUT_MS` | ❌ (défaut `30000`) | Timeout HTTP global |
| `POLL_INTERVAL_MS` | ❌ (défaut `5000`) | Intervalle de suivi du run |

> ⚠️ **Sécurité :** ne jamais committer `.env`. Il est ignoré par `.gitignore`.

---

## 🚀 Lancement

```bash
npm run orchestrator -- "objectif de travail"
```

### Exemple (premier test READ-ONLY recommandé)

```bash
npm run orchestrator -- "Audite le repository Mon Bédou, lis MON_BEDOU_ARCHITECTURE_V2.1.md et TODO.md, puis retourne un rapport technique sur l'état actuel du projet et la prochaine action recommandée. Ne modifie aucun fichier."
```

> Ce premier test valide la communication **sans modifier le code** de Mon Bédou.

---

## 🔧 Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run orchestrator -- "..."` | Lancer le flux complet (CLI) |
| `npm run typecheck` | Vérification TypeScript (`tsc --noEmit`) |
| `npm run build` | Compilation vers `dist/` |
| `npm run start` | Exécuter le build (`node dist/index.js`) |

---

## 🔌 API BLACKBOX utilisées

| Méthode | Endpoint | Rôle |
|---|---|---|
| `POST` | `/tasks` | Créer une tâche |
| `GET` | `/tasks/:runId/status` | Statut du run |
| `GET` | `/tasks/:runId` | Détails du run |
| `GET` | `/tasks/:runId/logs` | Logs du run |
| `POST` | `/tasks/:runId/continue` | **Préparé** pour le jalon 2 |

Authentification : `Authorization: Bearer <BLACKBOX_API_KEY>`
Base URL : `https://agent.blackbox.ai/api/v1`

---

## 🔒 Sécurité

- Aucune clé API écrite dans le code.
- Les clés ne sont jamais affichées complètes dans les logs (masquage).
- `.env` exclu de Git.
- Validation des variables obligatoires manquantes.
- Timeout HTTP et gestion propre des erreurs (`HttpError`).

---

## 📌 Prochaine étape (Jalon 2)

Brancher la **boucle d'autonomie** :
1. `continueTask(runId)` → `POST /tasks/:runId/continue`.
2. Analyse LLM du résultat.
3. Décision automatique de continuation (completed → prochaine tâche).

---
*Document créé pour le Jalon 1 du MON BÉDOU ORCHESTRATOR.*
