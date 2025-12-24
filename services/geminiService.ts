
import { Message, Scenario, ParticipantProfile, EvaluationReport, VoiceName } from "../types";

const cleanJSON = (text: string): string => {
  if (!text) return "{}";
  let clean = text.trim();
  if (clean.startsWith('```json')) clean = clean.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  if (clean.startsWith('```')) clean = clean.replace(/^```\n?/, '').replace(/\n?```$/, '');
  return clean;
};

export function encodeAudioToBase64(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeBase64ToBytes(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  // Ensure we have an even number of bytes for 16-bit PCM (2 bytes per sample)
  const usableByteLength = data.byteLength - (data.byteLength % 2);
  
  // Create a view on the buffer starting at the correct offset
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, usableByteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalize Int16 to Float32 range [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const generateVoicePreview = async (voiceName: VoiceName): Promise<Uint8Array | null> => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'ttsPreview',
        voiceName,
      }),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const message = (json && typeof json.error === 'string') ? json.error : 'Error: Failed to generate voice preview';
      throw new Error(message.startsWith('Error:') ? message : `Error: ${message}`);
    }

    const base64Audio = json?.audioBase64;
    if (typeof base64Audio === 'string' && base64Audio.length > 0) return decodeBase64ToBytes(base64Audio);
    return null;
  } catch (error) {
    console.error("TTS Preview Error:", error);
    return null;
  }
};

export const generateGenericReport = async (
  history: Message[],
  scenario: Scenario,
  participant: ParticipantProfile,
  activeCase?: string
): Promise<EvaluationReport> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'genericReport',
      history,
      scenario,
      participant,
      activeCase,
    }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (json && typeof json.error === 'string') ? json.error : 'Error: Failed to generate report';
    throw new Error(message.startsWith('Error:') ? message : `Error: ${message}`);
  }

  if (!json || typeof json.report !== 'object' || json.report === null) {
    throw new Error('Error: Invalid report response from server');
  }

  return json.report as EvaluationReport;
};
