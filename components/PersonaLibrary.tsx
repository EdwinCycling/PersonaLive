import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { X, User, Briefcase, Target, AlertCircle, Calendar, ArrowRight, ChevronLeft, Layout, List, Search, Brain, MessageSquare, Heart, Zap } from 'lucide-react';

// Types matching the database structure
export interface PersonaData {
  jobTitle?: string;
  introDescription?: string;
  detailedDescription?: string;
  imageUrl?: string;
  goals?: { title: string; description: string }[] | string[];
  painPoints?: { title: string; description: string }[] | string[];
  traits?: { label: string; value: number; leftLabel?: string; rightLabel?: string }[];
  communicationStyle?: { label: string; value: number; leftLabel?: string; rightLabel?: string }[];
  // Add other fields as discovered
  [key: string]: any;
}

export interface SupabasePersona {
  id: string;
  name: string;
  department_id?: string;
  data: PersonaData;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (persona: SupabasePersona) => void;
}

export const PersonaLibrary: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const [personas, setPersonas] = useState<SupabasePersona[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<SupabasePersona | null>(null);
  const [view, setView] = useState<'grid' | 'detail'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDept, setActiveDept] = useState<string>('Alle');

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch personas
      const { data: personaData, error: personaError } = await supabase
        .from('personas')
        .select('*')
        .order('updated_at', { ascending: false });

      if (personaError) {
        console.error('Error fetching personas:', personaError);
        throw personaError;
      }
      
      // Fetch departments (if the table exists, otherwise ignore)
      let deptData: Department[] = [];
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('*');
        if (!error && data) {
           deptData = data;
        }
      } catch (deptErr) {
        // console.warn('Departments table likely missing or inaccessible:', deptErr);
      }
      
      setPersonas(personaData || []);
      setDepartments(deptData || []);

    } catch (err) {
      console.error('Critical error fetching library data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPlaceholderImage = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=256`;
  };

  const filteredPersonas = personas.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.data.jobTitle && p.data.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Group by department
  const groupedPersonas = filteredPersonas.reduce((acc, persona) => {
    let deptName = 'Overig';
    
    if (persona.department_id) {
        const foundDept = departments.find(d => d.id === persona.department_id);
        if (foundDept) {
            deptName = foundDept.name;
        } else {
             deptName = 'Overig';
        }
    }

    if (!acc[deptName]) acc[deptName] = [];
    acc[deptName].push(persona);
    return acc;
  }, {} as Record<string, SupabasePersona[]>);

  const availableDepartments = ['Alle', ...Object.keys(groupedPersonas).sort()];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full h-full max-w-[95vw] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-gray-100">
        
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-gray-50 bg-white">
          <div className="flex items-center gap-4">
            {view === 'detail' && (
              <button 
                onClick={() => { setView('grid'); setSelectedPersona(null); }}
                className="p-2 hover:bg-gray-50 rounded-full transition-colors border border-gray-100"
              >
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
            )}
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                {view === 'grid' ? 'Persona Bibliotheek' : selectedPersona?.name}
              </h2>
              <p className="text-gray-400 text-sm font-medium">
                {view === 'grid' 
                  ? 'Selecteer een persona om te gebruiken in je scenario' 
                  : selectedPersona?.data.jobTitle || 'Geen rol beschrijving'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full transition-colors border border-gray-100">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-8">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : view === 'grid' ? (
            /* GRID VIEW */
            <div className="max-w-7xl mx-auto space-y-8">
              {/* Controls */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                {/* Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto no-scrollbar">
                  {availableDepartments.map(dept => (
                    <button
                      key={dept}
                      onClick={() => setActiveDept(dept)}
                      className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                        activeDept === dept 
                          ? 'bg-gray-900 text-white shadow-lg shadow-gray-200' 
                          : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-200 hover:text-gray-700'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Zoeken..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 rounded-full border border-gray-200 bg-white focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-shadow text-sm font-medium"
                  />
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                 {(Object.entries(groupedPersonas) as Array<[string, SupabasePersona[]]>)
                    .filter(([dept]) => activeDept === 'Alle' || dept === activeDept)
                    .flatMap(([_, personas]) => personas)
                    .map((persona) => (
                      <div 
                        key={persona.id} 
                        onClick={() => { setSelectedPersona(persona); setView('detail'); }}
                        className="group bg-white rounded-2xl p-3 border border-gray-100 hover:border-gray-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gray-100 mb-4">
                          <img 
                              src={persona.data.imageUrl || getPlaceholderImage(persona.name)} 
                              alt={persona.name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                              onError={(e) => {
                                  (e.target as HTMLImageElement).src = getPlaceholderImage(persona.name);
                              }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                          <div className="absolute bottom-3 left-3 right-3">
                             <h3 className="text-white font-bold text-lg truncate leading-tight shadow-sm">{persona.name}</h3>
                             <p className="text-gray-200 text-xs truncate font-medium opacity-90">{persona.data.jobTitle || 'Geen rol'}</p>
                          </div>
                        </div>
                        
                        <div className="px-2 flex flex-col flex-1">
                          <p className="text-gray-500 text-xs line-clamp-3 mb-4 leading-relaxed">
                            {persona.data.introDescription || 'Geen beschrijving beschikbaar.'}
                          </p>
                          
                          <div className="flex items-center gap-2 mt-auto">
                              {persona.data.goals && persona.data.goals.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-100">
                                      <Target size={12} className="text-gray-400" />
                                      <span>{persona.data.goals.length}</span>
                                  </div>
                              )}
                              {persona.data.painPoints && persona.data.painPoints.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-100">
                                      <AlertCircle size={12} className="text-gray-400" />
                                      <span>{persona.data.painPoints.length}</span>
                                  </div>
                              )}
                          </div>
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          ) : (
            /* DETAIL VIEW */
            <div className="max-w-7xl mx-auto">
              {selectedPersona && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left Sidebar */}
                  <div className="lg:col-span-4 space-y-6 sticky top-0">
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-gray-900 to-gray-800"></div>
                      
                      <div className="relative w-40 h-40 rounded-full border-4 border-white shadow-xl mb-6 overflow-hidden bg-white">
                        <img 
                            src={selectedPersona.data.imageUrl || getPlaceholderImage(selectedPersona.name)} 
                            alt={selectedPersona.name} 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = getPlaceholderImage(selectedPersona.name);
                            }}
                        />
                      </div>
                      
                      <h2 className="text-3xl font-black text-gray-900 mb-2">{selectedPersona.name}</h2>
                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-50 text-red-600 font-bold text-sm mb-6 border border-red-100">
                        {selectedPersona.data.jobTitle}
                      </div>

                      <button 
                        onClick={() => onSelect(selectedPersona)}
                        className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-2xl font-bold shadow-lg shadow-gray-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                      >
                        <span>Gebruik Persona</span>
                        <ArrowRight size={18} />
                      </button>
                    </div>

                    {/* Traits Visualization */}
                    {selectedPersona.data.traits && (
                      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <Brain className="text-purple-500" size={24} />
                            <h3 className="text-lg font-bold text-gray-900">Persoonlijkheid</h3>
                        </div>
                        <div className="space-y-6">
                          {selectedPersona.data.traits.map((trait: any, idx: number) => (
                            <div key={idx}>
                              <div className="flex justify-between text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                                <span>{trait.leftLabel || 'Laag'}</span>
                                <span>{trait.rightLabel || 'Hoog'}</span>
                              </div>
                              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="absolute top-0 bottom-0 bg-purple-600 rounded-full transition-all duration-1000" 
                                  style={{ width: `${(trait.value || 50)}%` }}
                                ></div>
                              </div>
                              <div className="text-center mt-1 text-xs font-bold text-gray-900">{trait.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Content */}
                  <div className="lg:col-span-8 space-y-8">
                    
                    {/* About Section */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                       <div className="flex items-center gap-3 mb-6">
                          <User className="text-blue-500" size={24} />
                          <h3 className="text-xl font-bold text-gray-900">Over {selectedPersona.name.split(' ')[0]}</h3>
                       </div>
                       
                       <p className="text-xl leading-relaxed text-gray-700 font-medium mb-8">
                         {selectedPersona.data.introDescription}
                       </p>

                       {selectedPersona.data.detailedDescription && (
                         <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 text-gray-600 leading-loose">
                           {selectedPersona.data.detailedDescription}
                         </div>
                       )}
                    </div>

                    {/* Goals & Pains Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Goals */}
                      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 h-full">
                        <div className="flex items-center gap-3 mb-6">
                          <Target className="text-green-500" size={24} />
                          <h3 className="text-xl font-bold text-gray-900">Doelen & Drijfveren</h3>
                        </div>
                        <div className="space-y-4">
                          {selectedPersona.data.goals?.map((goal: any, idx: number) => {
                             const title = typeof goal === 'string' ? goal : goal.title;
                             const desc = typeof goal === 'string' ? '' : goal.description;
                             return (
                              <div key={idx} className="flex gap-4">
                                <div className="mt-1.5 min-w-[6px] h-[6px] rounded-full bg-green-500"></div>
                                <div>
                                  <div className="font-bold text-gray-900">{title}</div>
                                  {desc && <div className="text-sm text-gray-500 mt-1">{desc}</div>}
                                </div>
                              </div>
                             );
                          })}
                          {(!selectedPersona.data.goals || selectedPersona.data.goals.length === 0) && (
                            <p className="text-gray-400 italic">Geen doelen bekend.</p>
                          )}
                        </div>
                      </div>

                      {/* Pains */}
                      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 h-full">
                        <div className="flex items-center gap-3 mb-6">
                          <AlertCircle className="text-red-500" size={24} />
                          <h3 className="text-xl font-bold text-gray-900">Frustraties & Pijnpunten</h3>
                        </div>
                        <div className="space-y-4">
                          {selectedPersona.data.painPoints?.map((pain: any, idx: number) => {
                             const title = typeof pain === 'string' ? pain : pain.title;
                             const desc = typeof pain === 'string' ? '' : pain.description;
                             return (
                              <div key={idx} className="flex gap-4">
                                <div className="mt-1.5 min-w-[6px] h-[6px] rounded-full bg-red-500"></div>
                                <div>
                                  <div className="font-bold text-gray-900">{title}</div>
                                  {desc && <div className="text-sm text-gray-500 mt-1">{desc}</div>}
                                </div>
                              </div>
                             );
                          })}
                           {(!selectedPersona.data.painPoints || selectedPersona.data.painPoints.length === 0) && (
                            <p className="text-gray-400 italic">Geen pijnpunten bekend.</p>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
