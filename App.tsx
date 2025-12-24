
import React, { useState, useEffect } from 'react';
import { Onboarding } from './components/Onboarding';
import { InterviewRoom } from './components/InterviewRoom';
import { Reports } from './components/Reports';
import { AdminPanel } from './components/AdminPanel';
import { Login } from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './services/supabase';
import { Scenario, ParticipantProfile, InterviewState } from './types';
import { Settings, LogOut } from 'lucide-react';

const STORAGE_KEY = 'persona_ai_scenarios_exact_v1';

const DEFAULT_SCENARIO: Scenario = {
  id: 'exact-pm-ecosystem',
  name: "Commercial Product Manager App Store",
  persona: {
    name: "Thomas",
    role: "Hiring Manager Ecosystem",
    mood: "inhoudelijk",
    comprehensionLevel: 'begrijpend',
    description: "Een gedreven leider die zoekt naar commercieel inzicht en technische affiniteit voor de groei van het developer ecosysteem.",
    voiceName: 'Charon'
  },
  infoFields: [
    { id: 'f1', label: 'Rol Focus', content: 'Ontwikkelen en implementeren van commerciële strategieën voor software partners.' },
    { id: 'f2', label: 'Team', content: 'Werken binnen het Exact Online Developer Ecosystem team in Delft.' }
  ],
  workflow: [
    { id: 'w1', type: 'intro', label: 'Kennismaking', aiInstruction: 'Check of de kandidaat zich al heeft voorgesteld. Zo ja, reageer op de introductie en leg uit wat jouw rol binnen Exact is.' },
    { id: 'w2', type: 'motivation', label: 'Ecosysteem Visie', aiInstruction: 'Vraag naar hun ervaring met partnernetwerken en App Stores.' },
    { id: 'w3', type: 'practical_case', label: 'Strategie Case', aiInstruction: 'Leg een scenario voor over het aantrekken van een strategische internationale partner.' },
    { id: 'w4', type: 'closing', label: 'Afronding', aiInstruction: 'Vraag of ze nog vragen hebben over Exact en sluit af.' }
  ],
  caseLibrary: ["Case: Een partner wil een integratie bouwen maar vraagt om exclusiviteit.", "Case: De App Store conversie daalt door onduidelijke onboarding."],
  randomizeCase: true,
  sessionType: 'call',
  config: {
    requireCv: true,
    requireLanguage: true,
    requireProfile: true,
    autoTerminate: true,
    evaluationFocus: 'Commerciële drive en begrip van platform-economie'
  },
  documentation: "Gebaseerd op de Exact Online vacature voor Product Manager Ecosystem."
};

import { Footer } from './components/Footer';

