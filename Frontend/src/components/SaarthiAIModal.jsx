import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, MapPin, Sparkles, Brain, Keyboard, ArrowRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

import Button from './Button';
import LocationSuggestions from './LocationSuggestions';
import axios from 'axios';

/**
 * ============================================================
 * SaarthiAIModal – Enhanced with Agentic NLP Prompt Tab
 * ============================================================
 * Two tabs:
 *   1. "AI Prompt"  →  Type natural language, AI extracts everything
 *   2. "Manual"     →  Original manual pickup/destination/time inputs
 * ============================================================
 */

const SaarthiAIModal = ({ isOpen, onClose, onStartAutoBooking, loading: parentLoading, suggestions, onLocationChange, setSuggestions }) => {
  const [activeTab, setActiveTab] = useState("ai");  // "ai" | "manual"

  // ── Manual tab state (original) ─────────────────────────
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [activeField, setActiveField] = useState(null);

  // ── AI Prompt tab state ─────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [aiPickup, setAiPickup] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState("");
  const [aiStep, setAiStep] = useState("input"); // "input" | "loading" | "result" | "error"
  const [currentReasoningIndex, setCurrentReasoningIndex] = useState(-1);
  const [deferredResult, setDeferredResult] = useState(null);

  const SIMULATED_STEPS = [
    "Understanding your request...",
    "Extracting destination and time...",
    "Analyzing traffic conditions...",
    "Checking weather...",
    "Choosing best route...",
    "Finalizing plan..."
  ];

  // Reset on open/close
  const token = localStorage.getItem("token");

  // ── AI Prompt: Get current location as pickup ──────────
  const getCurrentLocationText = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            setAiPickup(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          } catch {
            setAiPickup("Current Location");
          }
        },
        () => setAiPickup("Current Location")
      );
    }
  };

  // All hooks MUST be above the early return
  useEffect(() => {
    if (isOpen) {
      setAiStep("input");
      setAiResult(null);
      setAiError("");
      setCurrentReasoningIndex(-1);
      setDeferredResult(null);
    }
  }, [isOpen]);

  // Handle thinking simulation intervals
  useEffect(() => {
    let interval;
    if (aiStep === "loading" && currentReasoningIndex < SIMULATED_STEPS.length - 1) {
      // 300-800ms random delay as requested
      const delay = Math.floor(Math.random() * 500) + 300; 
      interval = setTimeout(() => {
        setCurrentReasoningIndex(prev => prev + 1);
      }, delay);
    }
    return () => clearTimeout(interval);
  }, [aiStep, currentReasoningIndex]);

  // Handle transitioning to result only when both API and animation are done
  useEffect(() => {
    if (aiStep === "loading" && currentReasoningIndex === SIMULATED_STEPS.length - 1 && deferredResult) {
      if (deferredResult.error) {
        const err = deferredResult.error;
        const msg = err.response?.data?.message || err.message || "Something went wrong";
        if (err.response?.data?.message && err.response?.data?.extracted) {
          setAiResult(err.response.data);
          setAiStep("result"); // Vague intent scenario is actually a result
        } else {
          setAiError(msg);
          setAiStep("error");
        }
      } else {
        setAiResult(deferredResult.data);
        setAiStep("result");
      }
      setAiLoading(false);
    }
  }, [aiStep, currentReasoningIndex, deferredResult]);

  useEffect(() => {
    if (isOpen && !aiPickup) {
      getCurrentLocationText();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ── AI Prompt: Submit to backend ───────────────────────
  const handleAISubmit = async () => {
    if (!prompt.trim()) return;

    const effectivePickup = aiPickup.trim() || "Current Location";

    setAiStep("loading");
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    setCurrentReasoningIndex(0);
    setDeferredResult(null);

    console.log("[Saarthi AI] Sending prompt:", prompt);

    let fetchedData = null;
    let fetchError = null;

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_SERVER_URL}/ai/extract-and-plan`,
        { prompt: prompt.trim(), pickup: effectivePickup },
        { headers: { token } }
      );

      if (response.data.success || response.data.isUsualRide) {
        console.log("[Saarthi AI] AI Response Received:", response.data);
        fetchedData = response.data;
      } else {
        fetchError = new Error(response.data.message || "Unknown error");
      }
    } catch (err) {
      fetchError = err;
    }

    setDeferredResult({ data: fetchedData, error: fetchError });
  };

  // ── AI Prompt: Confirm and start auto-booking ──────────
  const handleAIConfirm = () => {
    if (!aiResult) return;

    console.log("[Saarthi AI] Booking scheduled at:", aiResult.plan.bookingTimeFormatted);
    console.log("[Saarthi AI] Ride auto-triggered");

    const bookingData = {
      pickup: aiResult.plan.pickup,
      destination: aiResult.plan.destination,
      arrivalTime: aiResult.plan.arrivalTimeFormatted,
      bookingTime: aiResult.plan.bookingTime,
      recurrence: aiResult.plan.recurrence
    };

    // If bookNow, trigger immediately via the existing flow
    if (aiResult.plan.bookNow) {
      onStartAutoBooking({
        pickup: aiResult.plan.pickup,
        destination: aiResult.plan.destination,
        arrivalTime: new Date(aiResult.plan.arrivalTime).toTimeString().slice(0, 5),
      });
    } else {
      onStartAutoBooking({
        pickup: aiResult.plan.pickup,
        destination: aiResult.plan.destination,
        arrivalTime: new Date(aiResult.plan.arrivalTime).toTimeString().slice(0, 5),
      });
    }
  };

  // ── Manual tab: Submit handler (original logic) ────────
  const handleManualSubmit = (e) => {
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

  // ── RENDER ─────────────────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-[32px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] flex flex-col max-h-[90vh] z-10 border border-white/20"
          >
            {/* Header */}
            <div className="p-6 pb-0">

          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg shadow-blue-500/20">
                <Sparkles className="text-white" size={20} />
              </div>
              <h2 className="text-xl font-bold">Saarthi AI</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-zinc-100 rounded-2xl p-1 mb-4">
            <button
              onClick={() => setActiveTab("ai")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                activeTab === "ai" 
                  ? "bg-white shadow-sm text-blue-600" 
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <Brain size={14} />
              AI Prompt
            </button>
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                activeTab === "manual" 
                  ? "bg-white shadow-sm text-blue-600" 
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <Keyboard size={14} />
              Manual
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            
            {activeTab === 'ai' && (
              <motion.div 
                key="ai-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="px-6 pb-6"
              >
              
              {aiStep === "input" && (
                <>
                  <p className="text-sm text-zinc-500 mb-4 font-medium leading-relaxed">
                    Tell Saarthi where and when you want to go — in any language. Our AI will understand your request and book the ride automatically.
                  </p>

                  {/* Pickup override */}
                  <div className="mb-3">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block ml-1">
                      Your Pickup Location
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center bg-green-50 rounded-lg">
                        <MapPin size={14} className="text-green-600" />
                      </div>
                      <input
                        type="text"
                        value={aiPickup}
                        onChange={(e) => setAiPickup(e.target.value)}
                        placeholder="Current Location"
                        className="w-full bg-zinc-50 pl-12 pr-4 py-3 rounded-xl outline-none focus:ring-2 ring-blue-500/20 text-sm border border-zinc-100 font-medium"
                      />
                    </div>
                  </div>

                  {/* NLP Prompt */}
                  <div className="mb-4">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block ml-1">
                      Tell Saarthi your plan
                    </label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g. Mujhe 9:30 baje Sitabuldi jana hai"
                      rows={3}
                      className="w-full bg-zinc-50 px-4 py-3 rounded-xl outline-none focus:ring-2 ring-blue-500/20 text-sm border border-zinc-100 font-medium resize-none"
                    />
                  </div>

                  {/* Sample prompts */}
                  <div className="mb-4">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2">Try saying:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Mujhe 9:30 baje Sitabuldi jana hai",
                        "Reach Civil Lines at 10 AM",
                        "Airport 5:50 tak pahuchna hai",
                      ].map((sample) => (
                        <button
                          key={sample}
                          onClick={() => setPrompt(sample)}
                          className="text-[10px] px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-full font-medium hover:bg-blue-100 transition-colors"
                        >
                          {sample}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleAISubmit}
                    disabled={!prompt.trim()}
                    className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
                      prompt.trim()
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.98]"
                        : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                    }`}
                  >
                    <Brain size={16} />
                    Use Saarthi AI
                  </button>
                </>
              )}

              {aiStep === "loading" && (
                <div className="flex flex-col py-6 gap-6 min-h-[220px]">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center animate-pulse">
                        <Brain size={28} className="text-white" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-lg">
                        <Loader2 size={14} className="text-blue-600 animate-spin" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-900 text-lg">Thinking...</h3>
                      <p className="text-xs text-zinc-500 font-medium">Saarthi is building your plan</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pl-2">
                    {SIMULATED_STEPS.map((stepText, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-center gap-3 transition-opacity duration-300 ${
                          idx <= currentReasoningIndex ? "opacity-100" : "opacity-0 hidden"
                        }`}
                      >
                        {idx < currentReasoningIndex ? (
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                        ) : (
                          <Loader2 size={16} className="text-blue-500 animate-spin flex-shrink-0" />
                        )}
                        <span className={`text-sm font-medium ${idx < currentReasoningIndex ? "text-zinc-700" : "text-blue-700 font-bold"}`}>
                          {stepText}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiStep === "result" && aiResult && (
                <div className="space-y-4">
                  {aiResult.isUsualRide ? (
                    <>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={18} className="text-emerald-600" />
                          <h3 className="font-bold text-emerald-900">Habit Detected</h3>
                        </div>
                        <p className="text-sm font-medium text-emerald-800 leading-relaxed">
                          {aiResult.agentMessage}
                        </p>
                      </div>
                      
                      <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">Pickup Location</p>
                        <p className="text-sm font-bold text-zinc-900 mb-1 truncate">{aiResult.usualRideData.pickup}</p>
                        
                        <div className="h-6 border-l-2 ml-1.5 my-1 border-dashed border-zinc-200"></div>
                        
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">Destination</p>
                        <p className="text-sm font-bold text-zinc-900 truncate">{aiResult.usualRideData.destination}</p>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => { setAiStep("input"); setAiResult(null); }}
                          className="flex-1 py-3.5 rounded-2xl bg-zinc-100 text-zinc-700 font-bold text-sm hover:bg-zinc-200 transition-colors"
                        >
                          Different Ride
                        </button>
                        <button
                          onClick={() => {
                            const time = new Date(Date.now() + 30 * 60000).toTimeString().slice(0, 5); // Default +30m
                            onStartAutoBooking({ 
                              pickup: aiResult.usualRideData.pickup, 
                              destination: aiResult.usualRideData.destination, 
                              arrivalTime: time 
                            });
                          }}
                          className="flex-[2] py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all"
                        >
                          Yes, Book Now
                        </button>
                      </div>
                    </>
                  ) : aiResult.plan ? (
                    <>
                      {/* Success badge */}
                      <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl p-3">
                        <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                        <p className="text-xs font-bold text-green-800">AI understood your request!</p>
                      </div>

                      {/* Extracted data */}
                      <div className="bg-zinc-50 rounded-2xl p-4 space-y-3 border border-zinc-100">
                        {aiResult.plan.destination && aiResult.plan.originalDestinationQuery && aiResult.plan.destination !== aiResult.plan.originalDestinationQuery ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">AI Detected</span>
                              <span className="text-sm font-bold text-zinc-900 text-right">{aiResult.plan.originalDestinationQuery}</span>
                            </div>
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Matched Location</span>
                              <span className="text-sm font-bold text-violet-600 text-right max-w-[200px] truncate">{aiResult.plan.destination.split(',')[0]}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Destination</span>
                            <span className="text-sm font-bold text-zinc-900 truncate max-w-[200px] text-right">{aiResult.plan.destination || aiResult.extracted.drop}</span>
                          </div>
                        )}
                        
                        {aiResult.agentInfo?.message && (
                          <>
                            <div className="h-px bg-zinc-200" />
                            <div className="flex justify-between items-start gap-4">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pt-0.5 whitespace-nowrap">Agent Insight</span>
                              <span className="text-xs font-semibold text-blue-700 text-right leading-relaxed bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">{aiResult.agentInfo.message}</span>
                            </div>
                          </>
                        )}

                        <div className="h-px bg-zinc-200" />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Arrival Time</span>
                          <div className="flex items-center gap-2">
                            {aiResult.plan.recurrence === "DAILY" && (
                              <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-md animate-pulse">DAILY</span>
                            )}
                            <span className="text-sm font-bold text-zinc-900">{aiResult.plan.arrivalTimeFormatted}</span>
                          </div>
                        </div>
                        <div className="h-px bg-zinc-200" />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Travel Time</span>
                          <span className="text-sm font-bold text-zinc-900">{aiResult.plan.travelTimeMinutes} min</span>
                        </div>
                        <div className="h-px bg-zinc-200" />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ride Booking At</span>
                          <span className="text-sm font-extrabold text-blue-600">{aiResult.plan.bookingTimeFormatted}</span>
                        </div>
                        <div className="h-px bg-zinc-200" />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">AI Source</span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            aiResult.extracted?.source === "ner" 
                              ? "bg-purple-100 text-purple-700" 
                              : "bg-orange-100 text-orange-700"
                          }`}>
                            {aiResult.extracted?.source === "ner" ? "spaCy NER" : "Transformer"}
                          </span>
                        </div>
                      </div>

                      {aiResult.plan.bookNow && (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
                          <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800 font-medium">
                            Booking time has already passed — ride will be booked <strong>immediately</strong>.
                          </p>
                        </div>
                      )}

                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col gap-2">
                          <div className="flex justify-between items-center w-full">
                             <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">AI Recommendation</span>
                             <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-700">
                               {aiResult.plan.routeType?.toUpperCase() || "OPTIMAL"} ROUTE
                             </span>
                          </div>
                          <p className="text-sm font-medium text-indigo-900 leading-relaxed">
                            {aiResult.agentInfo?.message || "I found the best route for you."}
                          </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => { setAiStep("input"); setAiResult(null); setCurrentReasoningIndex(-1); }}
                          className="flex-1 py-3 rounded-2xl bg-zinc-100 text-zinc-700 font-bold text-sm hover:bg-zinc-200 transition-colors"
                        >
                          Try Again
                        </button>
                        <button
                          onClick={handleAIConfirm}
                          className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.98] transition-all"
                        >
                          Confirm & Book
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
                        <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
                        <p className="text-xs font-bold text-amber-800">Clarification Needed</p>
                      </div>
                      <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <p className="text-sm font-medium text-zinc-800 leading-relaxed">
                          {aiResult.message}
                        </p>
                        {aiResult.extracted?.drop && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">Extracted Location</p>
                            <p className="text-sm font-bold text-zinc-900 truncate">{aiResult.extracted.drop}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => { setAiStep("input"); setAiResult(null); setCurrentReasoningIndex(-1); }}
                          className="w-full py-3.5 rounded-2xl bg-zinc-100 text-zinc-700 font-bold text-sm hover:bg-zinc-200 transition-colors"
                        >
                          Try Again
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {aiStep === "error" && (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                    <AlertCircle size={28} className="text-red-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-zinc-900 mb-1">Could not understand your request</p>
                    <p className="text-xs text-zinc-500 max-w-xs">{aiError}</p>
                  </div>
                  <button
                    onClick={() => setAiStep("input")}
                    className="px-6 py-2.5 rounded-xl bg-zinc-100 text-zinc-700 font-bold text-sm hover:bg-zinc-200 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
              </motion.div>
            )}

            {activeTab === "manual" && (
              <motion.div 
                key="manual-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="px-6 pb-6"
              >
              <p className="text-sm text-zinc-500 mb-6 font-medium">
                Enter your trip details and desired arrival time. Saarthi AI will automatically book your ride at the perfect moment.
              </p>

              <form onSubmit={handleManualSubmit} className="space-y-4 flex flex-col">
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
                    loading={parentLoading}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
      )}
    </AnimatePresence>
  );
};


export default SaarthiAIModal;
