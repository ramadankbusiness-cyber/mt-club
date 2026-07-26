const LoadingPage = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center
      bg-[#025749]/50 backdrop-blur-lg"> {/* هنا الخلفية بلور */}
      
      {/* Decorative Background Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
        w-64 h-64 bg-[#00ACC1]/20 rounded-full blur-3xl animate-pulse"></div>
      
      <div className="relative flex flex-col items-center">
        {/* The Spinner */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-[#00ACC1]/30 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-[#00ACC1] rounded-full border-t-transparent animate-spin"></div>
        </div>

        {/* Loading Text */}
        <h2 className="mt-8 text-xl font-semibold text-white tracking-tight">
          Optimizing your experience
        </h2>
        <p className="mt-2 text-white/70 animate-pulse">
          Please wait a moment...
        </p>
      </div>
    </div>
  );
};

export default LoadingPage;