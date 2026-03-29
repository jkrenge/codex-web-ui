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

### Feature: Kanban board lane changes persist from menu and drag

#### Prerequisites
- App server is running from this repository.
- The sidebar is visible in desktop layout with `Kanban board` enabled.
- At least one visible thread exists in the board.
- Access to `~/.codex/codexapp/kanban-state.json` on the host machine.

#### Steps
1. Open a thread card menu and move the card from its current lane to `Review`.
2. Confirm the card leaves its original lane immediately and appears in `Review`.
3. Open `~/.codex/codexapp/kanban-state.json` and confirm that thread entry now has `status: "review"`.
4. Drag the same card from `Review` to `Closed / followup`.
5. Confirm the card leaves `Review` immediately and appears in `Closed / followup`.
6. Re-open `~/.codex/codexapp/kanban-state.json` and confirm the same thread entry now has `status: "closed_followup"`.
7. Refresh the browser and confirm the card remains in `Closed / followup`.

#### Expected Results
- Menu-based lane changes update the board immediately.
- Drag-and-drop lane changes update the board immediately.
- `~/.codex/codexapp/kanban-state.json` matches the latest lane after each move.
- The card stays in the chosen lane after refresh.

#### Rollback/Cleanup
- Move the test card back to its original lane after verification.
- Delete `~/.codex/codexapp/kanban-state.json` if you need to reset local kanban state completely.

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

### Feature: Dual Kanban boards and thread-state badges

#### Prerequisites
- App server is running from this repository.
- Open the web UI on a desktop-width browser window.
- The sidebar is visible and switched to `Kanban board`.
- At least two visible threads exist so one can stay on the top board and one can be moved to `Implementation Tasks`.
- Access to `~/.codex/codexapp/kanban-state.json` on the host machine.

#### Steps
1. Open the sidebar thread organize menu and switch to `Kanban board`.
2. Confirm the existing four-lane board still renders first and a second board labeled `Implementation Tasks` renders below it with the same four lane headers.
3. Create a new thread or fork an existing thread, then return to the Kanban view and confirm the new card appears on the top board in `Backlog`.
4. Drag a card from the top board into the `Implementation Tasks` board and drop it in `Review`.
5. Confirm the card leaves the top board, appears in the lower board `Review` lane, and `~/.codex/codexapp/kanban-state.json` now shows that thread entry with `"board": "implementation"` and `"status": "review"`.
6. Open the moved card menu and choose `Move to top board`.
7. Confirm the card returns to the top board while staying in `Review`.
8. Rename a thread so its title starts with `💤 ` and another so it starts with `⏳ `, or use the content header buttons described below.
9. Confirm the Kanban cards remove those emojis from the visible title, show `Waiting` or `In review` as a small badge beside the project name, keep the unread blue dot inline with the title row, and keep the age right-aligned on that same top row.
10. Select one of those threads and use the content header buttons `Pending` and `Waiting for review`.
11. Confirm clicking one button prepends the matching emoji to the stored thread name, clicking the other swaps the emoji, and clicking the active button again removes the managed emoji prefix.
12. Refresh the browser and confirm the selected board, lane, and derived badge state all persist.

#### Expected Results
- Kanban mode renders two stacked boards: the original unlabeled top board and a lower board labeled `Implementation Tasks`.
- New threads and forks default to the top board `Backlog`.
- Drag-and-drop and menu actions can move cards between boards without changing the chosen lane unless requested.
- Card styling uses a lighter shadow and selected cards keep their normal background while switching to a blue active border.
- Managed `💤` and `⏳` prefixes are hidden from Kanban card titles and appear instead as `Waiting` and `In review` badges.
- Content header buttons keep the managed title prefixes mutually exclusive and stay in sync with the sidebar after refresh.

#### Rollback/Cleanup
- Move any test cards back to their original board and lane.
- Remove any temporary `💤` or `⏳` prefixes from thread names with the header buttons or thread rename action.
- Delete or edit `~/.codex/codexapp/kanban-state.json` only if you want to reset local Kanban board placement state completely.

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

