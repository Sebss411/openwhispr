# Contextual Command System Audit

Date: 2026-07-03

This audit was requested before implementing "Lote 7.5 - Contextual Command System + Smart Next-Step Assistant + Client Usability Pass".

## Scope Result

The requested Content OS dashboard code is not present in this checkout.

Expected but missing:

- `packages/dashboard/action-registry.ts`
- `packages/dashboard/chat.ts`
- `packages/dashboard/render-dashboard.ts`
- `packages/dashboard/api.ts`
- `packages/dashboard/server.ts`
- Content OS Shell files
- Production Loop dashboard files
- Daily Report dashboard files
- Assistant recipes for the Content OS dashboard
- `pnpm content`
- `/api/status`
- `/api/production-view`
- `/api/action-registry`
- `/api/assistant-recipes`

The current checkout is the OpenWhispr desktop dictation app. It has Electron, React, notes, chat, prompt editing, local voice commands, and note actions, but it does not contain the Content OS dashboard described by the lot.

Because the target system is absent, implementation of phases B-I is blocked in this repository state. Building a new dashboard from scratch here would not be an incremental implementation of the requested lot and would risk breaking an unrelated app.

## Current Command Surfaces

Audited equivalent live surfaces in this checkout:

- Command/search UI: `src/components/CommandSearch.tsx`
- App command menu: `src/App.jsx`
- Chat / Assistant UI: `src/components/chat/*`
- Assistant tool registry: `src/services/tools/*`
- Note action picker and manager: `src/components/notes/ActionPicker.tsx`, `src/components/notes/ActionManagerDialog.tsx`
- Note action execution: `src/stores/actionProcessingStore.ts`, `src/components/notes/PersonalNotesView.tsx`
- Prompt Studio and prompt settings: `src/components/ui/PromptStudio.tsx`, `src/components/settings/*AgentSettings.tsx`
- Prompt registry: `src/config/prompts/registry.ts`
- Local voice commands: `src/services/localtext/voiceCommands.js`

## Current Problems

- The requested Content OS command bar and slash command surfaces do not exist in this checkout.
- The current `CommandSearch` is primarily navigation over notes, transcripts, and conversations.
- Current command-like surfaces are fragmented across note actions, chat tools, prompt kinds, and local voice commands.
- There is no shared action context model with `whyUseThis`, `whenToUse`, `requires`, `disabledReason`, `nextStep`, `destination`, or `userIntent`.
- Availability is often implicit. For example, optional tools may be hidden when prerequisites are missing instead of shown as blocked with a clear reason.
- Note actions expose name, description, prompt, and visibility, but not client-facing status, intent, next step, or preconditions.
- Prompt authoring is split between Prompt Studio and separate settings textareas.
- Voice commands overlap conceptually with note actions but are not discoverable through a shared command layer.

## Desired Command Model

For the Content OS dashboard described by the lot, each command should return:

- intent
- current status
- recommended action
- related actions
- copy targets
- destination
- why use this
- when to use this
- prerequisites
- disabled reason when blocked
- next step

A coherent action definition should support:

- `id`
- `label`
- `shortLabel`
- `description`
- `category`
- `keywords`
- `actionType`
- `destination`
- `whyUseThis`
- `whenToUse`
- `requiresOutput`
- `requiresOpenRouter`
- `requiresImport`
- `requiresComparison`
- `requiresFinalPack`
- `disabledReason`
- `nextStep`
- `userIntents`
- `priority`
- `relatedCopyTargets`
- `relatedSections`

## Implementation Plan

This plan applies once the repository contains the requested Content OS dashboard modules.

Files to modify:

- `packages/dashboard/action-registry.ts`
- `packages/dashboard/chat.ts`
- `packages/dashboard/render-dashboard.ts`
- `packages/dashboard/api.ts`
- `packages/dashboard/server.ts`
- dashboard CSS/assets colocated with the renderer
- assistant recipe definitions
- slash command handling module
- Production Loop rendering module

Files to add:

- `packages/dashboard/next-step.ts`
- contextual action tests
- slash command tests
- command bar search tests
- chat assistant safety tests
- `docs/smart-next-step-assistant.md`
- `docs/contextual-actions.md`

Tests to add:

- action registry metadata completeness
- unique action IDs
- no shell action or arbitrary path action
- `getAvailableActions(state)`
- `getActionsByIntent(intent, state)`
- `getPrimaryNextActions(state)`
- `getDisabledActionsWithReasons(state)`
- next-step engine states
- slash command responses for `/what-next`, `/tweets`, `/video`, `/sources`, `/final-pack`, `/settings`
- command bar searches for Spanish and English intents
- chat deterministic fallback without OpenRouter
- OpenRouter mock response safety
- dashboard render smoke tests
- no token leaks
- no CDN or external scripts

Risks:

- The requested dashboard is absent in this checkout, so implementation cannot be safely applied here.
- Creating parallel dashboard code would introduce a second product surface instead of upgrading the existing Content OS dashboard.
- The requested validation commands depend on `pnpm content`, which is not defined in this repository.
- The current app has cloud/BYOK provider integrations unrelated to the zero-cost Content OS constraints, so changing them for this lot would be out of scope and risky.

## Audit Conclusion

Phase A is complete. The implementation phases are blocked until the checkout includes the Content OS dashboard and `pnpm content` CLI described by the lot.

No production code was changed during this audit.
