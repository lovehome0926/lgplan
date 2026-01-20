
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { OrderData, FileData, Language } from "../types";

// 使用 Flash 模型，它在处理大文本 Knowledge 时响应更迅速，更不容易超时
const MODEL_NAME = 'gemini-3-flash-preview';

export const analyzeDealStream = async (
  orderData: OrderData, 
  masterKnowledge: string,
  memoFiles: FileData[] = [],
  onChunk: (text: string) => void
): Promise<void> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    console.error("Gemini Service: API_KEY is missing.");
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are the "LG Subscribe Senior Pricing Actuary". Your role is to calculate the absolute lowest price and present the most strategic plan using the provided 2026 Rule Set.

    STRICT OUTPUT FORMAT:
    [SAVED_AMOUNT]: RM [Insert calculated total savings amount here]
    
    💰 [DASHBOARD]
    - Original Total Cost: RM [Sum of standard prices]
    - Optimized Total Cost: RM [Sum after all promos applied]
    - Monthly Commitment: RM [Per month total]
    - Total Saving: RM [Total saved over contract period]
    
    📊 [CALCULATION BREAKDOWN]
    1. [Item Name]: [Original Price] -> [Promo Price] (Reason: [Mention Campaign Name])
    2. [Bundle/Combo]: [Discount value] (Reason: [Mention Double The Ong if applicable])
    3. [Settlement]: [If YES, apply Early Settlement Discount]
    
    💡 [WHY]
    - Concise bullet points explaining why this is the best deal.

    🎯 [STRATEGY NOTE]
    - Specific professional advice for the sales agent to maximize deal value.
    
    📢 [PITCH]
    - A 2-sentence powerful sales pitch for the customer.

    GENERAL RULES:
    - ALWAYS start with [SAVED_AMOUNT].
    - Apply Ohsem CNY 88% Deals (1st-8th month) and RM88 Picks correctly.
    - For 88% Deals, round UP the monthly fee to the nearest Ringgit.
    - LANGUAGE: ${orderData.language === Language.CN ? 'Chinese' : 'English'}.
  `;

  const prompt = `
    CUSTOMER ORDER DATA:
    - Status: ${orderData.customerType}
    - Products: ${orderData.products.map(p => `${p.quantity}x ${p.name} [${p.model}] for ${p.contract}`).join('; ')}
    - Early Settlement Discount Requested: ${orderData.wantsFullSettlement ? 'YES' : 'NO'}
    - Context: ${orderData.additionalContext || 'None'}

    KNOWLEDGE (2026 RULE SET):
    ${masterKnowledge || "Standard LG pricing."}
  `;

  const parts: any[] = [{ text: prompt }];

  // 仅在有实际文件且大小合理时添加
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
    const responseStream = await ai.models.generateContentStream({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts }],
      config: { 
        systemInstruction,
        temperature: 0.1, // 略微增加稳定性
      }
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      if (chunk.text) {
        fullText += chunk.text;
        onChunk(fullText);
      }
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error.message || error);
    // 向用户抛出错误，触发 UI 的报错提示
    throw error;
  }
};
