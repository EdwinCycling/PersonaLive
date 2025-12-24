
export type Role = 'user' | 'model';

export interface Message {
  role: Role;
  text: string;
  timestamp: Date;
  latency?: number; 
  duration?: number; 
}

export interface ParticipantProfile {
  name: string;
  language: string; 
  selectedKeywords: string[];
  bio: string;
  cvText?: string;
  answers: { question: string; answer: string }[];
}

export type StepType = 
  | 'intro' 
  | 'motivation' 
  | 'problem_statement' 
  | 'practical_case' 
  | 'deep_dive' 
  | 'summary' 
  | 'closing' 
  | 'completed'
  | 'custom';

export interface WorkflowStep {
  id: string;
  type: StepType;
  label: string;
  aiInstruction: string; 
}

export interface InfoField {
  id: string;
  label: string;
  content: string;
}

export type PersonaMood = 
  | 'vrolijk' 
  | 'boos' 
  | 'humoristisch' 
  | 'serieus' 
  | 'inhoudelijk' 
  | 'wollig' 
  | 'sarcastisch' 
  | 'empathisch' 
  | 'autoritair';

export type PersonaComprehension = 
  | 'meegaand'    // Quick to understand and agree
  | 'begrijpend'  // Standard understanding
  | 'vragend'     // Needs clarification, asks "why?"
  | 'kritisch'    // Hard to please, looks for flaws
  | 'onverzettelijk'; // Very stubborn, almost never agrees directly

export type SessionType = 'standard' | 'call';

export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface Scenario {
  id: string;
  name: string;
  persona: {
    name: string;
    role: string;
    mood: PersonaMood;
    comprehensionLevel: PersonaComprehension;
    description: string;
    voiceName: VoiceName;
  };
  infoFields: InfoField[];
  workflow: WorkflowStep[];
  caseLibrary: string[];
  randomizeCase: boolean;
  sessionType: SessionType;
  config: {
    requireCv: boolean;
    requireLanguage: boolean;
    requireProfile: boolean;
    autoTerminate: boolean;
    evaluationFocus: string;
  };
  documentation: string;
}

export interface InterviewState {
  currentPhase: string;
  startTime: number;
  messages: Message[];
  selectedCase?: string;
}

export interface EvaluationReport {
  summary: string;
  score: number;
  sentiment: string;
  behavioralAnalysis: {
    averageLatency: number;
    consistencyScore: number;
    notes: string;
  };
  contentAnalysis: {
    accuracy: number;
    depth: string;
    matchWithContext: string;
  };
  participantFeedback: {
    mainFeedback: string;
    tips: string[];
  };
}
