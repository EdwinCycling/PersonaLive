
import React, { useState, useRef, useEffect } from 'react';
import { Scenario, ParticipantProfile, InterviewState, Message } from '../types';
import { encodeAudioToBase64, decodeBase64ToBytes, decodeAudioBuffer } from '../services/geminiService';
import { Visualizer } from './Visualizer';
import { Power, MessageSquare, AlertTriangle, Phone, PhoneOff, User, ChevronRight, Mic, Gauge, Volume2, VolumeX } from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { AI_MODELS } from '../config/aiModels';

interface Props {
  scenario: Scenario;
  participant: ParticipantProfile;
  onFinish: (state: InterviewState) => void;
}

export const InterviewRoom: React.FC<Props> = ({ scenario, participant, onFinish }) => {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [sessionStage, setSessionStage] = useState<'ready' | 'ringing' | 'active' | 'ended'>('ready');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedCase, setSelectedCase] = useState<string | undefined>(undefined);
  const [showIntroPrompt, setShowIntroPrompt] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0); // 0.5 to 1.5
  const [audioEnabled, setAudioEnabled] = useState(false); // Default to off as requested
  const [isConnecting, setIsConnecting] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  const [currentTranscription, setCurrentTranscription] = useState({ user: '', model: '' });

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const liveSessionRef = useRef<any>(null);
  const isConnectedRef = useRef(false);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const timerRef = useRef<any>(null);
  const transcriptionRef = useRef({ user: '', model: '' });
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingUserTextsRef = useRef<string[]>([]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentTranscription]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Handle Audio Enable/Disable
  useEffect(() => {
    if (outputAudioContextRef.current) {
      if (audioEnabled) {
        outputAudioContextRef.current.resume();
      } else {
        outputAudioContextRef.current.suspend();
      }
    }
  }, [audioEnabled]);

  useEffect(() => {
    if (scenario.caseLibrary && scenario.caseLibrary.length > 0) {
      const idx = scenario.randomizeCase ? Math.floor(Math.random() * scenario.caseLibrary.length) : 0;
      setSelectedCase(scenario.caseLibrary[idx]);
    }
    return () => stopSession();
  }, []);

  // Update speed instruction when slider changes
  useEffect(() => {
    if (liveSessionRef.current && isConnected) {
      const speedLabel = speechSpeed < 0.8 ? "aanzienlijk langzamer" : speechSpeed > 1.2 ? "aanzienlijk sneller" : "op een normaal tempo";
      try {
        const p = liveSessionRef.current.sendRealtimeInput({
          text: `[SYSTEEM INSTRUCTIE]: Pas je spreektempo direct aan. Spreek vanaf nu ${speedLabel}. Blijf spreken in de taal: ${participant.language}.`,
        });
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {
      }
    }
  }, [speechSpeed, participant.language]);

  const formatTime = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const safeSend = (data: any) => {
    const session = liveSessionRef.current;
    if (!session) return;
    try {
      const p = session.sendRealtimeInput(data);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
    }
  };

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    if (!isConnected || !liveSessionRef.current) {
      alert('Error: Not connected');
      return;
    }

    pendingUserTextsRef.current.push(text);
    setMessages(prev => [...prev, { role: 'user', text, timestamp: new Date() } as Message]);
    setChatInput('');
    setShowIntroPrompt(false);
    safeSend({ text });
  };

  const startSession = async () => {
    if (scenario.sessionType === 'call') {
      setSessionStage('ringing');
      // Create audio context to resume it (browser policy fix)
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      
      const audio = new Audio("https://actions.google.com/sounds/v1/alarms/phone_ringing_low.ogg");
      audio.loop = true;
      ringtoneRef.current = audio;

      ctx.resume().then(() => {
        // Try to play, handle potential autoplay errors
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn("Autoplay prevented:", error);
            // Fallback UI indication needed if sound fails
          });
        }
      });
    } else {
      await connectToAI();
    }
  };

  const answerCall = async () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
    await connectToAI();
  };

  const connectToAI = async () => {
    try {
      setIsConnecting(true);
      setSessionStage('active');

      // Use a dummy key and point to our secure proxy
      // The proxy (Netlify Edge Function or Vite Dev Server) will inject the real API key
      const ai = new GoogleGenAI({ 
        apiKey: 'dummy_key',
        // Use the specific proxy endpoint
        // Note: SDK usually appends version/service paths, so we point to our proxy root
        // If the SDK uses wss://, we need to ensure the proxy handles it.
        // We use window.location.origin to point to the current server (Netlify or Local)
        httpOptions: { baseUrl: `${window.location.origin}/api/gemini-proxy` }
      });
      
      inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      // Apply initial audio state
      if (!audioEnabled) {
        outputAudioContextRef.current.suspend();
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      } catch {
        mediaStreamRef.current = null;
      }
      
      const infoFieldsText = scenario.infoFields.map(f => `${f.label}: ${f.content}`).join('\n');
      const workflowText = scenario.workflow.map((s, i) => `${i+1}. ${s.label}: ${s.aiInstruction}`).join('\n');

      const systemInstruction = `
        JE BENT PERSONA: "${scenario.persona.name}". 
        ROL: "${scenario.persona.role}" bij Exact.
        KARAKTER/STEMMING: "${scenario.persona.mood}".
        VOLLEDIGE PERSONA OMSCHRIJVING: ${scenario.persona.description}.
        
        BELANGRIJK VOOR TAAL EN STEM-IDENTITEIT:
        TAAL: Voer het gesprek VOLLEDIG in de taal "${participant.language}". Wissel NOOIT naar een andere taal.
        STEM: Je spreekt met de stem "${scenario.persona.voiceName}". 
        Blijf ALTIJD in je rol. Gebruik de toon die past bij deze specifieke stem. 
        HUIDIG TEMPO: ${speechSpeed < 0.8 ? "Langzaam" : speechSpeed > 1.2 ? "Snel" : "Normaal"}.
        
        ACHTERGRONDINFORMATIE EXACT:
        ${infoFieldsText}
        
        GEGEVENS DEELNEMER:
        Naam: ${participant.name}. Bio: ${participant.bio || "Kandidaat bij Exact"}. 
        CV/Context: ${participant.cvText || "Geen extra context"}.
        Focus keywords: ${participant.selectedKeywords.join(', ')}.
        
        STRATEGISCHE GESPREKSFLOW (HOUD JE HIER STRIKT AAN):
        ${workflowText}
        
        START LOGICA:
        ${scenario.sessionType === 'call' ? 
          `MODUS: INKOMEND GESPREK.
           Wacht tot de GEBRUIKER begint te spreken in de taal "${participant.language}".
           Zodra de gebruiker is uitgesproken, reageer je direct als ${scenario.persona.name}.
           IDENTITEITS-CHECK: Als de gebruiker zijn naam of rol niet noemt, vraag hier dan direct naar.
           Stel pas daarna jezelf voor en start het gesprek.` 
          : 
          `MODUS: TRANSCRIPT.
           JIJ (DE AI) begint het gesprek direct in de taal "${participant.language}". Introduceer jezelf als ${scenario.persona.name} en heet de kandidaat welkom bij Exact.`
        }
      `;

      const sessionPromise = ai.live.connect({
        model: AI_MODELS.LIVE_INTERACTION,
        config: {
          responseModalities: [Modality.AUDIO, Modality.TEXT],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: scenario.persona.voiceName || 'Puck' } },
          },
          systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: async () => {
            setIsConnected(true);
            isConnectedRef.current = true;
            setIsConnecting(false);
            setStatus('idle');

            timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);

            if (scenario.sessionType === 'standard') {
              safeSend({ text: 'De sessie is gestart. Open het gesprek.' });
            } else {
              if (stream) {
                setShowIntroPrompt(true);
              }
            }

            if (!inputAudioContextRef.current) return;
            if (!stream) return;

            try {
              // Ensure AudioContext is running
              if (inputAudioContextRef.current.state === 'suspended') {
                await inputAudioContextRef.current.resume();
              }
              
              if (!inputAudioContextRef.current) return;

              // Load AudioWorklet
              try {
                await inputAudioContextRef.current.audioWorklet.addModule('/audio-recorder-worklet.js');
              } catch (e) {
                console.error("AudioWorklet loading failed, falling back or handling error:", e);
                // In production with strict CSP or path issues, this might fail. 
                // Ensure audio-recorder-worklet.js is in public/
              }
              
              if (!inputAudioContextRef.current) return;

              const source = inputAudioContextRef.current.createMediaStreamSource(stream);
              const processor = new AudioWorkletNode(inputAudioContextRef.current, 'audio-recorder-worklet');
              
              sourceRef.current = source;
              processorRef.current = processor;

              processor.port.onmessage = (e) => {
                if (!isConnectedRef.current) return;
                if (!liveSessionRef.current) return;
                
                // e.data is ArrayBuffer from worklet
                const pcmBase64 = encodeAudioToBase64(new Uint8Array(e.data));
                safeSend({
                  media: { data: pcmBase64, mimeType: 'audio/pcm;rate=16000' },
                });
              };

              source.connect(processor);
              // Note: AudioWorkletNode doesn't need to connect to destination if it's just processing 
              // and sending data back via port, but connecting keeps the graph alive in some browsers.
              // However, connecting it to destination might cause audio feedback if the worklet passes input to output.
              // Our worklet doesn't write to outputs, so it's safe to connect or not, but generally good to connect to keep clock sync.
              processor.connect(inputAudioContextRef.current.destination);
            } catch (error) {
              console.error("Error initializing audio worklet:", error);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            const parts = message.serverContent?.modelTurn?.parts as any[] | undefined;
            const audioData = parts?.find(p => p?.inlineData?.data)?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
              setShowIntroPrompt(false);
              setStatus('speaking');
              const bytes = decodeBase64ToBytes(audioData);
              const buffer = await decodeAudioBuffer(bytes, outputAudioContextRef.current);
              const source = outputAudioContextRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(outputAudioContextRef.current.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              activeSourcesRef.current.add(source);
              source.onended = () => { 
                activeSourcesRef.current.delete(source); 
                if (activeSourcesRef.current.size === 0) setStatus('idle'); 
              };
            }

            if (message.serverContent?.inputTranscription) {
              setStatus('listening');
              setShowIntroPrompt(false);
              transcriptionRef.current.user += message.serverContent.inputTranscription.text;
              setCurrentTranscription(prev => ({ ...prev, user: transcriptionRef.current.user }));
            }
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              transcriptionRef.current.model += text;
              setCurrentTranscription(prev => ({ ...prev, model: transcriptionRef.current.model }));
            } else {
              const textParts = parts?.map(p => (typeof p?.text === 'string' ? p.text : '')).filter(Boolean) || [];
              if (textParts.length > 0) {
                const text = textParts.join('');
                transcriptionRef.current.model += text;
                setCurrentTranscription(prev => ({ ...prev, model: transcriptionRef.current.model }));
              }
            }
            if (message.serverContent?.turnComplete) {
              const transcribedUserText = transcriptionRef.current.user;
              if (!transcribedUserText && pendingUserTextsRef.current.length > 0) {
                pendingUserTextsRef.current.shift();
              }
              const mText = transcriptionRef.current.model;
              if (transcribedUserText || mText) {
                setMessages(prev => [
                  ...prev,
                  ...(transcribedUserText ? [{ role: 'user', text: transcribedUserText, timestamp: new Date() } as Message] : []),
                  ...(mText ? [{ role: 'model', text: mText, timestamp: new Date() } as Message] : [])
                ]);
              }
              transcriptionRef.current = { user: '', model: '' };
              setCurrentTranscription({ user: '', model: '' });
            }
            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setStatus('listening');
            }
          },
          onclose: () => {
            stopSession();
          },
          onerror: () => {
            stopSession();
          }
        }
      });
      liveSessionRef.current = await sessionPromise;

      if (scenario.sessionType === 'standard') {
        safeSend({ text: 'De sessie is gestart. Open het gesprek.' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error: Failed to start session';
      alert(message.startsWith('Error:') ? message : `Error: ${message}`);
      setSessionStage('ready');
      setIsConnecting(false);
    }
  };

  const stopSession = () => {
    isConnectedRef.current = false;
    if (ringtoneRef.current) { ringtoneRef.current.pause(); ringtoneRef.current = null; }
    if (sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null; }
    if (processorRef.current) {
      try { processorRef.current.onaudioprocess = null; } catch {}
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
      mediaStreamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      try { inputAudioContextRef.current.close(); } catch {}
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      try { outputAudioContextRef.current.close(); } catch {}
      outputAudioContextRef.current = null;
    }
    const session = liveSessionRef.current;
    liveSessionRef.current = null;
    if (session) {
      try { session.close(); } catch {}
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsConnected(false);
    setIsConnecting(false);
    setStatus('idle');
    setSessionStage('ready');
  };

  const handleFinish = () => {
    stopSession();
    onFinish({ currentPhase: "Voltooid", startTime: Date.now() - (elapsedTime * 1000), messages, selectedCase });
  };

  if (sessionStage === 'ringing') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-exact-gold relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-white/5 rounded-l-full translate-x-1/3 blur-2xl" />
        <div className="z-10 flex flex-col items-center gap-12 text-exact-dark">
           <div className="relative">
             <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center animate-pulse shadow-2xl border-4 border-white/30">
               <User size={80} className="text-exact-dark" />
             </div>
             <div className="absolute inset-0 w-40 h-40 rounded-full border-2 border-white animate-[ping_3s_infinite] opacity-30" />
           </div>
           <div className="text-center space-y-2">
             <h2 className="text-6xl font-black tracking-tighter">{scenario.persona.name}</h2>
             <span className="text-exact-dark/60 font-bold uppercase tracking-widest text-xs">Inkomende Oproep • {scenario.persona.role}</span>
           </div>
           <div className="flex gap-16 mt-4">
              <button onClick={() => { if(ringtoneRef.current) ringtoneRef.current.pause(); setSessionStage('ready'); }} className="group flex flex-col items-center gap-4">
                 <div className="w-20 h-20 bg-exact-red rounded-full flex items-center justify-center text-white transition-all group-hover:scale-110 shadow-xl">
                   <PhoneOff size={32} />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Afwijzen</span>
              </button>
              <button onClick={answerCall} className="group flex flex-col items-center gap-4">
                 <div className="w-24 h-24 bg-exact-blue rounded-full flex items-center justify-center text-white transition-all group-hover:scale-110 shadow-2xl animate-bounce">
                   <Phone size={40} />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest">Opnemen</span>
              </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden relative">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 bg-white z-20 shadow-sm shrink-0">
         <div className="flex items-center gap-4">
            {/* Persona Info */}
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-exact-blue/5 border border-exact-blue/10 rounded-full flex items-center justify-center text-exact-blue">
                 <User size={18}/>
               </div>
               <div className="flex flex-col">
                 <span className="text-xs font-black text-gray-800 uppercase tracking-widest">{scenario.persona.name}</span>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{scenario.persona.role}</span>
               </div>
            </div>
            {/* Divider */}
            <div className="h-8 w-px bg-gray-200 mx-2" />
            {/* Status */}
            <div className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all ${isConnected ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </div>
            
            {/* Audio Toggle */}
            <button 
              onClick={() => setAudioEnabled(!audioEnabled)} 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all ${audioEnabled ? 'bg-exact-blue/10 border-exact-blue/20 text-exact-blue' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
              title={audioEnabled ? "Spraak ingeschakeld" : "Spraak uitgeschakeld (alleen tekst)"}
            >
              {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">{audioEnabled ? 'AAN' : 'UIT'}</span>
            </button>
         </div>

         {/* Center: Visualizer (Compact) */}
         <div className="flex-1 flex justify-center mx-8 h-12 overflow-hidden items-center opacity-50">
            <Visualizer status={status} />
         </div>

         <div className="flex items-center gap-6">
            {/* Speed */}
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100">
               <Gauge size={12} className="text-gray-400"/>
               <input type="range" min="0.5" max="1.5" step="0.1" value={speechSpeed} onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))} className="w-20 accent-exact-blue cursor-pointer h-1" />
            </div>
            {/* Timer */}
            <div className="font-mono font-bold text-gray-400 text-xs w-16 text-center">
              {formatTime(elapsedTime)}
            </div>
            {/* Finish */}
            <button onClick={handleFinish} disabled={messages.length === 0} className="bg-exact-dark hover:bg-black text-white px-6 py-2.5 font-black text-[10px] uppercase tracking-widest transition-all shadow-lg hover:shadow-xl disabled:opacity-30 disabled:shadow-none">
              AFRONDEN
            </button>
         </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-8 custom-scrollbar scroll-smooth bg-gray-50/30 relative">
          {/* Background Decor */}
          <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none" />

          {messages.length === 0 && !currentTranscription.user && !currentTranscription.model && (
             <div className="h-full flex flex-col items-center justify-center text-gray-300">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                   <MessageSquare size={32} strokeWidth={1.5} className="text-gray-400" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Gesprek wordt gestart...</p>
             </div>
           )}

           {messages.map((m, i) => (
             <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
               <div className={`max-w-[70%] p-6 text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-white text-gray-800 rounded-2xl rounded-tr-none border border-gray-100' : 'bg-exact-blue text-white rounded-2xl rounded-tl-none shadow-exact-blue/20'}`}>
                 <span className={`text-[9px] font-black uppercase tracking-widest block mb-2 ${m.role === 'user' ? 'text-gray-400' : 'text-white/60'}`}>{m.role === 'user' ? 'Kandidaat' : scenario.persona.name}</span>
                 <p className="font-medium">{m.text}</p>
                 <div className={`text-[8px] mt-3 text-right font-black uppercase ${m.role === 'user' ? 'text-gray-300' : 'text-white/40'}`}>{new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
               </div>
             </div>
           ))}

           {/* Live Transcriptions */}
           {(currentTranscription.user || currentTranscription.model) && (
             <div className="space-y-4 pt-4">
                {currentTranscription.user && (
                  <div className="flex justify-end">
                    <div className="bg-gray-100/80 backdrop-blur-sm px-6 py-3 rounded-full text-xs italic text-gray-500 animate-pulse shadow-sm border border-white">
                      "{currentTranscription.user}..."
                    </div>
                  </div>
                )}
                {currentTranscription.model && (
                  <div className="flex justify-start">
                    <div className="bg-exact-blue/10 backdrop-blur-sm px-6 py-3 rounded-full text-xs italic text-exact-blue animate-pulse border border-exact-blue/20">
                      "{currentTranscription.model}..."
                    </div>
                  </div>
                )}
             </div>
           )}
           <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Intro Prompt Overlay */}
      {showIntroPrompt && isConnected && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-40 animate-bounce">
           <div className="bg-exact-dark text-white px-6 py-3 rounded-full font-bold text-xs shadow-2xl flex items-center gap-3 border border-gray-700">
              <Mic size={14} className="text-exact-blue"/> 
              <span className="uppercase tracking-wide">Stel jezelf voor om te beginnen</span>
           </div>
        </div>
      )}

      {isConnected && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 w-[min(900px,calc(100%-2rem))]">
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-full shadow-lg px-4 py-3">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendChatMessage();
              }}
              placeholder="Typ je bericht en druk op Enter"
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim()}
              className="bg-exact-blue hover:bg-exact-blue/90 text-white px-5 py-2 rounded-full font-black text-[10px] uppercase tracking-widest disabled:opacity-40"
            >
              Verstuur
            </button>
          </div>
        </div>
      )}

      {/* Floating Controls (Start/Stop) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30">
          {!isConnected ? (
             <button 
               onClick={startSession} 
               disabled={isConnecting}
               className={`bg-exact-blue hover:bg-exact-blue/90 text-white px-10 py-4 rounded-full font-black text-sm shadow-2xl shadow-exact-blue/40 transition-all flex items-center gap-3 tracking-widest ring-4 ring-white ${isConnecting ? 'opacity-80 cursor-wait' : 'hover:scale-105 active:scale-95'}`}
             >
               <Power size={18}/> {isConnecting ? 'VERBINDEN...' : 'START GESPREK'}
             </button>
           ) : (
             <button onClick={stopSession} className="bg-white hover:bg-red-50 text-gray-400 hover:text-exact-red px-6 py-3 rounded-full font-bold text-[10px] shadow-lg border border-gray-200 transition-all flex items-center gap-2 uppercase tracking-widest">
               <AlertTriangle size={14}/> Beëindigen
             </button>
           )}
      </div>
    </div>
  );
};
