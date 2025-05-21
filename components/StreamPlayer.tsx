
import React, { useEffect, useRef, useState } from 'react';
import { Stream } from '../types';
import { XMarkIcon, SpeakerWaveIcon, SpeakerXMarkIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from './icons';

interface StreamPlayerProps {
  stream: Stream;
  onClose: () => void;
}

export const StreamPlayer: React.FC<StreamPlayerProps> = ({ stream, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false); 
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let isEffectActive = true;
    const videoElement = videoRef.current;

    console.log(`StreamPlayer EFFECT for ${stream.name}: Stream ID ${stream.id}, Is user stream: ${stream.isUserStream}`);
    // Temporary: Add a border for visual debugging of the video element
    if (videoElement) videoElement.style.border = "2px solid red";


    if (videoElement && stream.mediaStream) {
      console.log(`StreamPlayer ${stream.name}: MediaStream exists. Active: ${stream.mediaStream.active}. Tracks: ${stream.mediaStream.getTracks().length}`);
      stream.mediaStream.getTracks().forEach(t => console.log(`  Track kind: ${t.kind}, readyState: ${t.readyState}, enabled: ${t.enabled}, muted: ${t.muted}, id: ${t.id}`));


      if (!stream.mediaStream.active) {
        console.warn(`StreamPlayer: Attempting to use an INACTIVE MediaStream (ID: ${stream.id}, Name: '${stream.name}'). Clearing video source.`);
        if (videoElement.srcObject) {
          videoElement.srcObject = null;
        }
        // Optionally, display an "offline" message to the user in the player
        return; 
      }

      if (videoElement.srcObject !== stream.mediaStream) {
        console.log(`StreamPlayer ${stream.name}: Setting new srcObject.`);
        videoElement.srcObject = stream.mediaStream;
      } else {
        console.log(`StreamPlayer ${stream.name}: srcObject is already set. Ensuring playback.`);
      }
      
      videoElement.muted = isMuted;
      console.log(`StreamPlayer ${stream.name}: Attempting to play. Muted: ${isMuted}`);

      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (isEffectActive) {
            if (error.name === 'AbortError') {
              console.warn(`StreamPlayer: Playback for stream '${stream.name}' (ID: ${stream.id}) was aborted. This can be normal if the stream ended or the player was closed quickly.`);
            } else {
              console.error(`StreamPlayer: Error playing stream '${stream.name}' (ID: ${stream.id}):`, error.name, error.message);
            }
          }
        });
      }
    } else {
        console.warn(`StreamPlayer ${stream.name}: VideoElement or MediaStream missing/invalid. Cannot play.`);
        if (!videoElement) console.warn(`  VideoElement (videoRef.current) is null.`);
        if (!stream.mediaStream) console.warn(`  stream.mediaStream is null or undefined.`);
        else if (!stream.mediaStream.active) console.warn(`  stream.mediaStream is inactive.`);
         // Temporary: border if video element exists but stream is bad
        if (videoElement) videoElement.style.border = "2px solid orange";
    }

    return () => {
      isEffectActive = false;
      if (videoElement) {
        console.log(`StreamPlayer CLEANUP for ${stream.name}: Pausing video.`);
        if (!videoElement.paused) {
          videoElement.pause();
        }
        // videoElement.srcObject = null; // Good practice to release stream resource from element
        videoElement.style.border = "none"; // Cleanup temporary border
      }
    };
  }, [stream, isMuted]);

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !videoRef.current.muted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenEnabled) {
        alert("Fullscreen mode is not supported by your browser or is disabled.");
        return;
    }

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        alert(`Could not enter full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.warn(`Error attempting to exit full-screen mode: ${err.message} (${err.name})`);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange); 
    document.addEventListener('mozfullscreenchange', handleFullscreenChange); 
    document.addEventListener('MSFullscreenChange', handleFullscreenChange); 
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);


  return (
    <div ref={containerRef} className="fixed inset-0 bg-gray-900 bg-opacity-95 backdrop-blur-md flex flex-col items-center justify-center z-50 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="stream-player-title">
      <div className="w-full h-full sm:max-w-4xl md:max-w-5xl lg:max-w-6xl sm:max-h-[85vh] bg-gray-800 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="relative aspect-video bg-black flex-grow">
          <video
            ref={videoRef}
            playsInline
            controls={false} 
            className="w-full h-full object-contain bg-black"
          />
           <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 opacity-100 group-hover:opacity-100">
            <h2 id="stream-player-title" className="text-lg sm:text-xl font-semibold text-white truncate" title={stream.name}>{stream.name}</h2>
            {!stream.mediaStream?.active && videoRef.current?.srcObject && (
                 <p className="text-red-400 text-sm">Stream appears to be offline.</p>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
            <button 
              onClick={toggleMute} 
              className="p-2 text-white hover:text-purple-300 transition-colors rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-400"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <SpeakerXMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : <SpeakerWaveIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
            {document.fullscreenEnabled && (
                <button 
                onClick={toggleFullscreen} 
                className="p-2 text-white hover:text-purple-300 transition-colors rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-400"
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                {isFullscreen ? <ArrowsPointingInIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : <ArrowsPointingOutIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>
            )}
          </div>
        </div>
      </div>
      <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-gray-700 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-all duration-150 ease-in-out hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-400"
          aria-label="Close player"
        >
          <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
    </div>
  );
};
