import { GoogleGenAI } from "@google/genai";

const globalForGemini = globalThis as unknown as {
  geminiClient?: GoogleGenAI;
};

export function getGeminiClient(): GoogleGenAI {
  if (!globalForGemini.geminiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set. Add it to .env (see .env.example) to use AI search.");
    }
    globalForGemini.geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return globalForGemini.geminiClient;
}