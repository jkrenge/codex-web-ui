# Tests

This file tracks manual regression and feature verification steps.

## Template

### Feature: <name>

#### Prerequisites
- <required setup>

#### Steps
1. <action>
2. <action>

#### Expected Results
- <result>

#### Rollback/Cleanup
- <cleanup action, if any>

### Feature: Telegram bot token stored in dedicated global file

#### Prerequisites
- App server is running from this repository.
- A valid Telegram bot token is available.
- Access to `~/.codex/` on the host machine.

#### Steps
1. In the app UI, open Telegram connection and submit a bot token.
2. Verify file `~/.codex/telegram-bridge.json` exists.
3. Open `~/.codex/telegram-bridge.json` and confirm it contains a `botToken` field.
4. Restart the app server and call Telegram status endpoint from UI to confirm it still reports configured.

#### Expected Results
- Telegram token is persisted in `~/.codex/telegram-bridge.json`.
- Telegram bridge remains configured after restart.

#### Rollback/Cleanup
- Remove `~/.codex/telegram-bridge.json` to clear saved Telegram token.

### Feature: Telegram chatIds persisted for bot DM sending

#### Prerequisites
- App server is running from this repository.
- Telegram bot already configured in the app.
- Access to `~/.codex/telegram-bridge.json`.

#### Steps
1. Send `/start` to the Telegram bot from your DM.
2. Wait for the app to process the update, then open `~/.codex/telegram-bridge.json`.
3. Confirm `chatIds` contains your DM chat id as the first element.
4. In the app, reconnect Telegram bot with the same token.
5. Re-open `~/.codex/telegram-bridge.json` and confirm `chatIds` remains present.

#### Expected Results
- `chatIds` is written after Telegram DM activity.
- `chatIds` persists across bot reconfiguration.
- `botToken` and `chatIds` are both present in `~/.codex/telegram-bridge.json`.

#### Rollback/Cleanup
- Remove `chatIds` or delete `~/.codex/telegram-bridge.json` to clear persisted chat targets.

### Feature: Thread Kanban board with persisted local state

#### Prerequisites
- App server is running from this repository.
- At least two visible Codex threads exist in the UI.
- Access to `~/.codex/codexapp/kanban-state.json` on the host machine.

#### Steps
1. Open the sidebar thread organize menu and switch to `Kanban board`.
2. Confirm the board shows lanes for `Backlog`, `In progress`, `Review`, and `Closed / followup`.
3. Open a thread card menu in the board and move it to `In progress`.
4. Re-open `~/.codex/codexapp/kanban-state.json` and confirm the thread has an entry under `itemsByThreadId` with `status: "in_progress"`.
5. Refresh the browser and confirm the same thread still appears in the `In progress` lane.
6. Move that thread to `Archive`.
7. Confirm the thread disappears from the visible board and no longer appears in the regular project or chronological thread lists.

#### Expected Results
- A server-side JSON file is created at `~/.codex/codexapp/kanban-state.json`.
- Threads keep their Kanban status after refresh.
- Moving a thread to `Archive` hides it from the visible UI without calling the underlying Codex thread archive flow.

#### Rollback/Cleanup
- Move test threads back to their desired status before archiving them.
- If a thread was moved to `Archive`, edit `~/.codex/codexapp/kanban-state.json` and change its `status` to another lane, or delete the file to reset the board state.
