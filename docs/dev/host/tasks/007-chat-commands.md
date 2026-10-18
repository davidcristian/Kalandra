# Chat commands do in the game what the pages say

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows, and a second player who whispers the character
**Origin:** [docs/chat-commands.md](../../../chat-commands.md)
**Verified:** 2026-10-18

**Claims.** `typeInChat` in `main/src/shortcuts/text-box.ts` only presses keys and pastes text. What
happens next is the game's behavior. [docs/chat-commands.md](../../../chat-commands.md),
[docs/quick-start.md](../../../quick-start.md) and [modules/main.md](../../modules/main.md) say:

- F5 sends `/hideout`, which takes the character to the hideout, and F9 sends `/exit`, which goes
  to the character selection screen (the `commands` in `defaultConfig()`).
- For text that does not start with `#`, `%`, `@`, `$`, `&` or `/`, Kalandra presses Ctrl + A
  after Enter opens the chat, so the paste replaces any text already in the box. For text that
  starts with one of them it skips Ctrl + A. That list is named `AUTO_CLEAR` in `text-box.ts`.
  Whether the game clears the box for such text is the open question.
- `@last` stands for the character last whispered with, or who last whispered the character. For
  text that starts with `@last `, Kalandra presses Ctrl + Enter, which opens the chat with a
  whisper to that character, and pastes the rest after it. For text that ends with `@last`, it
  presses Ctrl + Enter, then Home twice and Delete to remove the `@`, and pastes the text before
  `@last`. So `/invite @last` sends `/invite` and that name, and `/tradewith @last` and
  `/hideout @last` work the same way.
- After sending, Kalandra presses Enter, ArrowUp twice and Escape, which a comment in `text-box.ts`
  names as restoring the last chat. To see the text Kalandra sent, open the chat with Enter and
  press ArrowUp twice.
- `/kick <your character name>` leaves the party.

**Do.** [Section 5 of the runbook](../../runbooks/in-game-check.md#5-chat-commands). Type some text
in the chat box without sending it, close the box with Escape, and press F5. Give `@last ty`,
`/invite @last` and a `/kick` command keys, have the second player whisper the character, and
press each. Do not press keys fast on purpose to provoke a disconnect.

**Pass.** Each command does what its row in docs/chat-commands.md says. F5 sends `/hideout` alone,
without the text left in the box. Enter then ArrowUp twice shows the sent text.

**Record.** Any difference goes into docs/chat-commands.md, in the same commit as this file's
History line.

## History

- 2026-10-18: Filed from the chat claims the writer of docs/chat-commands.md could not settle from
  the code, which only types the text.
