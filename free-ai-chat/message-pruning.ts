import { freeAIChatDB } from "./db";

const MAX_MESSAGES_PER_SESSION = parseInt(process.env.MAX_MESSAGES_PER_SESSION || "20");

export async function pruneMessages(sessionId: string): Promise<void> {
  const messageCount = await freeAIChatDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count
    FROM conversation_message
    WHERE session_id = ${sessionId}
  `;

  if (!messageCount || messageCount.count <= MAX_MESSAGES_PER_SESSION) {
    return;
  }

  const messagesToKeep = await freeAIChatDB.query<{ id: string }>`
    SELECT id
    FROM conversation_message
    WHERE session_id = ${sessionId}
    ORDER BY created_at DESC
    LIMIT ${MAX_MESSAGES_PER_SESSION}
  `;

  const idsToKeep: string[] = [];
  for await (const msg of messagesToKeep) {
    idsToKeep.push(msg.id);
  }

  if (idsToKeep.length === 0) {
    return;
  }

  const deletedTokens = await freeAIChatDB.query<{ token_count: number }>`
    DELETE FROM conversation_message
    WHERE session_id = ${sessionId}
      AND id != ALL(${idsToKeep})
    RETURNING token_count
  `;

  let totalDeletedTokens = 0;
  for await (const deleted of deletedTokens) {
    totalDeletedTokens += deleted.token_count;
  }

  const currentSession = await freeAIChatDB.queryRow<{
    total_messages: number;
    total_tokens_used: number;
  }>`
    SELECT total_messages, total_tokens_used
    FROM conversation_session
    WHERE id = ${sessionId}
  `;

  if (currentSession) {
    const newTotalMessages = Math.max(0, currentSession.total_messages - (messageCount.count - idsToKeep.length));
    const newTotalTokens = Math.max(0, currentSession.total_tokens_used - totalDeletedTokens);

    await freeAIChatDB.exec`
      UPDATE conversation_session
      SET total_messages = ${newTotalMessages},
          total_tokens_used = ${newTotalTokens},
          updated_at = NOW()
      WHERE id = ${sessionId}
    `;
  }
}
