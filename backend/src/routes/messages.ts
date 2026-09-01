import { Router } from "express";

import { auth } from "../middleware/auth";
import { createMessage, getConversationMessages, getMessage, updateMessage, deleteMessage } from "../controllers/message.controller";

const router = Router();

router.post("/", auth, createMessage);
router.get("/conversation/:conversationId",auth,getConversationMessages);
router.get("/:id", auth, getMessage);
router.patch("/:id", auth, updateMessage);
router.delete("/:id", auth, deleteMessage);

export default router;
