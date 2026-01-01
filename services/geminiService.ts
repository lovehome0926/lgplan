
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { OrderData, FileData, Language } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

export const analyzeDeal = async (
  orderData: OrderData, 
  masterKnowledge: string,
  memoFiles: FileData[] = []
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    console.error("Gemini Service: API_KEY is missing. Check your environment variables.");
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are the "LG Subscribe Senior Pricing Actuary". Your role is to calculate the absolute lowest price and present the most strategic plan.

    STRICT OUTPUT FORMAT (DO NOT ADD ANY INTRO OR OUTRO):
    [SAVED_AMOUNT]: RM [Insert calculated total savings amount here]
    
    💰 [DASHBOARD]
    - Original Total Cost: RM [Sum of standard prices]
    - Optimized Total Cost: RM [Sum after all promos applied]
    - Monthly Commitment: RM [Per month total]
    - Total Saving: RM [Total saved over contract period]
    
    📊 [CALCULATION BREAKDOWN]
    1. [Item Name]: [Original Price] -> [Promo Price] (Reason: [Mention Memo name])
    2. [Bundle/Combo]: [Discount value] (Reason: [Mention Memo name])
    3. [Settlement]: [If YES, apply Early Settlement Discount]
    
    💡 [WHY]
    - Concise bullet points explaining why this is the best deal.

    🎯 [STRATEGY NOTE]
    - Specific professional advice for the sales agent to maximize deal value.
    
    📢 [PITCH]
    - A 2-sentence powerful sales pitch for the customer.

    CAMPAIGN RULES:
    1. RM88 Picks Campaign:
       - For Washer & Dryer (Laundry): ALWAYS remind the agent to select models with higher "Regular Visit" prices. Since the promo is a flat rate, choosing the more expensive base model provides higher value.
       - For Refrigerators (Fridge): ALWAYS prioritize and recommend "Regular Visit 12M" packages.
    
    GENERAL RULES:
    - ALWAYS start with [SAVED_AMOUNT].
    - NO polite filler. 
    - If a price is missing, use Master Rules or standard market pricing.
    - If multiple promos conflict, use the one that saves the customer the MOST money.
    - LANGUAGE: ${orderData.language === Language.CN ? 'Chinese' : 'English'}.
  `;

  const prompt = `
    CUSTOMER ORDER DATA:
    - Status: ${orderData.customerType}
    - Products: ${orderData.products.map(p => `${p.quantity}x ${p.name} [${p.model}] for ${p.contract}`).join('; ')}
    - Early Settlement Discount Requested: ${orderData.wantsFullSettlement ? 'YES' : 'NO'}
    - Context: ${orderData.additionalContext || 'None'}

    KNOWLEDGE:
    - Rules: ${masterKnowledge || "Standard LG pricing."}
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
      }
    });

    if (!response.text) {
      throw new Error("EMPTY_RESPONSE");
    }

    return response.text;
  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    throw error;
  }
};
