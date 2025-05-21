
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// IMPORTANT: The API key MUST be obtained EXCLUSIVELY from the environment variable process.env.API_KEY.
// This variable is assumed to be pre-configured in the execution environment.
// If process.env.API_KEY is not set, the GoogleGenAI constructor will effectively use 'undefined',
// and API calls will fail. This is the expected behavior as per instructions.
const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } catch (e) {
    console.error("Failed to initialize GoogleGenAI. API_KEY might be invalid or missing.", e);
    ai = null; // Ensure ai is null if initialization fails
  }
} else {
  console.warn("Gemini API key (process.env.API_KEY) is not set. AI features requiring it will not work.");
}

const GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';

export const generateStreamTitle = async (keywords: string): Promise<string | null> => {
  if (!ai) {
    console.error("Gemini AI SDK not initialized. Cannot generate title.");
    return null;
  }
  if (!keywords || keywords.trim() === "") {
    console.warn("Keywords are empty. Skipping AI title generation.");
    return null;
  }

  const prompt = `Generate a catchy and short stream title, maximum 7 words, for a live stream described by the following keywords: "${keywords}". Be creative and fun. Example: if keywords are 'coding, react, fun', a title could be 'React Coding Fiesta!' or 'Joyful React Adventures'. If keywords are 'gaming, chess, strategy', a title could be 'Chess Grandmaster Moves' or 'Strategic Gaming Night'. Return only the title.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });
    
    const text = response.text; // Directly access the text property
    if (text) {
      return text.trim();
    }
    return null;
  } catch (error) {
    console.error("Error generating stream title with Gemini API:", error);
    // Consider how to handle different types of errors (e.g. API key issues, rate limits)
    // For now, just return null to indicate failure
    return null;
  }
};
