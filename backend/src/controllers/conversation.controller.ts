import { Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";

import {
  conversationService,
  CreateDirectConversationInput,
  CreateGroupConversationInput,
  UpdateConversationInput,
  AddParticipantInput,
} from "../services/conversation.service";

export async function createDirectConversation(
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

    const { userId } = req.body as Partial<CreateDirectConversationInput>;

    if (typeof userId !== "string" || !userId.trim()) {
      return res.status(400).json({
        error: "userId is required",
      });
    }

    const conversation = await conversationService.createDirectConversation(
      req.user.id,
      req.user.companyId as string | null ?? "",
      {
        userId: userId.trim(),
      },
    );

    return res.status(200).json({
      conversation,
    });
  } catch (error) {
    next(error);
  }
}

export async function createGroupConversation(
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

    if (!req.user.companyId) {
      return res.status(400).json({
        error: "User is not associated with a company",
      });
    }

    const { name, participantIds } =
      req.body as Partial<CreateGroupConversationInput>;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: "name is required",
      });
    }

    if (!Array.isArray(participantIds)) {
      return res.status(400).json({
        error: "participantIds must be an array",
      });
    }

    const conversation = await conversationService.createGroupConversation(
      req.user.id,
      req.user.companyId,
      {
        name: name.trim(),
        participantIds,
      },
    );

    return res.status(201).json({
      conversation,
    });
  } catch (error) {
    next(error);
  }
}

export async function getConversations(
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

    let limit = 30;

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

    const result = await conversationService.getUserConversations(
      req.user.id,
      req.user.companyId ?? null,
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

export async function getConversation(
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
        error: "Conversation id is required",
      });
    }

    const conversation = await conversationService.getConversationById(
      id as string,
      req.user.id,
      req.user.companyId ?? null,
    );

    return res.status(200).json({
      conversation,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateConversation(
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

    if (!req.user.companyId) {
      return res.status(400).json({
        error: "User is not associated with a company",
      });
    }

    const { id } = req.params;

    const { name } = req.body as Partial<UpdateConversationInput>;

    if (!id) {
      return res.status(400).json({
        error: "Conversation id is required",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: "name is required",
      });
    }

    const conversation = await conversationService.updateConversation(
      id as string,
      req.user.id,
      req.user.companyId,
      {
        name: name.trim(),
      },
    );

    return res.status(200).json({
      conversation,
    });
  } catch (error) {
    next(error);
  }
}

export async function addParticipant(
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

    if (!req.user.companyId) {
      return res.status(400).json({
        error: "User is not associated with a company",
      });
    }

    const { id } = req.params;

    const { userId } = req.body as Partial<AddParticipantInput>;

    if (!id) {
      return res.status(400).json({
        error: "Conversation id is required",
      });
    }

    if (typeof userId !== "string" || !userId.trim()) {
      return res.status(400).json({
        error: "userId is required",
      });
    }

    const participant = await conversationService.addParticipant(
      id as string,
      req.user.id,
      req.user.companyId,
      {
        userId: userId.trim(),
      },
    );

    return res.status(201).json({
      participant,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeParticipant(
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

    if (!req.user.companyId) {
      return res.status(400).json({
        error: "User is not associated with a company",
      });
    }

    const { id, userId } = req.params;

    if (!id || !userId) {
      return res.status(400).json({
        error: "Conversation id and userId are required",
      });
    }

    const result = await conversationService.removeParticipant(
      id as string,
      req.user.id,
      userId as string,
      req.user.companyId,
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(
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
        error: "Conversation id is required",
      });
    }

    const result = await conversationService.markConversationAsRead(
      id as string,
      req.user.id,
      req.user.companyId ?? null,
    );

    return res.status(200).json({
      participant: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function leaveConversation(
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

    if (!req.user.companyId) {
      return res.status(400).json({
        error: "User is not associated with a company",
      });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: "Conversation id is required",
      });
    }

    const result = await conversationService.leaveConversation(
      id as string,
      req.user.id,
      req.user.companyId,
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCounts(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const result =
      await conversationService.getUnreadCounts(
        req.user.id,
        req.user.companyId ?? null
      );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCount(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
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
        error:
          "Conversation id is required",
      });
    }

    const result =
      await conversationService.getUnreadCount(
        id as string,
        req.user.id,
        req.user.companyId ?? null
      );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}