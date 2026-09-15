-- SecureFile read-path performance indexes. Safe additive migration; no data is deleted.
-- Note: older GroupMember / legacy Message indexes were removed after Conversation chat refactor.
CREATE INDEX IF NOT EXISTS "User_companyId_status_createdAt_idx" ON "User"("companyId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_companyId_createdAt_idx" ON "Message"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "Conversation_companyId_updatedAt_idx" ON "Conversation"("companyId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_conversationId_idx" ON "ConversationParticipant"("userId", "conversationId");
