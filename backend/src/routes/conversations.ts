import { Router } from "express";

import { auth } from "../middleware/auth";

import {
  createDirectConversation,
  createGroupConversation,
  getConversations,
  getConversation,
  updateConversation,
  addParticipant,
  removeParticipant,
  markAsRead,
  leaveConversation,
  getUnreadCounts,
  getUnreadCount,
} from "../controllers/conversation.controller";

const router = Router();

router.post("/direct", auth, createDirectConversation);

router.post("/group", auth, createGroupConversation);

router.get("/", auth, getConversations);

router.get("/:id", auth, getConversation);

router.patch("/:id", auth, updateConversation);

router.post("/:id/participants", auth, addParticipant);

router.delete("/:id/participants/:userId", auth, removeParticipant);

router.patch("/:id/read", auth, markAsRead);

router.delete("/:id/leave", auth, leaveConversation);

router.get("/unread", auth, getUnreadCounts);

router.get("/unread/:id", auth, getUnreadCount);

export default router;