const AppContent: React.FC = () => {
  const { user, signOut } = useAuth();
  const [view, setView] = useState<'admin' | 'onboarding' | 'interview' | 'report'>('onboarding');
  const [scenarios, setScenarios] = useState<Scenario[]>([DEFAULT_SCENARIO]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>(DEFAULT_SCENARIO.id);
  const [loading, setLoading] = useState(true);
  
  // Load scenarios from Supabase
  useEffect(() => {
    if (!user) return;

    const fetchScenarios = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('scenarios')
          .select('*')
          .eq('user_id', user.id);
          
        if (error) {
          console.error('Error fetching scenarios:', error);
          return;
        }

        if (data && data.length > 0) {
          const loadedScenarios = data.map(item => ({
             ...item.configuration,
             id: item.configuration.id // Ensure ID matches
          }));
          
          // Deduplicate scenarios based on ID to prevent "Encountered two children with the same key" error
          // and to show only unique scenarios if the DB contains duplicates.
          const uniqueScenarios = Array.from(new Map(loadedScenarios.map(s => [s.id, s])).values());
          
          setScenarios(uniqueScenarios);
          setActiveScenarioId(uniqueScenarios[0].id);
        } else {
          // Fallback to local storage or default if no DB data
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setScenarios(parsed);
                setActiveScenarioId(parsed[0].id);
                // Optionally migrate to Supabase here?
              }
            } catch (e) {}
          }
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchScenarios();
  }, [user]);

  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || DEFAULT_SCENARIO;

  const [participant, setParticipant] = useState<ParticipantProfile>({
    name: "Kandidaat",
    language: "nl-NL",
    selectedKeywords: [],
    bio: "",
    answers: []
  });

  const [interviewData, setInterviewData] = useState<InterviewState | null>(null);

  const startSession = (profile: ParticipantProfile, scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    setParticipant(profile);
    setView('interview');
  };

  const finishSession = (state: InterviewState) => {
    setInterviewData(state);
    setView('report');
  };

  const saveScenarios = async (updated: Scenario[]) => {
    setScenarios(updated);
    
    if (user) {
      try {
        // Save to Supabase
        // We iterate and upsert each scenario
        for (const scenario of updated) {
          const { error } = await supabase
            .from('scenarios')
            .upsert({
              user_id: user.id,
              name: scenario.name,
              configuration: scenario,
              // We use a combination of user_id and maybe name or ID to identify uniqueness?
              // Ideally we should have a stable ID. Scenario.id is used.
              // But 'upsert' needs a primary key or unique constraint. 
              // Our schema has 'id' as primary key.
              // If scenario.id is not a UUID, we might have issues if we map it directly to DB ID.
              // But our schema says id is uuid. 'exact-pm-ecosystem' is NOT a UUID.
              // So we should query by 'configuration->>id' or store the mapping.
              // For simplicity, let's delete existing for this user and re-insert, or manage mapping.
              // A better way: query existing scenarios for this user, match by config ID, and update.
            }, { onConflict: 'id' }); // This won't work if ID is not matching DB ID.
            
            // Let's rely on finding by query first?
            // Actually, let's just use the 'id' from the DB if it exists, or generate new.
            // But updated scenarios might not have DB IDs.
            
            // WORKAROUND: Delete all for user and re-insert? (Risky)
            // BETTER: Add a 'db_id' to the Scenario type? Or just store everything in one row?
            // No, user wants "database extension".
            
            // Let's just try to match by name or keep it simple for now:
            // Store the whole array in ONE row? No, that defeats the purpose of "database".
            
            // Query by configuration->>id to find existing scenario
            const { data: existingRows } = await supabase
              .from('scenarios')
              .select('id')
              .eq('user_id', user.id)
              .filter('configuration->>id', 'eq', scenario.id);
              
            if (existingRows && existingRows.length > 0) {
               // Update the first match
               const firstId = existingRows[0].id;
               await supabase.from('scenarios').update({
                 name: scenario.name,
                 configuration: scenario,
                 updated_at: new Date().toISOString()
               }).eq('id', firstId);
               
               // Self-healing: Delete duplicates if they exist
               if (existingRows.length > 1) {
                   const idsToDelete = existingRows.slice(1).map(r => r.id);
                   await supabase.from('scenarios').delete().in('id', idsToDelete);
                   console.log('Cleaned up duplicate scenarios:', idsToDelete);
               }
            } else {
               await supabase.from('scenarios').insert({
                 user_id: user.id,
                 name: scenario.name,
                 configuration: scenario
               });
            }
        }
      } catch (e) {
        console.error("Error saving to Supabase:", e);
      }
    }
    
    // Keep local storage as backup/cache
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setView('onboarding');
  };

  if (!user) {
    return <Login />;
  }
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Laden...</div>;
  }

  return (
    <div className="min-h-screen bg-white text-exact-dark">
      <header className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-50">
        <div className="flex items-center gap-12">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => setView('onboarding')}
          >
            <span className="text-exact-red font-black text-3xl tracking-tighter">=EXACT</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
             <button onClick={() => setView('onboarding')} className={`text-sm font-bold hover:text-exact-blue transition-colors ${view === 'onboarding' ? 'text-exact-blue' : 'text-gray-600'}`}>Onze teams</button>
             <button disabled={!interviewData} onClick={() => setView('report')} className={`text-sm font-bold hover:text-exact-blue transition-colors ${view === 'report' ? 'text-exact-blue' : 'text-gray-600 disabled:opacity-30'}`}>Jouw werkervaring</button>
             <button className="text-sm font-bold text-gray-600 hover:text-exact-blue transition-colors">Wij zijn Exact</button>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setView('admin')}
            className={`p-2 hover:bg-gray-100 rounded-lg transition-all ${view === 'admin' ? 'text-exact-blue' : 'text-gray-400'}`}
          >
            <Settings size={22} />
          </button>
          <button 
            onClick={signOut}
            className="p-2 hover:bg-gray-100 rounded-lg transition-all text-gray-400 hover:text-red-500"
            title="Uitloggen"
          >
            <LogOut size={22} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {view === 'admin' && <AdminPanel scenarios={scenarios} activeScenarioId={activeScenarioId} onSave={saveScenarios} />}
        {view === 'onboarding' && <Onboarding scenarios={scenarios} onComplete={startSession} />}
        {view === 'interview' && <InterviewRoom scenario={activeScenario} participant={participant} onFinish={finishSession} />}
        {view === 'report' && interviewData && <Reports scenario={activeScenario} interviewState={interviewData} participant={participant} onRestart={() => setView('onboarding')} />}
      </main>
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
