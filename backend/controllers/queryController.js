import {
  analyzeSubmissionAgainstRules,
  answerQuestion,
} from "../services/ragService.js";
import { buildComplianceReport } from "../services/reportService.js";
import { translateChatSessionsAtReadTime } from "../services/translationService.js";
import UserChat from "../models/UserChat.js";

function normalizeChatItem(chat, index = 0) {
  return {
    id: chat?._id?.toString?.() ?? `${chat?.askedAt || Date.now()}-${index}`,
    mode: chat?.mode || "chat",
    language: chat?.language || "en",
    question: chat?.question || "",
    answer: chat?.answer || "",
    sources: Array.isArray(chat?.sources) ? chat.sources : [],
    review: chat?.review ?? null,
    askedAt: chat?.askedAt || null,
  };
}

function createChatSessionTitle(sessionCount) {
  return `Chat ${sessionCount + 1}`;
}

function normalizeChatSession(session, index = 0) {
  const conversations = Array.isArray(session?.conversations)
    ? session.conversations.map((chat, conversationIndex) =>
        normalizeChatItem(chat, conversationIndex),
      )
    : [];
  const latestConversation = conversations[conversations.length - 1] || null;

  return {
    id: session?._id?.toString?.() ?? `chat-${index + 1}`,
    title: session?.title?.trim() || `Chat ${index + 1}`,
    mode: session?.mode || latestConversation?.mode || "chat",
    language: session?.language || latestConversation?.language || "en",
    createdAt:
      session?.createdAt || conversations[0]?.askedAt || latestConversation?.askedAt || null,
    lastAskedAt: session?.lastAskedAt || latestConversation?.askedAt || null,
    previewQuestion: latestConversation?.question || "",
    previewAnswer: latestConversation?.answer || "",
    conversationCount: conversations.length,
    conversations,
  };
}

async function migrateLegacyChats(userChat) {
  if (!userChat) return userChat;

  const hasSessions =
    Array.isArray(userChat.chatSessions) && userChat.chatSessions.length > 0;
  const rawDocument = userChat.toObject({ depopulate: true });
  const legacyChats = Array.isArray(rawDocument?.chats) ? rawDocument.chats : [];

  if (hasSessions || legacyChats.length === 0) {
    return userChat;
  }

  const firstAskedAt = legacyChats[0]?.askedAt || new Date();
  const lastAskedAt =
    legacyChats[legacyChats.length - 1]?.askedAt || firstAskedAt;

  userChat.chatSessions = [
    {
      title: createChatSessionTitle(0),
      mode: legacyChats[0]?.mode || "chat",
      conversations: legacyChats,
      createdAt: firstAskedAt,
      lastAskedAt,
    },
  ];
  userChat.set("chats", undefined, { strict: false });

  await userChat.save();

  return userChat;
}

export async function queryKnowledgeBase(req, res) {
  try {
    const mode = req.body?.mode?.trim() || "chat";
    const language = req.preferredLanguage || "en";
    const query = req.body?.query?.trim();
    const submission = req.body?.submission?.trim();
    const history = req.body?.history ?? [];
    const sessionId = req.body?.sessionId?.trim();

    if (mode === "compliance_review" && !submission) {
      return res.status(400).json({
        success: false,
        error: "submission is required when mode is compliance_review.",
      });
    }

    if (mode !== "compliance_review" && !query) {
      return res.status(400).json({
        success: false,
        error: "Query is required.",
      });
    }

    const result =
      mode === "compliance_review"
        ? await analyzeSubmissionAgainstRules(submission, history, language)
        : await answerQuestion(query, history, language);
    const userMessage = mode === "compliance_review" ? submission : query;

    const chatItem = {
      mode,
      language,
      question: userMessage,
      answer: result.answer,
      sources: result.sources ?? [],
      review: result.review ?? null,
      askedAt: new Date(),
    };

    let userChat = await UserChat.findOne({ userId: req.user._id });
    if (!userChat) {
      userChat = new UserChat({
        userId: req.user._id,
        chatSessions: [],
      });
    }

    userChat = await migrateLegacyChats(userChat);

    let targetSession =
      sessionId && typeof userChat.chatSessions?.id === "function"
        ? userChat.chatSessions.id(sessionId)
        : null;

    if (!targetSession || targetSession.mode !== mode) {
      userChat.chatSessions.push({
        title: createChatSessionTitle(userChat.chatSessions.length),
        mode,
        language,
        conversations: [],
        createdAt: chatItem.askedAt,
        lastAskedAt: chatItem.askedAt,
      });
      targetSession = userChat.chatSessions[userChat.chatSessions.length - 1];
    }

    targetSession.conversations.push(chatItem);
    targetSession.language = language;
    if (targetSession.conversations.length > 100) {
      targetSession.conversations = targetSession.conversations.slice(-100);
    }
    targetSession.lastAskedAt = chatItem.askedAt;

    await userChat.save();

    const normalizedSession = normalizeChatSession(
      targetSession,
      userChat.chatSessions.findIndex(
        (session) => session._id?.toString() === targetSession._id?.toString(),
      ),
    );

    return res.json({
      success: true,
      mode,
      language,
      answer: result.answer,
      sources: result.sources,
      review: result.review,
      chatSession: normalizedSession,
    });
  } catch (error) {
    console.error("Query route failed:", error);
    return res.status(500).json({
      success: false,
      error:
        error.message || "Something went wrong while answering the question.",
    });
  }
}

