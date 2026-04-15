# BrainFriends GOLDEN

Language rehabilitation DTx / SaMD preparation project for BrainFriends.

## Current Status

Already in place
- Login, session check, and patient bootstrap flow
- Step1-6 training flow and result calculation
- Sing-training result save path
- Version snapshot and audit-oriented metadata

Recently added
- `src/lib/vnv/*` skeleton plus runtime wiring in `SessionManager`
- `src/lib/security/*` storage-policy skeleton and browser-storage restrictions
- `src/lib/ai/*` measured-only evaluation skeleton
- Server-first result handling on result pages
- `src/app/therapist/*` therapist UI shell, patient list, result view, patient detail, and provisioning page
- `src/app/api/therapist/reports/route.ts` therapist-specific report route
- Therapist role passthrough in auth/session/bootstrap flow

## Today Milestone

- Therapist shell is separated from patient flow
- Therapist-specific API route is in place
- Therapist role is recognized by auth/session/bootstrap
- Admin can provision therapist accounts
- Therapist login now routes into `/therapist`

## What Matters Now

- SW V&V: traceability is started, but test evidence is still incomplete
- Cybersecurity: browser storage was reduced, but raw-data server strategy still needs work
- AI evaluation: measured-only collection exists, but dataset governance is still a skeleton

## Immediate Priorities

1. Add therapist detail features: media links, export, memo, follow-up state
2. Add deterministic tests for AQ, quality classification, history persistence, and therapist routing
3. Finish `SessionManager` raw-data split between resume data and server payload
4. Move evaluation samples from NDJSON append to a DB table

## UI Direction

Patient UI
- Purpose: guide the next action clearly
- Routes: `src/app/page.tsx`, `src/app/(training)/*`, `src/app/(result)/result-page/*`
- Rule: simple language, large actions, minimal internal metrics

Therapist UI
- Purpose: interpret results, compare sessions, and inspect traceability
- Routes: `src/app/therapist/*`
- Current data entry points: `src/app/tools/admin-reports/page.tsx`, `src/app/tools/training-usage-admin/page.tsx`, `src/app/tools/training-usage-timeline/page.tsx`
- Rule: analysis-first, measured quality visible, server-save state visible

## Next Phase

Bundle 1: Therapist detail features
- Media links in therapist patient detail
- Export from therapist detail
- Therapist memo and follow-up state
- Recent session comparison

Bundle 2: SW V&V execution
- Deterministic tests for AQ and measured/partial/demo
- Deterministic tests for history persistence and therapist routing
- Requirement/test-case export format

Bundle 3: Cybersecurity follow-up
- Complete raw-data server split
- Remove remaining raw step-data browser paths
- Lock storage-policy and role-policy behavior

Bundle 4: AI evaluation operations
- Replace `evaluation-samples.ndjson` with a DB table
- Add measured-only sample monitoring
- Add dataset version and model version comparison

## Suggested Schedule

Day 1
- Therapist detail features: media links and export

Day 2
- Therapist detail features: memo, follow-up state, session comparison

Day 3
- SW V&V deterministic tests for AQ and quality classification

Day 4
- SW V&V deterministic tests for history persistence and therapist routing

Day 5
- Raw-data server split cleanup

Day 6
- Evaluation samples DB migration

Day 7
- Integrated review across therapist flow, V&V, security, and AI evaluation

## Work Queue

Core modules
- `src/lib/vnv/requirements.ts`
- `src/lib/vnv/traceability.ts`
- `src/lib/vnv/testRunner.ts`
- `src/lib/security/storagePolicy.ts`
- `src/lib/security/secureStorage.ts`
- `src/lib/security/patientRedaction.ts`
- `src/lib/ai/measurementTypes.ts`
- `src/lib/ai/evaluationDataset.ts`
- `src/lib/ai/performanceMetrics.ts`
- `src/lib/ai/modelGovernance.ts`
- `src/lib/ai/measurementCollector.ts`

Main files currently being changed
- `src/lib/storage/adapters.ts`
- `src/lib/storage/managedStorage.ts`
- `src/app/layout.tsx`
- `src/lib/patientStorage.ts`
- `src/lib/kwab/SessionManager.ts`
- `src/app/(result)/result-page/*`
- `src/app/api/*`
- `src/lib/server/*`
- `src/app/therapist/*`

## Completion Criteria

- Sensitive raw measurement data is not left in browser storage
- Result pages prefer server-saved data
- Measured-only samples are separated for evaluation
- Key runtime flows record requirement-linked metadata
- Therapist shell exists separately from patient flow

## Validation Checklist

- Login and session restore still work
- Step progress restore still works
- AQ calculation still works
- Result save still works
- Measured / partial / demo classification still works
- Therapist routes open and link into current tools

## Notes

- Existing TypeScript errors under `src/components/lingo/*` and `src/lib/audio/*` are pre-existing and still separate from this work
- Current priority is therapist workflow, SW V&V execution, and secure data flow