### Feature: Skills dropdown closes after selection in composer

#### Prerequisites
- App is running from this repository.
- At least one thread exists and can be selected.
- At least one installed skill is available.

#### Steps
1. Open an existing thread so the message composer is enabled.
2. Click the `Skills` dropdown in the composer footer.
3. Click any skill option in the dropdown list.
4. Re-open the `Skills` dropdown and click the same skill again to unselect it.

#### Expected Results
- The skills dropdown closes immediately after each selection click.
- Selected skill appears as a chip above the composer input when checked.
- Skill chip is removed when the skill is unchecked on the next selection.

#### Rollback/Cleanup
- Remove the selected skill chip(s) before leaving the thread, if needed.

### Feature: Skills Hub manual search trigger

#### Prerequisites
- App is running from this repository.
- Open the `Skills Hub` view.

#### Steps
1. Type a unique query value in the Skills Hub search input (for example: `docker`), but do not press Enter or click Search yet.
2. Confirm the browse results do not refresh immediately while typing.
3. Click the `Search` button.
4. Change the query text to another value and press Enter in the input.
5. Clear the query, then click `Search` to reload the default browse list.

#### Expected Results
- Typing alone does not trigger remote Skills Hub search requests.
- Results refresh only after explicit submit via the `Search` button or Enter key.
- Empty-state text (if shown) references the last submitted query.
- Submitting an empty query returns the default skills listing.

#### Rollback/Cleanup
- Clear the search input and run a blank search to return to default listing.

### Feature: Dark theme for trending GitHub projects and local project dropdown

#### Prerequisites
- App is running from this repository.
- Home/new-thread screen is open.
- Appearance is set to `Dark` in Settings.
- `GitHub trending projects` setting is enabled.

#### Steps
1. On the home/new-thread screen, inspect the `Choose folder` dropdown trigger.
2. Open the `Choose folder` dropdown and confirm menu/option contrast remains readable in dark mode.
3. Inspect the `Trending GitHub projects` section title, scope dropdown, and project cards.
4. Hover a trending project card and the scope dropdown trigger.
5. Toggle appearance back to `Light`, then return to `Dark`.

#### Expected Results
- Local project dropdown trigger/value uses dark theme colors with readable contrast.
- Trending section title, empty/loading text, scope dropdown, and cards use dark backgrounds/borders/text.
- Hover states in dark mode stay visible and do not switch to light backgrounds.
- Theme switch back/forth preserves correct styling for both controls.

#### Rollback/Cleanup
- Reset appearance to the previous user preference.

### Feature: Dark theme for worktree runtime selector and Skills Hub

#### Prerequisites
- App is running from this repository.
- Appearance is set to `Dark` in Settings.
- Skills Hub route is accessible.

#### Steps
1. Open the home/new-thread screen and inspect the `Local project / New worktree` runtime selector trigger.
2. Open the runtime selector and verify menu title, options, selected state, and checkmark visibility in dark mode.
3. Trigger a worktree action that shows worktree status and verify running/error status blocks remain readable in dark mode.
4. Open `Skills Hub` and verify header/subtitle, search bar, search/sort buttons, sync panel, badges, and status text.
5. Verify at least one skill card surface (title, owner, description, date, browse icon) in dark mode.
6. Open a skill detail modal and verify panel, title/owner, close button, README/body text, and footer actions in dark mode.

#### Expected Results
- Runtime dropdown trigger and menu use dark backgrounds, borders, and readable text/icons.
- Worktree status blocks use dark-friendly contrast for both running and error states.
- Skills Hub controls and sync panel are fully dark-themed with consistent hover/active states.
- Skill cards and the skill detail modal render with dark theme colors and accessible contrast.

#### Rollback/Cleanup
- Reset appearance to the previous user preference.

