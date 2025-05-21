
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ModalStep } from '../types';
import { LockClosedIcon, VideoCameraIcon, ArrowPathIcon, WifiIcon, NoSymbolIcon, XMarkIcon } from './icons';

const CORRECT_PASSWORD = "0000";

interface AddStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartStreaming: (name: string, mediaStream?: MediaStream) => Promise<void>;
  userLocalMediaStream: MediaStream | null;
  setUserLocalMediaStream: (stream: MediaStream | null) => void;
}

export const AddStreamModal: React.FC<AddStreamModalProps> = ({ 
    isOpen, onClose, onStartStreaming, 
    userLocalMediaStream, setUserLocalMediaStream
}) => {
  const [modalStep, setModalStep] = useState<ModalStep>('password');
  const [password, setPassword] = useState('');
  const [streamName, setStreamName] = useState('My Awesome Stream');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const resetModalState = useCallback(() => {
    setModalStep('password');
    setPassword('');
    setStreamName('My Awesome Stream');
    setError(null);
    setIsLoading(false);
    if (userLocalMediaStream) {
      userLocalMediaStream.getTracks().forEach(track => track.stop());
      setUserLocalMediaStream(null);
    }
  }, [userLocalMediaStream, setUserLocalMediaStream]);
  
  useEffect(() => {
    if (!isOpen) {
      resetModalState();
    } else {
      // When modal opens, reset to password step if not already there or if coming from an error.
      // This ensures a clean start unless specific state needs to be preserved.
      if (modalStep === 'mediaError') {
         resetModalState(); // Full reset from mediaError
      } else if (modalStep !== 'password' && !userLocalMediaStream) {
         // If modal was somehow left in 'setup' but stream is gone, reset.
         setModalStep('password'); 
      }
    }
  }, [isOpen, resetModalState, modalStep, userLocalMediaStream]);


  useEffect(() => {
    if (modalStep === 'setup' && videoPreviewRef.current && userLocalMediaStream) {
      videoPreviewRef.current.srcObject = userLocalMediaStream;
      videoPreviewRef.current.play().catch(e => console.error("Preview play error:", e));
    }
  }, [modalStep, userLocalMediaStream]);

  const handlePasswordSubmit = async () => {
    setIsLoading(true);
    setError(null);
    // Simulate a short delay for UX, remove if password check is instant
    // await new Promise(resolve => setTimeout(resolve, 500));

    if (password === CORRECT_PASSWORD) {
      setModalStep('loadingMedia');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setUserLocalMediaStream(stream);
        setModalStep('setup');
      } catch (err) {
        console.error("Error accessing media devices:", err);
        let userMessage = "Failed to access camera/microphone. Please check permissions and try again.";
        
        if (err instanceof DOMException) {
          switch (err.name) {
            case "NotAllowedError":
            case "PermissionDeniedError":
              userMessage = "Access to camera/microphone was denied. Please check your browser's site permissions for this page and ensure you've allowed access.";
              if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && 
                  window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                userMessage += " This often happens on sites not served over HTTPS. Please ensure you are on a secure connection (https://).";
              }
              break;
            case "NotFoundError":
            case "DevicesNotFoundError":
              userMessage = "No camera or microphone found. Please ensure they are connected and enabled.";
              break;
            case "NotReadableError":
            case "TrackStartError":
              userMessage = "Your camera or microphone might be in use by another application, or a hardware error occurred making it unreadable.";
              break;
            case "SecurityError":
              userMessage = "Access to camera/microphone is blocked due to security settings in your browser or system.";
              if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && 
                  window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                userMessage += " This commonly occurs when the page is not served over a secure connection (HTTPS). Please use HTTPS or localhost.";
              }
              break;
            case "AbortError":
              userMessage = "Media request was aborted, possibly due to a configuration change or navigation.";
              break;
            case "OverconstrainedError":
              userMessage = `The requested media settings (e.g., resolution) are not supported by your device. Error: ${err.message}`;
              break;
            case "TypeError":
               userMessage = "Media request failed due to invalid constraints or no media requested. Ensure video/audio are requested.";
               break;
            default:
              userMessage = `Failed to access camera/microphone: ${err.name} - ${err.message}. Please check permissions. If not on HTTPS or localhost, that could be an issue.`;
          }
        } else if (err instanceof Error) {
             userMessage = `An unexpected error occurred: ${err.message}`;
        }
        
        setError(userMessage);
        setModalStep('mediaError');
      }
    } else {
      setError("Incorrect password. Please try again.");
    }
    setIsLoading(false);
  };

  const handleBroadcast = async () => {
    if (!userLocalMediaStream) {
      setError("Media stream not available. Cannot start broadcast.");
      // Fix: Corrected typo from setModal to setModalStep
      setModalStep('mediaError');
      return;
    }
     if (!streamName.trim()) {
        setError("Stream name cannot be empty.");
        return; // Stay on setup step to show error
    }

    setIsLoading(true);
    setError(null);
    // setModalStep('broadcasting'); // Optionally show a "broadcasting..." step

    try {
      await onStartStreaming(streamName, userLocalMediaStream);
      // onClose(); // App.tsx's onStartStreaming handles closing the modal, which triggers resetModalState.
    } catch (e) {
      console.error("Error during onStartStreaming call:", e);
      setError("Failed to start broadcast. Please try again later.");
      setModalStep('mediaError');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
         role="dialog" aria-modal="true" aria-labelledby="add-stream-modal-title">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md text-white">
        <div className="flex justify-between items-center mb-6">
          <h2 id="add-stream-modal-title" className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            {modalStep === 'password' && 'Enter Password'}
            {modalStep === 'loadingMedia' && 'Accessing Media'}
            {modalStep === 'setup' && 'Setup Your Stream'}
            {modalStep === 'mediaError' && 'Error Occurred'}
            {modalStep === 'broadcasting' && 'Starting Stream...'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close modal">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {error && modalStep !== 'mediaError' && modalStep !== 'password' && (
          <div className="mb-4 p-3 bg-red-500 bg-opacity-20 text-red-300 rounded-md">
            <p>{error}</p>
          </div>
        )}

        {modalStep === 'password' && (
          <form onSubmit={(e) => { e.preventDefault(); handlePasswordSubmit(); }}>
            <p className="mb-4 text-gray-300">Enter the password to start a new stream.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full p-3 bg-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 outline-none mb-4"
              disabled={isLoading}
              autoFocus
            />
            {error && ( // Specific error for password incorrect
                <p className="text-red-400 mb-4">{error}</p>
            )}
            <button 
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={isLoading || !password}
            >
              {isLoading ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <LockClosedIcon className="w-5 h-5 mr-2" />}
              {isLoading ? 'Verifying...' : 'Unlock'}
            </button>
          </form>
        )}

        {modalStep === 'loadingMedia' && (
          <div className="flex flex-col items-center justify-center py-8">
            <ArrowPathIcon className="w-12 h-12 text-purple-400 animate-spin mb-4" />
            <p className="text-lg text-gray-300">Accessing your camera and microphone...</p>
            <p className="text-sm text-gray-400 mt-2">Please grant permission if prompted.</p>
          </div>
        )}

        {modalStep === 'mediaError' && (
          <div className="text-center">
            <NoSymbolIcon className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <p className="text-xl font-semibold text-red-300 mb-3">Media Access Failed</p>
            <p className="text-gray-300 mb-6 whitespace-pre-wrap text-sm">{error || "An unknown error occurred."}</p>
            <button
              onClick={() => { resetModalState(); /* This will take user back to password step */ }}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {modalStep === 'setup' && (
          <form onSubmit={(e) => { e.preventDefault(); handleBroadcast(); }}>
            <div className="mb-4">
              <label htmlFor="streamName" className="block text-sm font-medium text-gray-300 mb-1">Stream Name</label>
              <input
                id="streamName"
                type="text"
                value={streamName}
                onChange={(e) => setStreamName(e.target.value)}
                placeholder="My Awesome Stream"
                className="w-full p-3 bg-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                disabled={isLoading}
                autoFocus
              />
            </div>
            
            <div className="mb-4 aspect-video bg-black rounded-md overflow-hidden">
              {userLocalMediaStream && userLocalMediaStream.active ? (
                <video ref={videoPreviewRef} muted playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-700">
                  <VideoCameraIcon className="w-10 h-10 mb-2" />
                  <span>Preview not available</span>
                  <span className="text-xs">Check camera permissions or connection</span>
                </div>
              )}
            </div>
            {error && (
                <p className="text-red-400 mb-4">{error}</p>
            )}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={isLoading || !userLocalMediaStream || !userLocalMediaStream.active || !streamName.trim()}
            >
              {isLoading ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <WifiIcon className="w-5 h-5 mr-2" />}
              {isLoading ? 'Starting...' : 'Go Live!'}
            </button>
          </form>
        )}
        
        {modalStep === 'broadcasting' && (
          <div className="flex flex-col items-center justify-center py-8">
            <WifiIcon className="w-12 h-12 text-green-400 animate-pulse mb-4" />
            <p className="text-lg text-gray-300">Broadcasting your stream...</p>
          </div>
        )}
      </div>
    </div>
  );
};