export async function exportComplianceReport(req, res) {
  try {
    const format = req.query?.format?.trim()?.toLowerCase() || "pdf";
    const sessionId = req.query?.sessionId?.trim();
    const messageId = req.query?.messageId?.trim();

    if (!sessionId || !messageId) {
      return res.status(400).json({
        success: false,
        error: "sessionId and messageId are required.",
      });
    }

    if (!["pdf", "excel", "xlsx"].includes(format)) {
      return res.status(400).json({
        success: false,
        error: "Unsupported format. Use pdf or excel.",
      });
    }

    const userChat = await UserChat.findOne({ userId: req.user._id });
    if (!userChat) {
      return res.status(404).json({
        success: false,
        error: "No chat history found for this user.",
      });
    }

    const session =
      typeof userChat.chatSessions?.id === "function"
        ? userChat.chatSessions.id(sessionId)
        : null;

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Chat session not found.",
      });
    }

    const message =
      typeof session.conversations?.id === "function"
        ? session.conversations.id(messageId)
        : null;

    if (!message || message.mode !== "compliance_review") {
      return res.status(404).json({
        success: false,
        error: "Compliance review message not found.",
      });
    }

    if (!message.review || !Array.isArray(message.review?.lineReviews)) {
      return res.status(422).json({
        success: false,
        error:
          "Structured review JSON is not available for this item. Run a new compliance review to export.",
      });
    }

    const report = await buildComplianceReport({
      format,
      sessionTitle: session.title,
      messageId: message._id?.toString?.() || messageId,
      askedAt: message.askedAt,
      submission: message.question,
      answer: message.answer,
      review: message.review,
      sources: Array.isArray(message.sources) ? message.sources : [],
      language: message.language || req.preferredLanguage || "en",
    });

    return res
      .status(200)
      .set({
        "Content-Type": report.contentType,
        "Content-Disposition": `attachment; filename=\"${report.fileName}\"`,
        "Content-Length": report.buffer.length,
      })
      .send(report.buffer);
  } catch (error) {
    console.error("Export compliance report failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Could not export compliance report.",
    });
  }
}

export async function getUserChatHistory(req, res) {
  try {
    const language = req.preferredLanguage || "en";
    let userChat = await UserChat.findOne({ userId: req.user._id });
    userChat = await migrateLegacyChats(userChat);
    const normalizedChatSessions = Array.isArray(userChat?.chatSessions)
      ? userChat.chatSessions.map((session, index) =>
          normalizeChatSession(session, index),
        )
      : [];
    let chatSessions = normalizedChatSessions;

    try {
      chatSessions = await translateChatSessionsAtReadTime(
        normalizedChatSessions,
        language,
      );
    } catch (translationError) {
      console.warn(
        "History translation failed, returning original chat sessions.",
        translationError.response?.data || translationError.message,
      );
    }

    return res.json({
      success: true,
      language,
      chatSessions,
    });
  } catch (error) {
    console.error("Get chat history route failed:", error);
    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Something went wrong while fetching the user's chat history.",
    });
  }
}
