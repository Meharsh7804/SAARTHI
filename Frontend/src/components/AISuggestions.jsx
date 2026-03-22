import React from 'react';
import { Shield, AlertCircle, CheckCircle, MapPin } from 'lucide-react';

const AISuggestions = ({ suggestion, safePlacesData }) => {
  if (!suggestion) return null;

  const { message, riskLevel } = suggestion;

  const getRiskStyles = () => {
    switch (riskLevel) {
      case 'high':
        return {
          bg: 'bg-red-50',
          border: 'border-red-100',
          text: 'text-red-700',
          icon: <AlertCircle className="text-red-600" size={20} />,
          badge: 'bg-red-600'
        };
      case 'medium':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-100',
          text: 'text-yellow-700',
          icon: <AlertCircle className="text-yellow-600" size={20} />,
          badge: 'bg-yellow-600'
        };
      default:
        return {
          bg: 'bg-green-50',
          border: 'border-green-100',
          text: 'text-green-700',
          icon: <CheckCircle className="text-green-600" size={20} />,
          badge: 'bg-green-600'
        };
    }
  };

  const styles = getRiskStyles();

  return (
    <div className={`mt-4 rounded-2xl border ${styles.border} ${styles.bg} p-4 transition-all duration-300`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Shield className="text-blue-600" size={20} />
          <h3 className="font-bold text-zinc-900 text-sm">Saarthi AI Assistant</h3>
        </div>
        <span className={`${styles.badge} text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider`}>
          {riskLevel} Risk
        </span>
      </div>

      <p className={`text-xs ${styles.text} font-medium leading-relaxed mb-3`}>
        {message}
      </p>

      {safePlacesData && safePlacesData.places.length > 0 && (
        <div className="mt-3 pt-3 border-t border-black/5">
          <p className="text-[11px] font-bold text-zinc-600 mb-2 flex items-center gap-1">
            <MapPin size={12} /> {safePlacesData.message}
          </p>
          <div className="flex flex-wrap gap-2">
            {safePlacesData.places.map((place, index) => (
              <div key={index} className="bg-white/80 border border-black/5 rounded-lg px-2 py-1.5 flex flex-col">
                <span className="text-[10px] font-bold text-zinc-800">{place.name}</span>
                <span className="text-[9px] text-zinc-500">{place.distance} • {place.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AISuggestions;
