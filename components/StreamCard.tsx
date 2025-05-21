
import React, { useEffect, useRef } from 'react';
import { Stream } from '../types';
import { PlayCircleIcon, UserCircleIcon } from './icons';

interface StreamCardProps {
  stream: Stream;
  onSelectStream: (stream: Stream) => void;
}

export const StreamCard: React.FC<StreamCardProps> = ({ stream, onSelectStream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && stream.mediaStream) {
      console.log(`StreamCard ${stream.name} (ID: ${stream.id}): Setting up preview. MediaStream active: ${stream.mediaStream.active}`);
      if (!stream.mediaStream.active) {
        console.warn(`StreamCard ${stream.name}: MediaStream is INACTIVE. Preview may not work.`);
      }
      
      if (videoElement.srcObject !== stream.mediaStream) {
        videoElement.srcObject = stream.mediaStream;
      }
      
      videoElement.play().catch(error => {
        console.warn(`StreamCard ${stream.name} (ID: ${stream.id}) autoplay failed:`, error.name, error.message);
      });
    } else {
      if (!videoElement) console.error(`StreamCard ${stream.name}: videoRef.current is null.`);
      if (!stream.mediaStream) console.warn(`StreamCard ${stream.name}: stream.mediaStream is null or undefined.`);
    }
  }, [stream]);

  const handleCardClick = () => {
    if (stream.mediaStream && !stream.mediaStream.active) {
      console.warn(`StreamCard ${stream.name} (ID: ${stream.id}): Clicked on card, but MediaStream is inactive. Notifying parent to potentially remove.`);
    }
    onSelectStream(stream);
  };

  return (
    <div 
      className="bg-gray-800 rounded-lg shadow-xl overflow-hidden cursor-pointer transition-all duration-300 ease-in-out hover:shadow-2xl hover:scale-105 group"
      onClick={handleCardClick}
      aria-label={`Play stream: ${stream.name}`}
    >
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          muted
          playsInline // Important for iOS
          className="w-full h-full object-cover"
          aria-hidden="true" // Decorative, info is in text content
        />
        <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-0 transition-opacity duration-300 flex items-center justify-center">
           <PlayCircleIcon className="w-16 h-16 text-white opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
        </div>
         {stream.isUserStream && (
            <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded z-10">
              YOU
            </span>
          )}
          {!stream.mediaStream?.active && (
             <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
                <p className="text-white text-sm font-semibold">Stream Offline</p>
            </div>
          )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold truncate text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-400" title={stream.name}>
          {stream.name}
        </h3>
        {!stream.isUserStream && (
          <div className="flex items-center mt-2 text-sm text-gray-400">
            <UserCircleIcon className="w-4 h-4 mr-1 text-purple-400" />
            <span>Anonymous Streamer</span>
          </div>
        )}
      </div>
    </div>
  );
};