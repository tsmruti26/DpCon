import React from 'react';

interface Props {
  score: number;
  riskLevel: string;
}

export const PrivacyScore: React.FC<Props> = ({ score, riskLevel }) => {
  const getColor = () => {
    if (score > 80) return 'text-emerald-500';
    if (score > 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 text-white shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Privacy Health Score</h3>
      </div>

      <div className="flex flex-col items-center justify-center py-4">
        <div className={`text-6xl font-bold ${getColor()}`}>
          {score}%
        </div>
        <div className="mt-2 text-slate-400 uppercase tracking-widest text-xs">
          Risk Level: <span className={getColor()}>{riskLevel}</span>
        </div>
      </div>

      <div className="w-full bg-slate-700 h-2 rounded-full mt-4 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${score > 80 ? 'bg-emerald-500' : score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};
