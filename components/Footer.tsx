import React, { useState } from 'react';
import { X } from 'lucide-react';

export const Footer: React.FC = () => {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showCookies, setShowCookies] = useState(false);

  return (
    <>
      <footer className="bg-white border-t border-gray-100 py-3 px-8 flex justify-between items-center text-[10px] uppercase tracking-wider text-gray-400 font-medium">
        <div className="flex gap-6">
          <button onClick={() => setShowDisclaimer(true)} className="hover:text-exact-blue transition-colors">Disclaimer</button>
          <button onClick={() => setShowCookies(true)} className="hover:text-exact-blue transition-colors">Cookie Policy</button>
        </div>
        <div>v.09.251224.1</div>
      </footer>

      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative border border-gray-100">
                <button 
                    onClick={() => setShowDisclaimer(false)} 
                    className="absolute top-4 right-4 p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                >
                    <X size={20}/>
                </button>
                <h3 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-tight">Disclaimer</h3>
                <div className="prose prose-sm text-gray-600 leading-relaxed">
                    <p>
                        Deze applicatie is een prototype ontwikkeld voor demonstratie- en testdoeleinden binnen de Exact omgeving.
                    </p>
                    <p className="mt-2">
                        De gegenereerde content door AI (Artificial Intelligence) dient als ondersteuning en kan onnauwkeurigheden bevatten. Gebruikers blijven te allen tijde zelf verantwoordelijk voor de verificatie van de output en de uiteindelijke besluitvorming.
                    </p>
                </div>
            </div>
        </div>
      )}
      
      {/* Cookie Modal */}
      {showCookies && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative border border-gray-100">
                <button 
                    onClick={() => setShowCookies(false)} 
                    className="absolute top-4 right-4 p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                >
                    <X size={20}/>
                </button>
                <h3 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-tight">Cookie Policy & Privacy</h3>
                <div className="prose prose-sm text-gray-600 leading-relaxed">
                    <p>
                        Wij hechten grote waarde aan uw privacy en transparantie.
                    </p>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 my-4">
                        <p className="text-blue-800 font-medium">
                            Deze applicatie gebruikt <strong>uitsluitend functionele Local Storage</strong>.
                        </p>
                    </div>
                    <p>
                        Dit betekent dat uw instellingen (zoals scenario's en voorkeuren) lokaal op uw eigen apparaat worden opgeslagen om de applicatie correct te laten werken.
                    </p>
                    <p className="mt-2">
                        Wij maken <strong>geen</strong> gebruik van:
                    </p>
                    <ul className="list-disc pl-4 mt-1 space-y-1">
                        <li>Tracking cookies</li>
                        <li>Analytische cookies van derden</li>
                        <li>Advertentie cookies</li>
                    </ul>
                </div>
            </div>
        </div>
      )}
    </>
  );
};
