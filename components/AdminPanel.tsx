
import React, { useState, useRef, useEffect } from 'react';
import { Scenario, WorkflowStep, InfoField, PersonaMood, StepType, PersonaComprehension, VoiceName } from '../types';
import { generateVoicePreview, decodeAudioBuffer } from '../services/geminiService';
import { supabase } from '../services/supabase';
import { PersonaLibrary, SupabasePersona } from './PersonaLibrary';
import { 
  Save, Workflow, ArrowUp, ArrowDown, Trash2, Plus, 
  User, Layout, BookOpen, Layers, PlusCircle, Smile, HelpCircle, Phone, MessageSquare, ChevronRight, Brain, Info, Volume2, Target, Settings2, Database, Play, Loader2, Library, X
} from 'lucide-react';

interface Props {
  scenarios: Scenario[];
  activeScenarioId: string;
  onSave: (scenarios: Scenario[]) => void;
}

type TabType = 'persona' | 'settings' | 'context' | 'flow';

const MOODS: PersonaMood[] = ['vrolijk', 'boos', 'humoristisch', 'serieus', 'inhoudelijk', 'wollig', 'sarcastisch', 'empathisch', 'autoritair'];
const COMPREHENSIONS: { value: PersonaComprehension, label: string, desc: string }[] = [
  { value: 'meegaand', label: 'Meegaand', desc: 'Snel akkoord' },
  { value: 'begrijpend', label: 'Begrijpend', desc: 'Standaard' },
  { value: 'vragend', label: 'Vragend', desc: 'Vraagt waarom' },
  { value: 'kritisch', label: 'Kritisch', desc: 'Zoekt flaws' },
  { value: 'onverzettelijk', label: 'Stug', desc: 'Bijna nooit akkoord' }
];

const VOICES: { value: VoiceName, label: string, desc: string }[] = [
  { value: 'Puck', label: 'Puck', desc: 'Diep & Serieus' },
  { value: 'Charon', label: 'Charon', desc: 'Kalm & Stabiel' },
  { value: 'Kore', label: 'Kore', desc: 'Helder & Vrolijk' },
  { value: 'Fenrir', label: 'Fenrir', desc: 'Krachtig & Direct' },
  { value: 'Zephyr', label: 'Zephyr', desc: 'Zacht & Empathisch' }
];

const EVALUATION_PRESETS = [
  "Functie-geschiktheid en recruitment criteria",
  "Klantvriendelijkheid en de-escalatie vermogen",
  "Commercieel talent en overtuigingskracht",
  "Technische diepgang en probleemoplossend vermogen",
  "Empathisch vermogen en sociaal inzicht",
  "Leiderschapskwaliteiten en strategisch inzicht"
];

const STEP_TYPES: {type: StepType, label: string}[] = [
  { type: 'intro', label: 'Introductie' },
  { type: 'motivation', label: 'Motivatie' },
  { type: 'problem_statement', label: 'Probleem' },
  { type: 'practical_case', label: 'Case' },
  { type: 'deep_dive', label: 'Deep Dive' },
  { type: 'summary', label: 'Summary' },
  { type: 'closing', label: 'Afsluiting' },
  { type: 'custom', label: 'Custom' }
];

const Tooltip = ({ text }: { text: string }) => (
  <div className="group relative inline-block ml-1 align-middle">
    <Info size={12} className="text-slate-400 hover:text-exact-blue cursor-help" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-[10px] text-white rounded shadow-2xl z-50 pointer-events-none">
      {text}
    </div>
  </div>
);

