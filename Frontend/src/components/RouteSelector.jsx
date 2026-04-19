import { Zap, ShieldCheck, ArrowLeft, Clock } from 'lucide-react';

const RouteSelector = ({ selectedMode, onSelect, fastest, safest, onBack }) => {
  return (
    <div className="flex flex-col w-full bg-white/50 backdrop-blur-sm border-b border-zinc-100">
      <div className="flex items-center px-6 py-4">
        <button 
          onClick={onBack}
          className="p-2.5 hover:bg-white rounded-full transition-all shadow-sm border border-zinc-100 mr-3 active:scale-90"
        >
          <ArrowLeft size={18} className="text-zinc-600" />
        </button>
        <div>
          <h2 className="text-lg font-bold tracking-tight">Routes</h2>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Choose your priority</p>
        </div>
      </div>
      
      <div className="flex gap-3 px-6 pb-6 pt-0">
        <div 
          onClick={() => onSelect('fastest')}
          className={`flex-1 flex flex-col items-center p-4 rounded-2xl border-2 transition-all cursor-pointer relative group ${
            selectedMode === 'fastest' 
              ? 'border-blue-500 bg-blue-50/50 shadow-lg shadow-blue-500/10' 
              : 'border-white bg-zinc-50 hover:border-zinc-200'
          }`}
        >
          <div className={`absolute -top-2 right-2 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 z-10 uppercase tracking-tighter ${
            fastest?.safetyScore >= 70 ? 'bg-emerald-500' : fastest?.safetyScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
          }`}>
            Safety: {(fastest?.safetyScore / 10).toFixed(1)}
          </div>
          <Zap className={`${selectedMode === 'fastest' ? 'text-blue-600 scale-110' : 'text-zinc-400'} mb-2 transition-transform`} size={22} />
          <span className={`text-[10px] font-bold tracking-widest ${selectedMode === 'fastest' ? 'text-blue-700' : 'text-zinc-400'}`}>FASTEST</span>
          <div className="flex items-center gap-1 mt-1">
            <Clock size={12} className="text-zinc-400" />
            <span className="text-sm font-bold text-zinc-900">{fastest?.duration.text || '--'}</span>
          </div>
        </div>
        
        <div 
          onClick={() => onSelect('safest')}
          className={`flex-1 flex flex-col items-center p-4 rounded-2xl border-2 transition-all cursor-pointer relative group ${
            selectedMode === 'safest' 
              ? 'border-emerald-500 bg-emerald-50/50 shadow-lg shadow-emerald-500/10' 
              : 'border-white bg-zinc-50 hover:border-zinc-200'
          }`}
        >
          <div className="absolute -top-2 right-2 bg-emerald-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 z-10 uppercase tracking-tighter">
            Safety: {(safest?.safetyScore / 10).toFixed(1)} 🛡️
          </div>
          <ShieldCheck className={`${selectedMode === 'safest' ? 'text-emerald-600 scale-110' : 'text-zinc-400'} mb-2 transition-transform`} size={22} />
          <span className={`text-[10px] font-bold tracking-widest ${selectedMode === 'safest' ? 'text-emerald-700' : 'text-zinc-400'}`}>SAFEST</span>
          <div className="flex items-center gap-1 mt-1">
            <Clock size={12} className="text-zinc-400" />
            <span className="text-sm font-bold text-zinc-900">{safest?.duration.text || '--'}</span>
          </div>
          {safest?.duration.value > fastest?.duration.value && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-emerald-100 text-[8px] text-emerald-700 font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
              +{Math.ceil((safest.duration.value - fastest.duration.value)/60)} MINS
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouteSelector;
