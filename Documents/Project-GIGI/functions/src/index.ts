import { onCallGenkit } from "firebase-functions/v2/https";
import { gemini3ProPreview, googleAI } from "@genkit-ai/googleai";
import { defineFlow, run, configureGenkit } from "@genkit-ai/flow";
import { z } from "zod";

configureGenkit({
  plugins: [googleAI()],
  logLevel: "debug",
});

export const chatWithGigi = onCallGenkit({
  name: "chatWithGigi",
  inputSchema: z.object({
    history: z.array(z.any()),
    message: z.string(),
    persona: z.string(),
  }),
}, async (input) => {
  const response = await run("generate-response", async () => {
    const llmResponse = await generate({
      model: gemini3ProPreview,
      prompt: input.message,
      system: input.persona,
      history: input.history,
      config: { 
        temperature: 0.7,
        thinking_level: "high" 
      } 
    });
    return llmResponse.text();
  });
  return { text: response };
});