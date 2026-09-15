-- SecureFile read-path performance indexes. Safe additive migration; no data is deleted.
CREATE INDEX IF NOT EXISTS "User_companyId_status_createdAt_idx" ON "User"("companyId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "GroupMember_userId_groupId_idx" ON "GroupMember"("userId", "groupId");
CREATE INDEX IF NOT EXISTS "Message_companyId_senderId_createdAt_idx" ON "Message"("companyId", "senderId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_companyId_recipientId_createdAt_idx" ON "Message"("companyId", "recipientId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_groupId_createdAt_idx" ON "Message"("groupId", "createdAt");
