
import React from 'react';

interface Props {
  status: 'idle' | 'listening' | 'processing' | 'speaking';
}

export const Visualizer: React.FC<Props> = ({ status }) => {
  let colorClass = "bg-gray-200 border-gray-300";
  let blobSize = "scale-90 opacity-20";
  let pulse = "";

  if (status === 'listening') {
    // Licht groen effect wanneer de AI luistert
    colorClass = "bg-emerald-400/30 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.4)]";
    blobSize = "scale-105 opacity-80";
    pulse = "animate-[pulse_1.5s_infinite]";
  } else if (status === 'speaking') {
    colorClass = "bg-exact-blue/20 border-exact-blue shadow-[0_0_30px_rgba(0,89,209,0.3)]";
    blobSize = "scale-110 opacity-100";
    pulse = "animate-pulse";
  } else if (status === 'processing') {
    colorClass = "bg-gray-400/20 border-gray-500";
    blobSize = "scale-95 opacity-50";
    pulse = "animate-spin-slow";
  }

  const getLabel = () => {
    switch(status) {
      case 'listening': return 'AAN HET LUISTEREN';
      case 'speaking': return 'AAN HET SPREKEN';
      case 'processing': return 'AAN HET VERWERKEN';
      default: return 'STANDBY';
    }
  };

  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* Glow Effect Layer */}
      <div className={`absolute inset-0 rounded-full transition-all duration-700 blur-3xl ${colorClass} ${pulse} ${blobSize}`} />
      
      {/* Main Sphere */}
      <div 
        className={`relative w-32 h-32 rounded-full border-4 transition-all duration-500 flex items-center justify-center overflow-hidden bg-white
        ${status === 'speaking' ? 'animate-[bounce_0.5s_infinite]' : ''}`}
        style={{ 
          borderColor: status === 'speaking' ? '#0059d1' : (status === 'listening' ? '#34d399' : '#e5e5e5') 
        }}
      >
        <div className={`w-20 h-1 rounded-full blur-[1px] ${status === 'speaking' ? 'bg-exact-blue' : (status === 'listening' ? 'bg-emerald-400' : 'bg-gray-200')}`} />
      </div>

      {/* Dynamic Status Label */}
      <div className={`absolute -bottom-8 text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${status === 'listening' ? 'text-emerald-600' : 'text-gray-400'}`}>
        {getLabel()}
      </div>
    </div>
  );
};
