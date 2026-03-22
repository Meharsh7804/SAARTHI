import React, { useState, useEffect } from 'react';
import { X, Clock, MapPin, Sparkles } from 'lucide-react';
import Button from './Button';
import LocationSuggestions from './LocationSuggestions';

const SaarthiAIModal = ({ isOpen, onClose, onStartAutoBooking, loading, suggestions, onLocationChange, setSuggestions }) => {
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [activeField, setActiveField] = useState(null); // 'pickup' or 'destination'

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pickup && destination && arrivalTime) {
      onStartAutoBooking({ pickup, destination, arrivalTime });
    }
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    if (id === "pickup") setPickup(value);
    if (id === "destination") setDestination(value);
    
    setActiveField(id);
    onLocationChange(value);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
        <div className="p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                <Sparkles className="text-white" size={20} />
              </div>
              <h2 className="text-xl font-bold">Saarthi Agentic Mode</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <p className="text-sm text-zinc-500 mb-6 font-medium">
            Enter your trip details and desired arrival time. Saarthi AI will automatically book your ride at the perfect moment.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 flex flex-col">
            <div className="relative">
              <div className="absolute left-3 top-5 w-8 h-8 flex items-center justify-center bg-zinc-100 rounded-lg">
                <MapPin size={16} className="text-zinc-600" />
              </div>
              <input
                id="pickup"
                type="text"
                placeholder="Pickup Location"
                value={pickup}
                onChange={handleInputChange}
                onFocus={() => setActiveField('pickup')}
                className="w-full bg-zinc-50 pl-14 pr-4 py-4 rounded-2xl outline-none focus:ring-2 ring-blue-500/20 text-sm border border-zinc-100 font-medium"
                required
                autoComplete="off"
              />
              {activeField === 'pickup' && suggestions.length > 0 && (
                <div className="mt-2 bg-white rounded-xl border border-zinc-100 shadow-xl overflow-hidden max-h-[200px] overflow-y-auto z-20">
                  <LocationSuggestions 
                    suggestions={suggestions} 
                    setSuggestions={setSuggestions} 
                    setPickupLocation={setPickup} 
                    setDestinationLocation={setDestination} 
                    input="pickup" 
                  />
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute left-3 top-5 w-8 h-8 flex items-center justify-center bg-zinc-100 rounded-lg">
                <MapPin size={16} className="text-zinc-600" />
              </div>
              <input
                id="destination"
                type="text"
                placeholder="Drop-off Location"
                value={destination}
                onChange={handleInputChange}
                onFocus={() => setActiveField('destination')}
                className="w-full bg-zinc-50 pl-14 pr-4 py-4 rounded-2xl outline-none focus:ring-2 ring-blue-500/20 text-sm border border-zinc-100 font-medium"
                required
                autoComplete="off"
              />
              {activeField === 'destination' && suggestions.length > 0 && (
                <div className="mt-2 bg-white rounded-xl border border-zinc-100 shadow-xl overflow-hidden max-h-[200px] overflow-y-auto z-20">
                  <LocationSuggestions 
                    suggestions={suggestions} 
                    setSuggestions={setSuggestions} 
                    setPickupLocation={setPickup} 
                    setDestinationLocation={setDestination} 
                    input="destination" 
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block ml-1">
                Desired Arrival Time
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-zinc-100 rounded-lg pointer-events-none">
                  <Clock size={16} className="text-zinc-600" />
                </div>
                <input
                  type="time"
                  value={arrivalTime}
                  onChange={(e) => {
                    setArrivalTime(e.target.value);
                    setActiveField(null);
                  }}
                  className="w-full bg-zinc-50 pl-14 pr-4 py-4 rounded-2xl outline-none focus:ring-2 ring-blue-500/20 text-sm border border-zinc-100 font-medium appearance-none"
                  required
                />
              </div>
            </div>

            <div className="mt-4 pt-2">
              <Button
                title="Start Auto Booking"
                loading={loading}
                type="submit"
              />
              <div className="flex items-center justify-center gap-1.5 mt-3 text-zinc-400">
                <div className="w-1 h-1 bg-zinc-300 rounded-full"></div>
                <p className="text-[10px] font-medium leading-none">
                  Triggers booking approx. travel time + 5min buffer.
                </p>
                <div className="w-1 h-1 bg-zinc-300 rounded-full"></div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SaarthiAIModal;
