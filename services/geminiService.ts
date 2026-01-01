
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { OrderData, FileData, Language } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

export const analyzeDeal = async (
  orderData: OrderData, 
  masterKnowledge: string,
  memoFiles: FileData[] = []
): Promise<string> => {
  // 检查 API KEY
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    console.error("Critical: API_KEY is missing during execution.");
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are the "LG Subscribe Senior Pricing Actuary". Your goal is to provide 100% accurate pricing based EXCLUSIVELY on the provided LG Promo Memos and Master Rules.

    CRITICAL PRICING LOGIC:
    1. EXTRACT prices from PDF.
    2. APPLY bundle logic.
    3. FINAL 10% discount only if Full Settlement is YES.

    LANGUAGE: ${orderData.language === Language.CN ? 'Chinese' : 'English'}.
  `;

  const prompt = `
    CUSTOMER ORDER DATA:
    - Customer Status: ${orderData.customerType}
    - Product Details: ${orderData.products.map(p => `${p.quantity}x ${p.name} [${p.model}] for ${p.contract}`).join('; ')}
    - Full Settlement Requested: ${orderData.wantsFullSettlement ? 'YES' : 'NO'}
    - Knowledge: ${masterKnowledge || "Standard LG pricing."}
  `;

  const parts: any[] = [{ text: prompt }];

  for (const file of memoFiles) {
    if (file.base64 && file.base64.includes(',')) {
      parts.push({ 
        inlineData: { 
          data: file.base64.split(',')[1], 
          mimeType: file.mimeType 
        } 
      });
    }
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ parts }],
      config: { 
        systemInstruction,
        temperature: 0,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return response.text || "No response from AI.";
  } catch (error: any) {
    console.error("Gemini API detailed error:", error);
    // 抛出带有状态码的错误信息
    throw new Error(error.message || "Unknown API Error");
  }
};
