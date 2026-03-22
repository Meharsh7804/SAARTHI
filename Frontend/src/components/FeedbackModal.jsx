import React, { useState } from "react";
import StarRatingComponent from "./StarRatingComponent";
import { X, CheckCircle2 } from "lucide-react";
import feedbackService from "../services/feedbackService";

const FeedbackModal = ({ isOpen, onClose, rideId, driverName }) => {
  const [safetyRating, setSafetyRating] = useState(0);
  const [comfortRating, setComfortRating] = useState(0);
  const [behaviorRating, setBehaviorRating] = useState(0);
  const [rideAgain, setRideAgain] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await feedbackService.submitFeedback({
        rideId,
        safetyRating,
        comfortRating,
        behaviorRating,
        rideAgain,
      });
      setIsSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = safetyRating > 0 && comfortRating > 0 && behaviorRating > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[28px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        {!isSubmitted ? (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-zinc-900">Rate Your Ride</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X size={20} className="text-zinc-500" />
              </button>
            </div>

            <p className="text-zinc-600 mb-8">
              How was your experience with <span className="font-semibold text-black">{driverName}</span>?
            </p>

            <form onSubmit={handleSubmit} className="space-y-8">
              <StarRatingComponent
                label="How safe did you feel during the ride?"
                rating={safetyRating}
                setRating={setSafetyRating}
              />
              <StarRatingComponent
                label="How comfortable was the ride?"
                rating={comfortRating}
                setRating={setComfortRating}
              />
              <StarRatingComponent
                label="Driver's behavior?"
                rating={behaviorRating}
                setRating={setBehaviorRating}
              />

              <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 transition-all hover:bg-zinc-100/50">
                <input
                  type="checkbox"
                  id="rideAgain"
                  checked={rideAgain}
                  onChange={(e) => setRideAgain(e.target.checked)}
                  className="w-5 h-5 rounded border-zinc-300 text-black focus:ring-black cursor-pointer"
                />
                <label htmlFor="rideAgain" className="text-sm font-medium text-zinc-700 cursor-pointer">
                  Would you like to ride with this driver again?
                </label>
              </div>

              {error && (
                <p className="text-red-500 text-sm font-medium animate-in slide-in-from-top-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] ${
                  isFormValid && !isSubmitting
                    ? "bg-black text-white shadow-lg shadow-black/20 hover:bg-zinc-800"
                    : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                }`}
              >
                {isSubmitting ? (
                   <div className="flex items-center justify-center gap-2">
                     <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                     Submitting...
                   </div>
                ) : (
                  "Submit Feedback"
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="p-12 text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-green-600 animate-in zoom-in-50 duration-300 delay-150" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 mb-2">Thank You!</h3>
            <p className="text-zinc-600">Your feedback helps us improve your Saarthi experience.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;
