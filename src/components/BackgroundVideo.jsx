import React from 'react';

export default function BackgroundVideo({
  url,
  videoUrl,
  mobileVideoUrl,
  className = '',
  onReady,
  poster,
}) {
  const defaultSrc = videoUrl || url;
  const mobileSrc = mobileVideoUrl;

  if (!defaultSrc && !mobileSrc) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`bg-black min-h-screen relative overflow-hidden z-[-1] ${className}`}
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        poster={poster}
        onLoadedData={onReady}
        className="absolute top-0 left-0 w-full aspect-[16/9] object-cover object-center md:inset-0 md:w-full md:h-full md:aspect-auto"
      >
        {mobileSrc && (
          <source media="(max-width: 767px)" src={mobileSrc} type="video/mp4" />
        )}
        {defaultSrc && (
          <source src={defaultSrc} type="video/mp4" />
        )}
      </video>

      <div
        className="absolute top-0 left-0 w-full aspect-[16/9] bg-gradient-to-b from-transparent to-black pointer-events-none md:inset-0 md:w-full md:h-full md:aspect-auto"
      />
    </div>
  );
}
