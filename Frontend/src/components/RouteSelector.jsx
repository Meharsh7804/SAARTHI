import { Zap, ShieldCheck, ArrowLeft } from 'lucide-react';

const RouteSelector = ({ selectedMode, onSelect, fastest, safest, onBack }) => {
  return (
    <div className="flex flex-col w-full bg-white">
      <div className="flex items-center px-4 py-3 border-b">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-zinc-100 rounded-full transition-colors mr-2"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-bold">Recommended Routes</h2>
      </div>
      
      <div className="flex gap-2 p-4 pt-2">
        <div 
          onClick={() => onSelect('fastest')}
          className={`flex-1 flex flex-col items-center p-3 rounded-2xl border-2 transition-all cursor-pointer ${
            selectedMode === 'fastest' 
              ? 'border-blue-600 bg-blue-50 shadow-md' 
              : 'border-transparent bg-zinc-100 hover:bg-zinc-200'
          }`}
        >
          <Zap className={`${selectedMode === 'fastest' ? 'text-blue-600' : 'text-zinc-400'} mb-1`} size={20} />
          <span className="text-xs font-bold">FASTEST</span>
          <span className="text-xs text-zinc-500 font-medium">{fastest?.duration.text || '--'}</span>
        </div>
        
        <div 
          onClick={() => onSelect('safest')}
          className={`flex-1 flex flex-col items-center p-3 rounded-2xl border-2 transition-all cursor-pointer relative ${
            selectedMode === 'safest' 
              ? 'border-green-600 bg-green-50 shadow-md' 
              : 'border-transparent bg-zinc-100 hover:bg-zinc-200'
          }`}
        >
          <div className="absolute -top-1 -right-1 bg-green-600 text-white text-[9px] px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 z-10">
            Safe 🛡️
          </div>
          <ShieldCheck className={`${selectedMode === 'safest' ? 'text-green-600' : 'text-zinc-400'} mb-1`} size={20} />
          <span className="text-xs font-bold">SAFEST</span>
          <span className="text-xs text-zinc-500 font-medium">{safest?.duration.text || '--'}</span>
        </div>
      </div>
    </div>
  );
};

export default RouteSelector;