### Feature: Markdown file links with backticks and parentheses render correctly

#### Prerequisites
- App is running from this repository.
- An active thread is open.
- Local file exists at `/root/New Project (1)/qwe.txt`.

#### Steps
1. Send a message containing: `Done. Created [`/root/New Project (1)/qwe.txt`](/root/New Project (1)/qwe.txt) with content:`.
2. In the rendered assistant message, click the `/root/New Project (1)/qwe.txt` link.
3. Right-click the same link and choose `Copy link` from the context menu.
4. Paste the copied link into a text field and inspect it.

#### Expected Results
- The markdown link renders as one clickable file link (not split into partial tokens).
- Clicking opens the local browse route for the full file path.
- Copied link includes the full encoded path and still resolves to the same file.

#### Rollback/Cleanup
- Delete `/root/New Project (1)/qwe.txt` if it was created only for this test.

### Feature: Runtime selector uses a toggle-style control

#### Prerequisites
- App is running from this repository.
- Home/new-thread screen is open.

#### Steps
1. On the home/new-thread screen, locate the runtime control below `Choose folder`.
2. Verify both options (`Local project` and `New worktree`) are visible at once without opening a menu.
3. Click `New worktree` and confirm it becomes the selected option style.
4. Click `Local project` and confirm selection returns.
5. Set Appearance to `Dark` in Settings and verify selected/unselected contrast remains readable.

#### Expected Results
- Runtime mode is presented as a two-option toggle (segmented control), not a dropdown menu.
- Clicking each option immediately switches the selected state.
- Selected option has a distinct active background/border in both light and dark themes.

#### Rollback/Cleanup
- Leave runtime mode and appearance at the previous user preference.

### Feature: Dark theme states for runtime mode toggle

#### Prerequisites
- App is running from this repository.
- Home/new-thread screen is open.
- Appearance is set to `Dark` in Settings.

#### Steps
1. Locate the runtime mode toggle (`Local project` and `New worktree`) under `Choose folder`.
2. Hover each option and verify hover state is visible against dark backgrounds.
3. Select `New worktree`, then select `Local project` and compare active/inactive contrast.
4. Tab to the toggle options with keyboard navigation and verify the focus ring is visible.
5. Confirm icon color remains readable for selected and unselected options.

#### Expected Results
- Toggle container, options, and text/icons use dark-friendly colors.
- Hover and selected states are clearly distinguishable in dark mode.
- Keyboard focus ring is visible and does not blend into the background.

#### Rollback/Cleanup
- Return appearance and runtime selection to the previous user preference.

### Feature: pnpm dev script installs dependencies and starts Vite

#### Prerequisites
- `pnpm` is installed globally (`npm i -g pnpm` or via corepack).
- Repository is cloned and `node_modules/` does not exist (or may be stale).

#### Steps
1. Remove `node_modules/` if present: `rm -rf node_modules`.
2. Run `pnpm run dev`.
3. Wait for Vite dev server to start and display the local URL.
4. Open the displayed URL in a browser.

#### Expected Results
- `pnpm install` runs automatically before Vite starts (dependencies are installed).
- Vite dev server starts successfully and serves the app.
- No `npm` commands are invoked.

#### Rollback/Cleanup
- None.

### Feature: Stop button interrupts active turn without missing turnId

#### Prerequisites
- App is running from this repository.
- At least one thread can run a long response (for example, request a large code explanation).

#### Steps
1. Send a prompt that keeps the assistant generating for several seconds.
2. Immediately click the `Stop` button before the first assistant chunk fully completes.
3. Confirm generation halts.
4. Repeat with a resumed/existing in-progress thread (reload app while a turn is running, then click `Stop`).

#### Expected Results
- No error appears saying `turn/interrupt requires turnId`.
- Turn is interrupted successfully in both immediate-stop and resumed-thread scenarios.
- Thread state exits in-progress and the stop control returns to idle.

#### Rollback/Cleanup
- None.

