import { runGroundedGroqPrompt } from "./ragService.js";

export async function handleNodeChat({ question, nodeData, clientContext, history }) {
  const systemInstruction = `You are an expert AI legal assistant embedded within a visual Knowledge Graph.
Your goal is to answer the user's question specifically about the selected legal section/node, IN THE CONTEXT of their client report.

--- CLIENT REPORT CONTEXT ---
${clientContext || "No specific client context provided. Answer generally."}

--- SELECTED NODE DATA ---
Section: ${nodeData.section || "N/A"}
Domain: ${nodeData.domain || "N/A"}
Content: ${nodeData.text || "N/A"}
Meaning: ${nodeData.meaning || "N/A"}
Reason Flagged: ${nodeData.reason || "N/A"}
Consequence: ${nodeData.consequence || "N/A"}

--- INSTRUCTIONS ---
1. Be direct, helpful, and highly professional.
2. Address the user's question referencing the specific node data and how it applies to the client report context.
3. If the user asks something completely unrelated to the node or the client context, politely steer them back.
4. Keep the answer concise (2-3 short paragraphs max) as this will be displayed in a small side drawer.
5. Do not include markdown headers (like # or ##) to save space, but you can use bolding or bullet points.`;

  try {
    const aiResponse = await runGroundedGroqPrompt({
      systemInstruction,
      history: history || [],
      prompt: question,
    });

    return aiResponse;
  } catch (error) {
    console.error("tempChatAgent Error:", error);
    throw new Error("Failed to generate response for node chat.");
  }
}
