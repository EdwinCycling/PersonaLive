
import React, { useEffect, useState } from 'react';
import { Scenario, InterviewState, EvaluationReport, ParticipantProfile } from '../types';
import { generateGenericReport } from '../services/geminiService';
import { RefreshCw, Download, FileText, TrendingUp, CheckCircle, Info, Star } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface Props {
  scenario: Scenario;
  interviewState: InterviewState;
  participant: ParticipantProfile;
  onRestart: () => void;
}

export const Reports: React.FC<Props> = ({ scenario, interviewState, participant, onRestart }) => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<EvaluationReport | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      const data = await generateGenericReport(interviewState.messages, scenario, participant, interviewState.selectedCase);
      setReport(data);
      setLoading(false);
    };
    fetchReport();
  }, [interviewState, scenario, participant]);

  const generatePDF = () => {
    if (!report) return;
    const doc = new jsPDF();
    doc.setFillColor(124, 0, 255);
    doc.rect(0, 0, 210, 60, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("Evaluatie Rapportage", 20, 30);
    doc.setFontSize(10);
    doc.text(`Kandidaat: ${participant.name}`, 20, 40);
    doc.text(`Proces: ${scenario.name}`, 20, 45);
    
    doc.setTextColor(26, 26, 26);
    doc.setFontSize(14);
    doc.text("Analyse:", 20, 80);
    doc.setFontSize(10);
    const splitSummary = doc.splitTextToSize(report.summary, 170);
    doc.text(splitSummary, 20, 90);
    
    doc.save(`Exact_Report_${participant.name}.pdf`);
  };

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center space-y-8 bg-gray-50">
      <div className="w-20 h-20 border-4 border-exact-purple border-t-transparent rounded-full animate-spin" />
      <div className="text-center">
        <h3 className="text-2xl font-black text-exact-dark mb-2">Analyse wordt verwerkt</h3>
        <p className="text-gray-400 font-medium max-w-sm">We evalueren het gesprek op basis van de Exact recruitment standaarden.</p>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-12 bg-gray-50 pb-32">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header Card */}
        <div className="bg-white border border-gray-200 p-10 flex justify-between items-center shadow-sm">
           <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-exact-purple/10 flex items-center justify-center text-exact-purple">
                 <FileText size={32}/>
              </div>
              <div>
                 <h2 className="text-4xl font-black tracking-tighter">Resultaat Evaluatie</h2>
                 <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">{scenario.name} • {participant.name}</p>
              </div>
           </div>
           <div className="flex gap-4">
              <button onClick={generatePDF} className="bg-white border-2 border-gray-100 px-6 py-3 font-bold flex items-center gap-2 hover:bg-gray-50 transition-all">
                <Download size={18}/> PDF OPSLAAN
              </button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           <div className="lg:col-span-8 space-y-10">
              {/* Score Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-exact-purple p-10 flex flex-col items-center justify-center text-white shadow-xl shadow-exact-purple/20">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">SCORE</span>
                    <span className="text-7xl font-black leading-none">{report?.score}</span>
                 </div>
                 <div className="md:col-span-2 bg-white p-10 border border-gray-200">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Conclusie</h3>
                    <p className="text-gray-600 font-medium italic leading-relaxed text-lg">"{report?.summary}"</p>
                 </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-8 border border-gray-200 space-y-6">
                    <h4 className="font-black flex items-center gap-3 text-exact-purple uppercase text-xs tracking-widest">
                      <TrendingUp size={16}/> Gedrag & Houding
                    </h4>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                          <span className="text-[10px] text-gray-400 font-black uppercase">Consistentie</span>
                          <span className="font-bold">{report?.behavioralAnalysis.consistencyScore}/10</span>
                       </div>
                       <p className="text-sm text-gray-500 font-medium leading-relaxed">{report?.behavioralAnalysis.notes}</p>
                    </div>
                 </div>

                 <div className="bg-white p-8 border border-gray-200 space-y-6">
                    <h4 className="font-black flex items-center gap-3 text-exact-red uppercase text-xs tracking-widest">
                      <Star size={16}/> Inhoudelijke Fit
                    </h4>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                          <span className="text-[10px] text-gray-400 font-black uppercase">Context Match</span>
                          <span className="font-bold text-xs">{report?.contentAnalysis.matchWithContext}</span>
                       </div>
                       <p className="text-sm text-gray-500 font-medium leading-relaxed">{report?.contentAnalysis.depth}</p>
                    </div>
                 </div>
              </div>
           </div>

           {/* Feedback Sidebar */}
           <div className="lg:col-span-4 space-y-8">
              <div className="bg-exact-dark p-10 text-white relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-2 h-24 bg-exact-red" />
                 <h3 className="text-2xl font-black mb-6">Persoonlijk Advies</h3>
                 <p className="text-sm leading-relaxed mb-8 text-gray-400">"{report?.participantFeedback.mainFeedback}"</p>
                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Tips voor vervolg</h4>
                    <ul className="space-y-4">
                       {report?.participantFeedback.tips.map((tip, i) => (
                         <li key={i} className="flex gap-4 text-sm font-bold border-l-2 border-exact-purple pl-4">
                            {tip}
                         </li>
                       ))}
                    </ul>
                 </div>
              </div>

              <button onClick={onRestart} className="w-full bg-exact-purple hover:bg-exact-purple/90 text-white py-5 font-black flex items-center justify-center gap-3 transition-all">
                 <RefreshCw size={20}/> NIEUW PROCES STARTEN
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
