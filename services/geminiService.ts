
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { OrderData, FileData, Language } from "../types";

// Using Pro version for better reasoning and mathematical precision
const MODEL_NAME = 'gemini-3-pro-preview';

export const analyzeDeal = async (
  orderData: OrderData, 
  masterKnowledge: string,
  memoFiles: FileData[] = []
): Promise<string> => {
  // Fix: Obtained exclusively from process.env.API_KEY as per instructions.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const parts: any[] = [];

  const systemInstruction = `
    You are the "LG Subscribe Senior Pricing Actuary". Your goal is to provide 100% accurate pricing based EXCLUSIVELY on the provided LG Promo Memos and Master Rules.

    CRITICAL PRICING LOGIC:
    1. EXTRACT: Find the exact monthly rental price for each model in the PDF.
    2. MULTIPLY: Monthly Price x Quantity x Contract Months = Gross Total.
    3. BUNDLE DISCOUNTS: Check if multiple products trigger a "Multi-Purchase" or "Combo" rebate (e.g., 2 items = -RM10/mo, 3 items = -RM15/mo).
    4. LOYALTY: Check if "Existing Customer" gets an extra rebate (e.g., -RM15/mo).
    5. SETTLEMENT: If 'Wants Full Settlement' is YES, apply a FINAL 10% discount on the REMAINING balance after all monthly rebates.
    6. VERIFY: Double-check all subtractions. Do not hallucinate prices.

    OUTPUT STRUCTURE (Strictly follow this):
    [SAVED_AMOUNT]: [Total money saved in RM]
    
    💰 [DASHBOARD]
    - Standard Total: [Total cost without any promos]
    - Optimized Total: [Final cost after all promos]
    - Monthly Installment: [Final Monthly Amount per item]
    
    📊 [CALCULATION BREAKDOWN]
    - Base: [Model Name] @ [Original Price]
    - Promo: [Name of promo found in PDF] -> [Discount Value]
    - Multi-item: [Rebate value if applicable]
    - Full Settlement: [10% Deduction if applicable]
    
    💡 [WHY]
    - [Brief logic explanation]
    
    📢 [PITCH]
    - [Sales pitch for customer]

    LANGUAGE: ${orderData.language === Language.CN ? 'Chinese' : 'English'}.
    NO CHATTER. START DIRECTLY WITH [SAVED_AMOUNT].
  `;

  const prompt = `
    CUSTOMER ORDER DATA:
    - Customer Status: ${orderData.customerType}
    - Product Details: ${orderData.products.map(p => `${p.quantity}x ${p.name} [${p.model}] for ${p.contract}`).join('; ')}
    - Full Settlement Requested: ${orderData.wantsFullSettlement ? 'YES (Apply 10% additional discount on total)' : 'NO'}
    - Additional Context: ${orderData.additionalContext || 'None'}

    KNOWLEDGE SOURCES:
    - Master Rules: ${masterKnowledge || "Follow standard LG pricing."}
    - PDF Attachments: Use the attached PDFs as the PRIMARY truth for current campaign prices.

    THINK STEP-BY-STEP. CALCULATE THE SAVINGS CLEARLY.
  `;

  parts.push({ text: systemInstruction });
  parts.push({ text: prompt });

  // Attach all available PDF data
  for (const file of memoFiles) {
    parts.push({ 
      inlineData: { 
        data: file.base64.split(',')[1], 
        mimeType: file.mimeType 
      } 
    });
  }

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [{ parts }],
    config: { 
      temperature: 0, // Keep it deterministic for math
      thinkingConfig: { thinkingBudget: 4000 } // Enable thinking for complex math
    }
  });

  return response.text || "Calculation Error.";
};
