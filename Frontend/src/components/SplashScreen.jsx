import React from 'react';

const SplashScreen = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F97316] animate-in fade-in duration-700">
      <div className="flex flex-col items-center animate-in zoom-in-95 duration-1000 ease-out text-center">
        <h1 className="text-5xl font-extrabold text-white tracking-widest mb-2 drop-shadow-md">
          SAARTHI
        </h1>
        <p className="text-white text-lg font-medium opacity-90 tracking-wide">
          Your Journey, Our Watch
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
