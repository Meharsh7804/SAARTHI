import React, { useState } from "react";
import { Star } from "lucide-react";

const StarRatingComponent = ({ rating, setRating, label }) => {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-sm font-medium text-zinc-600">{label}</span>}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="focus:outline-none transition-transform active:scale-90"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
          >
            <Star
              size={28}
              className={`transition-colors duration-200 ${
                star <= (hover || rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-zinc-300"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default StarRatingComponent;
