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

### Feature: Kanban board drag cards between columns

#### Prerequisites
- App server is running from this repository.
- The sidebar is visible in desktop layout.
- At least one visible thread exists in the `Backlog` lane after switching to `Kanban board`.

#### Steps
1. Open the sidebar thread organize menu and switch to `Kanban board`.
2. Drag a thread card from `Backlog` into the `In progress` lane.
3. Confirm the destination lane highlights while the card is dragged over it.
4. Drop the card and confirm it disappears from `Backlog` and appears in `In progress`.
5. Refresh the browser.
6. Confirm the same thread remains in `In progress`.

#### Expected Results
- Kanban cards can be dragged between visible columns.
- The hovered destination lane shows a visual drop state during drag.
- Dropping a card updates its lane immediately and persists after refresh.

#### Rollback/Cleanup
- Drag the test card back to its original lane, or move it back with the thread card menu.

### Feature: Kanban board expands sidebar for four-column layout

#### Prerequisites
- App server is running from this repository.
- Open the web UI on a desktop-width browser window.
- At least one visible thread exists in each Kanban lane, or enough threads to populate multiple lanes.

#### Steps
1. Open the sidebar thread organize menu and switch to `Kanban board`.
2. Confirm the desktop sidebar expands noticeably wider than the normal thread list width.
3. Verify `Backlog`, `In progress`, `Review`, and `Closed / followup` render side by side in a single row.
4. Switch the organize menu back to `Chronological list`.
5. Confirm the sidebar returns to its normal width.
6. Switch back to `Kanban board` and drag the desktop sidebar resize handle.
7. Confirm the resize handle continues to track the pointer cleanly while the expanded Kanban width updates.

#### Expected Results
- Desktop Kanban mode expands the sidebar enough to present four lanes in parallel.
- Non-Kanban modes keep the original sidebar width.
- Sidebar resizing remains usable after the Kanban width multiplier is applied.

#### Rollback/Cleanup
- Switch the organize menu back to `By project` or `Chronological list`.
- Reset the sidebar width with the resize handle if you changed it during testing.

### Feature: Composer clipboard image paste

#### Prerequisites
- App server is running from this repository.
- Open the web UI with a thread selected or the new-thread composer visible.
- Copy an image or screenshot into the system clipboard.

#### Steps
1. Click inside the chat composer textarea.
2. Paste the clipboard contents with `Cmd+V`.
3. Confirm an image thumbnail appears above the composer.
4. If the clipboard also contains plain text, confirm the text still pastes into the composer.
5. Click the image remove button and confirm the thumbnail disappears.
6. Paste the image again and send the message.

#### Expected Results
- Pasted clipboard images are added as composer image attachments without opening the file picker.
- Non-image text paste behavior continues to work normally.
- Attached pasted images can be removed before sending.
- Sent messages render the pasted image in the thread.

#### Rollback/Cleanup
- Remove any pasted attachments from the composer before leaving the thread.
