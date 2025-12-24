import { GoogleGenAI, Modality, Type } from '@google/genai';

const cleanJSON = (text: string): string => {
  if (!text) return '{}';
  let clean = text.trim();
  if (clean.startsWith('```json')) clean = clean.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  if (clean.startsWith('```')) clean = clean.replace(/^```\n?/, '').replace(/\n?```$/, '');
  return clean;
};

const jsonResponse = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
});

const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : '';
};

type HistoryMessage = { role?: string; text?: string };

export const handler = async (event: any) => {
  try {
    if (!event || event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Error: Method not allowed' });

    const rawBody = typeof event.body === 'string' ? event.body : '';
    if (rawBody.length > 250_000) return jsonResponse(413, { error: 'Error: Request body too large' });

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody || '{}');
    } catch {
      return jsonResponse(400, { error: 'Error: Invalid JSON body' });
    }

    const apiKey = getApiKey();
    if (!apiKey) return jsonResponse(500, { error: 'Error: Missing GEMINI_API_KEY on server' });
    const ai = new GoogleGenAI({ apiKey });

    const action = payload?.action;
    if (action === 'ttsPreview') {
      const voiceName = typeof payload.voiceName === 'string' ? payload.voiceName.trim() : '';
      if (!voiceName || voiceName.length > 64) return jsonResponse(400, { error: 'Error: Invalid voiceName' });

      const prompt = `Hallo, ik ben de stem ${voiceName}. Zo klink ik tijdens een gesprek.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return jsonResponse(200, { audioBase64: typeof audioBase64 === 'string' ? audioBase64 : null });
    }

    if (action === 'genericReport') {
      const history = Array.isArray(payload.history) ? (payload.history as HistoryMessage[]) : [];
      if (history.length > 250) return jsonResponse(400, { error: 'Error: Too many history messages' });

      const scenarioName = typeof payload?.scenario?.name === 'string' ? payload.scenario.name : '';
      const personaName = typeof payload?.scenario?.persona?.name === 'string' ? payload.scenario.persona.name : '';
      const personaRole = typeof payload?.scenario?.persona?.role === 'string' ? payload.scenario.persona.role : '';
      const personaMood = typeof payload?.scenario?.persona?.mood === 'string' ? payload.scenario.persona.mood : '';
      const evaluationFocus = typeof payload?.scenario?.config?.evaluationFocus === 'string' ? payload.scenario.config.evaluationFocus : '';

      const participantName = typeof payload?.participant?.name === 'string' ? payload.participant.name : '';
      const activeCase = typeof payload.activeCase === 'string' ? payload.activeCase : '';

      const transcript = history
        .map((m) => {
          const role = typeof m.role === 'string' ? m.role : 'unknown';
          const text = typeof m.text === 'string' ? m.text : '';
          return `${role}: ${text}`;
        })
        .join('\n')
        .slice(0, 40_000);

      const prompt = `Analyseer deze interactie voor het scenario: "${scenarioName}".
PERSONA: ${personaName} (${personaRole}), STEMMING: ${personaMood}.
CASE CONTEXT: ${activeCase || 'Niet van toepassing'}.
DEELNEMER: ${participantName}.

BELANGRIJK: DE FOCUS VAN DEZE EVALUATIE IS: "${evaluationFocus}".
Baseer je feedback, scores en tips specifiek op dit doel.

TRANSCRIPT:
${transcript}

Genereer een uitgebreide analyse in JSON formaat met scores op inhoud, gedrag en specifieke feedback.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              score: { type: Type.NUMBER },
              sentiment: { type: Type.STRING },
              behavioralAnalysis: {
                type: Type.OBJECT,
                properties: {
                  averageLatency: { type: Type.NUMBER },
                  consistencyScore: { type: Type.NUMBER },
                  notes: { type: Type.STRING },
                },
              },
              contentAnalysis: {
                type: Type.OBJECT,
                properties: {
                  accuracy: { type: Type.NUMBER },
                  depth: { type: Type.STRING },
                  matchWithContext: { type: Type.STRING },
                },
              },
              participantFeedback: {
                type: Type.OBJECT,
                properties: {
                  mainFeedback: { type: Type.STRING },
                  tips: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
              },
            },
          },
        },
      });

      const report = JSON.parse(cleanJSON(response.text || '{}'));
      return jsonResponse(200, { report });
    }

    return jsonResponse(400, { error: 'Error: Unknown action' });
  } catch (e) {
    return jsonResponse(500, { error: 'Error: Gemini function failed' });
  }
};