export const AdminPanel: React.FC<Props> = ({ scenarios, activeScenarioId, onSave }) => {
  const [localScenarios, setLocalScenarios] = useState<Scenario[]>(scenarios);
  const [selectedId, setSelectedId] = useState(activeScenarioId);
  const [activeTab, setActiveTab] = useState<TabType>('persona');
  const [previewingVoice, setPreviewingVoice] = useState<VoiceName | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const scenario = localScenarios.find(s => s.id === selectedId) || localScenarios[0];

  const selectPersonaFromLibrary = (persona: SupabasePersona) => {
    const { data } = persona;
    
    // Construct rich description for AI
    let richDescription = data.introDescription || '';
    
    if (data.detailedDescription) {
        richDescription += `\n\n[ACHTERGROND]\n${data.detailedDescription}`;
    }
    
    if (data.goals && data.goals.length > 0) {
        richDescription += `\n\n[DOELEN]`;
        data.goals.forEach((g: any) => {
            const txt = typeof g === 'string' ? g : `${g.title}: ${g.description || ''}`;
            richDescription += `\n- ${txt}`;
        });
    }

    if (data.painPoints && data.painPoints.length > 0) {
        richDescription += `\n\n[PIJNPUNTEN]`;
        data.painPoints.forEach((p: any) => {
            const txt = typeof p === 'string' ? p : `${p.title}: ${p.description || ''}`;
            richDescription += `\n- ${txt}`;
        });
    }

    if (data.traits && data.traits.length > 0) {
         richDescription += `\n\n[KARAKTER TREKKEN]`;
         data.traits.forEach((t: any) => {
             richDescription += `\n- ${t.label}: ${t.value}% (schaal ${t.leftLabel || 'Laag'} - ${t.rightLabel || 'Hoog'})`;
         });
    }

    updateScenario({
      persona: {
        name: persona.name,
        role: data.jobTitle || 'Onbekend',
        mood: 'inhoudelijk',
        comprehensionLevel: 'begrijpend',
        description: richDescription,
        voiceName: 'Charon'
      }
    });
    setShowLibrary(false);
  };

  const updateScenario = (updates: Partial<Scenario>) => {
    const updated = localScenarios.map(s => s.id === selectedId ? { ...s, ...updates } : s);
    setLocalScenarios(updated);
  };

  const playVoicePreview = async (voice: VoiceName, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingVoice) return;
    try {
      setPreviewingVoice(voice);
      const audioData = await generateVoicePreview(voice);
      if (audioData) {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
        const buffer = await decodeAudioBuffer(audioData, audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setPreviewingVoice(null);
        source.start(0);
      } else { setPreviewingVoice(null); }
    } catch (err) { setPreviewingVoice(null); }
  };

  const addScenario = () => {
    const newId = `scenario-${Date.now()}`;
    const newScenario: Scenario = { ...scenarios[0], id: newId, name: "Nieuw Scenario" };
    setLocalScenarios([...localScenarios, newScenario]);
    setSelectedId(newId);
  };

  const deleteScenario = (id: string) => {
    if (localScenarios.length <= 1) return;
    const filtered = localScenarios.filter(s => s.id !== id);
    setLocalScenarios(filtered);
    setSelectedId(filtered[0].id);
  };

  const addWorkflowStep = () => {
    const newStep: WorkflowStep = { id: `w-${Date.now()}`, type: 'custom', label: 'Nieuwe Stap', aiInstruction: '' };
    updateScenario({ workflow: [...scenario.workflow, newStep] });
  };

  const updateWorkflowStep = (id: string, updates: Partial<WorkflowStep>) => {
    const updatedWorkflow = scenario.workflow.map(step => step.id === id ? { ...step, ...updates } : step);
    updateScenario({ workflow: updatedWorkflow });
  };

  const removeWorkflowStep = (id: string) => {
    updateScenario({ workflow: scenario.workflow.filter(s => s.id !== id) });
  };

  const moveWorkflowStep = (index: number, direction: 'up' | 'down') => {
    const newWorkflow = [...scenario.workflow];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newWorkflow.length) return;
    [newWorkflow[index], newWorkflow[targetIndex]] = [newWorkflow[targetIndex], newWorkflow[index]];
    updateScenario({ workflow: newWorkflow });
  };

  const addInfoField = () => {
    const newField: InfoField = { id: `f-${Date.now()}`, label: 'Nieuw Veld', content: '' };
    updateScenario({ infoFields: [...scenario.infoFields, newField] });
  };

  const updateInfoField = (id: string, updates: Partial<InfoField>) => {
    const updatedFields = scenario.infoFields.map(f => f.id === id ? { ...f, ...updates } : f);
    updateScenario({ infoFields: updatedFields });
  };

  const removeInfoField = (id: string) => {
    updateScenario({ infoFields: scenario.infoFields.filter(f => f.id !== id) });
  };

  return (
    <div className="h-full flex overflow-hidden bg-exact-gray">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-8 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Scenario Lijst</h2>
          <button onClick={addScenario} className="p-1.5 hover:bg-exact-blue/10 rounded-lg text-exact-blue transition-all">
            <PlusCircle size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {localScenarios.map(s => (
            <div key={s.id} className="group relative">
              <button 
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left px-5 py-4 rounded-xl text-sm font-bold transition-all flex items-center gap-3 border ${selectedId === s.id ? 'bg-exact-blue border-exact-blue text-white shadow-lg' : 'text-gray-500 bg-white border-transparent hover:border-gray-200 hover:text-exact-dark'}`}
              >
                <span className="truncate">{s.name}</span>
              </button>
              {localScenarios.length > 1 && (
                <button onClick={() => deleteScenario(s.id)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-exact-red transition-all">
                  <Trash2 size={16}/>
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="p-8 border-t border-gray-100">
          <button 
            onClick={() => onSave(localScenarios)}
            className="w-full bg-exact-blue hover:bg-opacity-90 text-white py-4 font-black text-xs shadow-xl flex items-center justify-center gap-3 transition-all uppercase tracking-widest active:scale-[0.98]"
          >
            <Save size={18}/> OPSLAAN
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <div className="px-12 pt-12 pb-0 border-b border-gray-100">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col gap-2 mb-10">
              <label className="text-[10px] font-black text-exact-blue uppercase tracking-[0.2em]">Scenario Naam</label>
              <input 
                value={scenario.name}
                onChange={e => updateScenario({ name: e.target.value })}
                className="bg-transparent text-5xl font-black text-exact-dark outline-none focus:ring-0 w-full placeholder-gray-200 tracking-tighter"
                placeholder="Geef dit scenario een naam..."
              />
            </div>
            
            <div className="flex items-center gap-10">
              {(['persona', 'settings', 'context', 'flow'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-exact-blue' : 'text-gray-400 hover:text-exact-dark'}`}
                >
                  <div className="flex items-center gap-2">
                    {tab === 'persona' && <User size={16}/>}
                    {tab === 'settings' && <Settings2 size={16}/>}
                    {tab === 'context' && <Database size={16}/>}
                    {tab === 'flow' && <Workflow size={16}/>}
                    {tab}
                  </div>
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-exact-blue rounded-full animate-fade-in" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-12 max-w-4xl mx-auto pb-32">
            
            {activeTab === 'persona' && (
              <div className="space-y-12 animate-fade-in-up">
                <section className="bg-exact-gray border border-gray-200 p-10 space-y-10">
                  <div className="flex justify-end">
                    <button 
                      onClick={() => setShowLibrary(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-xs font-black uppercase tracking-widest text-exact-blue hover:bg-exact-blue hover:text-white transition-all shadow-sm"
                    >
                      <Library size={16} />
                      Persona bibliotheek
                    </button>
                    {showLibrary && (
                        <PersonaLibrary 
                            isOpen={showLibrary} 
                            onClose={() => setShowLibrary(false)} 
                            onSelect={selectPersonaFromLibrary} 
                        />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Naam</label>
                      <input value={scenario.persona.name} onChange={e => updateScenario({ persona: { ...scenario.persona, name: e.target.value } })} className="w-full bg-white border border-gray-200 px-6 py-4 text-sm font-bold focus:border-exact-blue outline-none" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rol</label>
                      <input value={scenario.persona.role} onChange={e => updateScenario({ persona: { ...scenario.persona, role: e.target.value } })} className="w-full bg-white border border-gray-200 px-6 py-4 text-sm font-bold focus:border-exact-blue outline-none" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AI Stem</label>
                    <div className="grid grid-cols-5 gap-3">
                      {VOICES.map(v => (
                        <div 
                            key={v.value} 
                            onClick={() => updateScenario({ persona: { ...scenario.persona, voiceName: v.value } })} 
                            className={`cursor-pointer flex flex-col items-center gap-2 p-4 border transition-all relative ${scenario.persona.voiceName === v.value ? 'bg-exact-blue border-exact-blue text-white shadow-lg' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                        >
                           <span className="text-[10px] font-black uppercase tracking-tighter">{v.label}</span>
                           <button onClick={(e) => playVoicePreview(v.value, e)} className={`absolute -top-2 -right-2 w-8 h-8 rounded-full border flex items-center justify-center transition-all ${scenario.persona.voiceName === v.value ? 'bg-white text-exact-blue' : 'bg-gray-100 text-gray-400'}`}>
                              {previewingVoice === v.value ? <Loader2 size={14} className="animate-spin"/> : <Play size={12} fill="currentColor"/>}
                           </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mood</label>
                    <div className="flex flex-wrap gap-2">
                      {MOODS.map(mood => (
                        <button key={mood} onClick={() => updateScenario({ persona: { ...scenario.persona, mood } })} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all border ${scenario.persona.mood === mood ? 'bg-exact-blue border-exact-blue text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                          {mood}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Omschrijving</label>
                    <textarea value={scenario.persona.description} onChange={e => updateScenario({ persona: { ...scenario.persona, description: e.target.value } })} className="w-full bg-white border border-gray-200 px-6 py-4 text-sm font-medium focus:border-exact-blue outline-none h-40 resize-none leading-relaxed" />
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-12 animate-fade-in-up">
                <section className="bg-exact-gray border border-gray-200 p-10 space-y-12">
                  <div className="grid grid-cols-2 gap-10">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Modus</label>
                        <div className="flex gap-3">
                          <button onClick={() => updateScenario({ sessionType: 'standard' })} className={`flex-1 py-6 border flex flex-col items-center gap-3 transition-all ${scenario.sessionType === 'standard' ? 'bg-exact-blue border-exact-blue text-white shadow-lg' : 'bg-white border-gray-200 text-gray-400'}`}>
                            <MessageSquare size={20}/>
                            <span className="text-[10px] font-black uppercase tracking-widest">Chat</span>
                          </button>
                          <button onClick={() => updateScenario({ sessionType: 'call' })} className={`flex-1 py-6 border flex flex-col items-center gap-3 transition-all ${scenario.sessionType === 'call' ? 'bg-exact-blue border-exact-blue text-white shadow-lg' : 'bg-white border-gray-200 text-gray-400'}`}>
                            <Phone size={20}/>
                            <span className="text-[10px] font-black uppercase tracking-widest">Call</span>
                          </button>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Systeem Gedrag</label>
                        <div className="space-y-3 bg-white p-6 border border-gray-200 shadow-sm">
                          <label className="flex items-center gap-4 cursor-pointer group">
                            <input type="checkbox" checked={scenario.config.requireCv} onChange={e => updateScenario({ config: { ...scenario.config, requireCv: e.target.checked } })} className="w-5 h-5 border-gray-200 text-exact-blue focus:ring-exact-blue" />
                            <span className="text-xs font-bold text-gray-600">Context/CV Verplicht</span>
                          </label>
                          <label className="flex items-center gap-4 cursor-pointer group">
                            <input type="checkbox" checked={scenario.config.autoTerminate} onChange={e => updateScenario({ config: { ...scenario.config, autoTerminate: e.target.checked } })} className="w-5 h-5 border-gray-200 text-exact-blue focus:ring-exact-blue" />
                            <span className="text-xs font-bold text-gray-600">Auto-beëindigen</span>
                          </label>
                        </div>
                     </div>
                  </div>
                  <div className="pt-10 border-t border-gray-200 space-y-6">
                     <h3 className="text-[10px] font-black text-exact-blue uppercase tracking-widest">Evaluatie Focus</h3>
                     <textarea value={scenario.config.evaluationFocus} onChange={e => updateScenario({ config: { ...scenario.config, evaluationFocus: e.target.value } })} className="w-full bg-white border border-gray-200 px-6 py-4 text-xs font-medium focus:border-exact-blue outline-none h-32 resize-none leading-relaxed" />
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'context' && (
              <div className="space-y-12 animate-fade-in-up">
                <section className="space-y-6">
                   <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Statische Velden</h3>
                      <button onClick={addInfoField} className="px-4 py-2 border-2 border-exact-blue text-exact-blue text-[10px] font-black uppercase tracking-widest hover:bg-exact-blue hover:text-white transition-all">Veld Toevoegen</button>
                   </div>
                   <div className="grid grid-cols-1 gap-6">
                      {scenario.infoFields.map(field => (
                        <div key={field.id} className="bg-exact-gray border border-gray-200 p-8 space-y-4">
                           <div className="flex justify-between items-center">
                              <input value={field.label} onChange={e => updateInfoField(field.id, { label: e.target.value })} className="bg-transparent text-[10px] font-black text-gray-400 uppercase outline-none focus:text-exact-blue" />
                              <button onClick={() => removeInfoField(field.id)} className="p-2 text-gray-300 hover:text-exact-red transition-colors"><Trash2 size={16}/></button>
                           </div>
                           <textarea value={field.content} onChange={e => updateInfoField(field.id, { content: e.target.value })} className="w-full bg-white border border-gray-200 p-4 text-sm font-medium focus:border-exact-blue resize-none h-24" />
                        </div>
                      ))}
                   </div>
                </section>
              </div>
            )}

            {activeTab === 'flow' && (
              <div className="space-y-12 animate-fade-in-up">
                <section className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gespreks Flow</h3>
                    <button onClick={addWorkflowStep} className="px-4 py-2 border-2 border-exact-blue text-exact-blue text-[10px] font-black uppercase tracking-widest hover:bg-exact-blue hover:text-white transition-all">Stap Toevoegen</button>
                  </div>
                  <div className="space-y-6">
                    {scenario.workflow.map((step, index) => (
                      <div key={step.id} className="bg-exact-gray border border-gray-200 p-10 space-y-8 relative">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-6 flex-1">
                              <span className="w-10 h-10 bg-exact-dark text-white text-xs font-black flex items-center justify-center">{index + 1}</span>
                              <input value={step.label} onChange={e => updateWorkflowStep(step.id, { label: e.target.value })} className="bg-transparent text-xl font-black text-exact-dark outline-none w-full" />
                           </div>
                           <div className="flex items-center gap-3">
                              <button onClick={() => moveWorkflowStep(index, 'up')} className="p-2 text-gray-300 hover:text-exact-blue"><ArrowUp size={18}/></button>
                              <button onClick={() => moveWorkflowStep(index, 'down')} className="p-2 text-gray-300 hover:text-exact-blue"><ArrowDown size={18}/></button>
                              <button onClick={() => removeWorkflowStep(step.id)} className="p-2 text-gray-300 hover:text-exact-red"><Trash2 size={18}/></button>
                           </div>
                        </div>
                        <textarea value={step.aiInstruction} onChange={e => updateWorkflowStep(step.id, { aiInstruction: e.target.value })} className="w-full bg-white border border-gray-200 p-6 text-xs font-medium text-gray-600 focus:border-exact-blue h-24 resize-none leading-relaxed" placeholder="AI Instructie..." />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
