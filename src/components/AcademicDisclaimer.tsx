import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const AcademicDisclaimer: React.FC = () => {
  return (
    <div className="bg-amber-950/40 border-y border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200/90">
      <div className="flex items-center space-x-2 max-w-5xl">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong className="text-amber-300 uppercase tracking-wide mr-1.5 font-semibold">Academic Research Prototype:</strong>
          AI landslide predictions are experimental research outputs and must not replace official disaster warnings issued by authorized authorities in Nepal (DHM, NDRRMA, MoHA).
        </span>
      </div>
      <span className="hidden md:inline-flex px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold tracking-wider uppercase border border-amber-500/40">
        Experimental Prototype
      </span>
    </div>
  );
};
