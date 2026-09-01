import { Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";

import {
  messageService,
  SendMessageInput,
  UpdateMessageInput,
} from "../services/message.service";

export async function createMessage(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { conversationId, body } = req.body as Partial<SendMessageInput>;

    if (typeof conversationId !== "string" || !conversationId.trim()) {
      return res.status(400).json({
        error: "conversationId is required",
      });
    }

    if (typeof body !== "string" || !body.trim()) {
      return res.status(400).json({
        error: "body is required",
      });
    }

    const message = await messageService.createMessage(req.user.id, {
      conversationId: conversationId.trim(),
      body: body.trim(),
    });

    return res.status(201).json({
      message,
    });
  } catch (error) {
    next(error);
  }
}

export async function getConversationMessages(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({
        error: "conversationId is required",
      });
    }

    let limit = 50;

    if (typeof req.query.limit === "string") {
      const parsedLimit = Number(req.query.limit);

      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        return res.status(400).json({
          error: "limit must be a positive integer",
        });
      }

      limit = parsedLimit;
    }

    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const result = await messageService.getConversationMessages(
      conversationId as string,
      req.user.id,
      {
        limit,
        cursor,
      },
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMessage(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: "Message id is required",
      });
    }

    const message = await messageService.getMessage(id as string, req.user.id);

    return res.status(200).json({
      message,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMessage(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { id } = req.params;

    const { body } = req.body as Partial<UpdateMessageInput>;

    if (!id) {
      return res.status(400).json({
        error: "Message id is required",
      });
    }

    if (typeof body !== "string" || !body.trim()) {
      return res.status(400).json({
        error: "body is required",
      });
    }

    const message = await messageService.updateMessage(id as string, req.user.id, {
      body: body.trim(),
    });

    return res.status(200).json({
      message,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteMessage(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: "Message id is required",
      });
    }

    const result = await messageService.deleteMessage(id as string, req.user.id);

    return res.status(200).json({
      message: "Message deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
