
import React, { useState, useRef } from 'react';
import { Scenario, ParticipantProfile } from '../types';
import { ChevronRight, Check, Mic, Volume2, Briefcase, Globe, UserCheck, AudioLines, ArrowLeft, Loader2 } from 'lucide-react';

interface Props {
  scenarios: Scenario[];
  onComplete: (profile: ParticipantProfile, scenarioId: string) => void;
}

const LANGUAGES = [
  { code: 'nl-NL', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr-FR', label: 'Français', flag: '🇫🇷' },
  { code: 'es-ES', label: 'Español', flag: '🇪🇸' },
  { code: 'it-IT', label: 'Italiano', flag: '🇮🇹' },
];

const KEYWORDS = ["Commercieel", "Technisch", "Ecosysteem", "Strategisch", "Partner-focus", "Product Drive"];

export const Onboarding: React.FC<Props> = ({ scenarios, onComplete }) => {
  const [step, setStep] = useState<number>(0); 
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(scenarios[0].id);
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0].code);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [cvText, setCvText] = useState("");

  const [audioTestState, setAudioTestState] = useState<'idle' | 'recording' | 'success'>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0];

  const steps = [
    { id: 'process', enabled: true, title: 'Kies jouw Proces', icon: <Briefcase size={20}/> },
    { id: 'language', enabled: selectedScenario.config.requireLanguage, title: 'Kies jouw Taal', icon: <Globe size={20}/> },
    { id: 'audio', enabled: true, title: 'Audio Controle', icon: <AudioLines size={20}/> },
    { id: 'profile', enabled: selectedScenario.config.requireProfile, title: 'Kandidaat Profiel', icon: <UserCheck size={20}/> },
    { id: 'ready', enabled: true, title: 'Start Gesprek', icon: <Check size={20}/> }
  ];

  const enabledSteps = steps.filter(s => s.enabled);
  const currentStepInfo = enabledSteps[step];

  const handleNext = () => {
    if (step < enabledSteps.length - 1) {
      setStep(prev => prev + 1);
    } else {
      onComplete({
        name: "Kandidaat", 
        language: selectedLanguage,
        selectedKeywords,
        bio,
        cvText,
        answers: []
      }, selectedScenarioId);
    }
  };

  const handleBack = () => {
    setStep(prev => Math.max(0, prev - 1));
  };

  const startAudioTest = async () => {
    try {
      setAudioUrl(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setAudioTestState('success');
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setAudioTestState('recording');
      setTimeout(() => { if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop(); }, 2500);
    } catch (e) {
      alert("Microfoon toegang is vereist.");
    }
  };

  return (
    <div className="h-full flex flex-col items-stretch overflow-hidden">
      {/* Top Banner (Exact Gold) */}
      <div className="bg-exact-gold h-64 flex flex-col justify-end p-12 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-1/3 h-full bg-white/10 rounded-l-full translate-x-1/2 blur-3xl" />
        <div className="z-10 animate-fade-in-up">
           <h1 className="text-exact-dark text-6xl font-black tracking-tighter mb-4">{currentStepInfo.title}</h1>
           <div className="flex gap-2">
             {steps.map((s, i) => (
               <div key={s.id} className={`h-1.5 w-12 rounded-full transition-all ${i <= step ? 'bg-exact-dark' : 'bg-exact-dark/20'}`} />
             ))}
           </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-exact-gray p-12 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          {currentStepInfo.id === 'process' && (
            <div className="animate-fade-in-up space-y-8">
              <p className="text-gray-500 font-medium text-lg">Selecteer het proces waarin je deelneemt. Dit bepaalt de context van het AI-gestuurde gesprek.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {scenarios.map(s => (
                   <button 
                     key={s.id} 
                     onClick={() => setSelectedScenarioId(s.id)} 
                     className={`p-8 text-left transition-all border-2 relative flex flex-col gap-4 ${selectedScenarioId === s.id ? 'border-exact-blue bg-white shadow-lg' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                   >
                     {selectedScenarioId === s.id && <div className="absolute top-0 right-0 bg-exact-blue text-white p-2"><Check size={16}/></div>}
                     <div className="flex gap-2 mb-2">
                        <span className="exact-tag uppercase">Senior Professional</span>
                        <span className="exact-tag uppercase">{s.sessionType === 'call' ? 'Inkomend' : 'Chat'}</span>
                     </div>
                     <h3 className="text-2xl font-black leading-tight text-exact-dark">{s.name}</h3>
                     <p className="text-gray-500 text-sm leading-relaxed">{s.persona.role} • {s.persona.name}</p>
                   </button>
                 ))}
              </div>
            </div>
          )}

          {currentStepInfo.id === 'language' && (
            <div className="animate-fade-in-up grid grid-cols-2 md:grid-cols-4 gap-4">
               {LANGUAGES.map(lang => (
                 <button key={lang.code} onClick={() => setSelectedLanguage(lang.code)} className={`p-6 border-2 transition-all flex flex-col items-center gap-3 bg-white ${selectedLanguage === lang.code ? 'border-exact-blue' : 'border-gray-100 hover:border-gray-200'}`}>
                   <span className="text-4xl">{lang.flag}</span>
                   <span className={`font-black text-sm text-center ${selectedLanguage === lang.code ? 'text-exact-blue' : 'text-gray-400'}`}>{lang.label}</span>
                 </button>
               ))}
            </div>
          )}

          {currentStepInfo.id === 'audio' && (
            <div className="animate-fade-in-up flex flex-col items-center py-12 text-center space-y-8">
               <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center border border-gray-100 shadow-sm">
                  <Mic size={40} className="text-exact-blue"/>
               </div>
               <div className="max-w-md">
                 <h3 className="text-2xl font-black mb-2">Test je audio</h3>
                 <p className="text-gray-500">Om een natuurlijk gesprek te kunnen voeren hebben we toegang tot je microfoon nodig.</p>
               </div>
               
               {audioTestState === 'success' ? (
                 <div className="flex flex-col items-center gap-4">
                    <button onClick={() => new Audio(audioUrl!).play()} className="bg-exact-dark text-white px-8 py-4 font-black flex items-center gap-3 hover:bg-black transition-colors">
                      <Volume2 size={20}/> TEST AFSPELEN
                    </button>
                    <span className="text-emerald-600 font-bold text-sm flex items-center gap-2">
                      <Check size={16}/> Alles OK
                    </span>
                 </div>
               ) : (
                 <button onClick={startAudioTest} className={`bg-exact-blue text-white px-10 py-5 font-black flex items-center gap-4 transition-all shadow-xl shadow-exact-blue/20 ${audioTestState === 'recording' ? 'scale-110' : 'hover:scale-105 active:scale-95'}`}>
                   {audioTestState === 'recording' ? <Loader2 className="animate-spin"/> : <Mic/>}
                   {audioTestState === 'recording' ? 'AAN HET OPNEMEN...' : 'MICROFOON TESTEN'}
                 </button>
               )}
            </div>
          )}

          {currentStepInfo.id === 'profile' && (
            <div className="animate-fade-in-up space-y-10">
              <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Jouw Kernkwaliteiten</label>
                <div className="flex flex-wrap gap-2">
                  {KEYWORDS.map(kw => (
                    <button key={kw} onClick={() => setSelectedKeywords(prev => prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw])} className={`px-6 py-3 border-2 font-black text-sm transition-all bg-white ${selectedKeywords.includes(kw) ? "border-exact-blue text-exact-blue shadow-sm" : "border-gray-100 text-gray-400 hover:border-gray-300"}`}>{kw}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Context / CV Text</label>
                <textarea value={cvText} onChange={e => setCvText(e.target.value)} className="w-full h-40 border-2 border-gray-100 bg-white p-6 outline-none focus:border-exact-blue transition-all resize-none text-sm" placeholder="Plak hier je CV of een korte introductie over je ervaring..." />
              </div>
            </div>
          )}

          {currentStepInfo.id === 'ready' && (
            <div className="animate-fade-in-up flex flex-col items-center py-10 text-center">
              <div className="w-20 h-2 bg-exact-blue mb-8" />
              <h2 className="text-5xl font-black mb-6 tracking-tighter">Klaar om te ontmoeten?</h2>
              <p className="text-gray-500 max-w-lg mx-auto mb-12 text-lg leading-relaxed">
                Je gaat het gesprek aan met <strong>{selectedScenario.persona.name}</strong> over de rol van {selectedScenario.name}.
                {selectedScenario.sessionType === 'call' ? ' Je wordt direct gebeld na het opstarten.' : ' De AI opent de chat-sessie.'}
              </p>
              
              <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-12">
                 <div className="bg-white p-4 border border-gray-100 text-left shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">PROCES</span>
                    <span className="font-bold text-sm truncate block">{selectedScenario.name}</span>
                 </div>
                 <div className="bg-white p-4 border border-gray-100 text-left shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">INTERLOCUTEUR</span>
                    <span className="font-bold text-sm truncate block">{selectedScenario.persona.name}</span>
                 </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mt-12 pt-12 border-t border-gray-200">
            {step > 0 ? (
              <button onClick={handleBack} className="text-gray-400 font-bold hover:text-exact-dark transition-colors flex items-center gap-2">
                <ArrowLeft size={18}/> Vorige
              </button>
            ) : <div/>}
            <button onClick={handleNext} className="bg-exact-blue text-white px-12 py-5 font-black hover:bg-exact-blue/90 transition-all flex items-center gap-4 shadow-xl shadow-exact-blue/20">
              {step === enabledSteps.length - 1 ? "START NU" : "VOLGENDE"} <ChevronRight size={22}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