### Feature: Revert PR #16 mobile viewport and chat scroll behavior changes

#### Prerequisites
- App is running from this repository.
- A thread exists with enough messages to scroll.
- Test on a mobile-sized viewport (for example 375x812).

#### Steps
1. Open an existing thread and scroll up to the middle of the chat history.
2. Wait for an assistant response to stream while staying at the same scroll position.
3. Send a follow-up message and observe chat positioning when completion finishes.
4. Open the composer on mobile and drag within the composer area.
5. Open/close the on-screen keyboard on mobile and verify the page layout remains usable.

#### Expected Results
- Chat behavior matches pre-PR #16 baseline (no PR #16 scroll-preservation logic active).
- No regressions from reverting PR #16 changes in conversation rendering and composer behavior.
- Mobile layout no longer includes PR #16 visual-viewport sync changes.

#### Rollback/Cleanup
- Re-apply PR #16 commits if the reverted behavior is not desired.

### Feature: Thread load capped to latest 10 turns

#### Prerequisites
- App is running from this repository.
- At least one thread exists with more than 10 turns/messages.

#### Steps
1. Open a long thread that previously caused UI lag during initial load.
2. While the thread is loading, immediately click another thread in the sidebar.
3. Return to the long thread.
4. Count visible loaded history blocks and confirm only the newest portion is shown.
5. Call `/codex-api/rpc` with method `thread/read` for the same thread and inspect `result.thread.turns.length`.
6. Call `/codex-api/rpc` with method `thread/resume` for the same thread and inspect `result.thread.turns.length`.

#### Expected Results
- Initial thread load renders only the most recent 10 turns.
- UI remains responsive during thread load.
- You can switch to another thread without the UI freezing.
- `thread/read` and `thread/resume` RPC responses contain at most 10 turns.

#### Rollback/Cleanup
- No cleanup required.

### Feature: Skills list request scoped to active thread cwd

#### Prerequisites
- App is running from this repository.
- Browser DevTools Network tab is open.
- At least two threads exist with different `cwd` values.

#### Steps
1. Reload the app and wait for initial data load.
2. In Network tab, inspect `/codex-api/rpc` requests with method `skills/list`.
3. Verify request params contain `cwds` with only the currently selected thread cwd.
4. Switch to another thread with a different cwd.
5. Inspect the next `skills/list` request and verify `cwds` now contains only the new selected thread cwd.

#### Expected Results
- `skills/list` no longer sends every thread cwd in one request.
- Each `skills/list` call includes at most one cwd for the active thread context.
- Skills list still updates when changing selected thread.

#### Rollback/Cleanup
- No cleanup required.

### Feature: Kanban card visual refinements

#### Prerequisites
- App server is running and accessible.
- At least a few threads exist across different kanban lanes (backlog, in progress, review).
- Some threads have "In review" or "Waiting" badges.

#### Steps
1. Open the sidebar in kanban board view.
2. Inspect card border-radius — should be small (~6px), not heavily rounded.
3. Check card inner padding — should be compact (12px horizontal, 8px vertical).
4. Look at the relative timestamps (e.g. "9m", "6d") — font should be noticeably smaller than the title text.
5. Verify badges ("In review", "Waiting") display in normal case (not ALL CAPS), no extra letter-spacing, with a small rounded-md shape.
6. Confirm the worktree fork icon no longer appears on kanban cards.
7. Verify card titles have more horizontal space, with the timestamp right-aligned.
8. Check vertical spacing between cards in each lane — should have slightly more breathing room than before.

#### Expected Results
- Cards look compact and utilitarian with small corner radius.
- Timestamps are visually secondary (small, lighter color).
- Badges resemble GitHub-style labels (lowercase, tight, small radius).
- No worktree icon visible on kanban cards.
- Cards have adequate vertical spacing between them.

#### Rollback/Cleanup
- Revert changes in `src/components/sidebar/SidebarThreadTree.vue` if needed.
