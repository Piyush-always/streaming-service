import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ModalStep } from '../types';
import { LockClosedIcon, VideoCameraIcon, ArrowPathIcon, WifiIcon, NoSymbolIcon, XMarkIcon } from './icons';

const CORRECT_PASSWORD = "0000";

interface AddStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Updated to accept name and the prepared MediaStream
  onStartStreaming: (name: string, mediaStream: MediaStream) => Promise<void>; 
  userLocalMediaStream: MediaStream | null; // Comes from App.tsx, might be set by modal
  setUserLocalMediaStream: (stream: MediaStream | null) => void; // To update App.tsx's copy
}

export const AddStreamModal: React.FC<AddStreamModalProps> = ({ 
    isOpen, onClose, onStartStreaming, 
    userLocalMediaStream, setUserLocalMediaStream
}) => {
  const [modalStep, setModalStep] = useState<ModalStep>('password');
  const [password, setPassword] = useState('');
  const [streamName, setStreamName] = useState(`User Stream ${Math.floor(Math.random() * 1000)}`);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  // Local state for the media stream created *within* this modal instance.
  const [modalScopedMediaStream, setModalScopedMediaStream] = useState<MediaStream | null>(null);


  const cleanupModalStream = useCallback(() => {
    if (modalScopedMediaStream) {
      modalScopedMediaStream.getTracks().forEach(track => track.stop());
      setModalScopedMediaStream(null);
      setUserLocalMediaStream(null); // Also clear App's reference if it was from here
    }
  }, [modalScopedMediaStream, setUserLocalMediaStream]);

  const resetModalState = useCallback((keepStream = false) => {
    setModalStep('password');
    setPassword('');
    // setStreamName(`User Stream ${Math.floor(Math.random() * 1000)}`); // Keep stream name if trying again
    setError(null);
    setIsLoading(false);
    if (!keepStream) {
      cleanupModalStream();
    }
  }, [cleanupModalStream]);
  
  useEffect(() => {
    if (!isOpen) {
      // Full reset when modal closes, including any preview stream
      resetModalState(false); 
    } else {
      if (modalStep === 'mediaError' && !modalScopedMediaStream) {
         resetModalState(false); 
      } else if (modalStep !== 'password' && !modalScopedMediaStream && !userLocalMediaStream) {
         setModalStep('password'); 
      }
    }
  }, [isOpen, resetModalState, modalStep, modalScopedMediaStream, userLocalMediaStream]);


  useEffect(() => {
    // Use modalScopedMediaStream for preview
    if (modalStep === 'setup' && videoPreviewRef.current && modalScopedMediaStream) {
      videoPreviewRef.current.srcObject = modalScopedMediaStream;
      videoPreviewRef.current.play().catch(e => console.error("Preview play error:", e));
    }
  }, [modalStep, modalScopedMediaStream]);

  const handlePasswordSubmit = async () => {
    setIsLoading(true);
    setError(null);

    if (password === CORRECT_PASSWORD) {
      setModalStep('loadingMedia');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setModalScopedMediaStream(stream); // Set the stream created by this modal
        setUserLocalMediaStream(stream);   // Inform App.tsx about this new stream
        setModalStep('setup');
      } catch (err) {
        console.error("Error accessing media devices:", err);
        let userMessage = "Failed to access camera/microphone. Please check permissions and try again.";
        // ... (error handling as before)
         if (err instanceof DOMException) {
          switch (err.name) {
            case "NotAllowedError": case "PermissionDeniedError":
              userMessage = "Access to camera/microphone was denied. Please check your browser's site permissions.";
              if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                userMessage += " This site is not served over HTTPS, which is required for camera/mic access in most browsers.";
              }
              break;
            default: userMessage = `Error: ${err.name}. ${err.message}`; break;
          }
        } else if (err instanceof Error) { userMessage = err.message; }

        setError(userMessage);
        setModalStep('mediaError');
        cleanupModalStream(); // Clean up if media access failed
      }
    } else {
      setError("Incorrect password. Please try again.");
    }
    setIsLoading(false);
  };

  const handleBroadcast = async () => {
    // Use modalScopedMediaStream as it's the one this modal instance manages for preview
    if (!modalScopedMediaStream || !modalScopedMediaStream.active) {
      setError("Media stream not available or inactive. Cannot start broadcast.");
      setModalStep('mediaError');
      return;
    }
     if (!streamName.trim()) {
        setError("Stream name cannot be empty.");
        return; 
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // Pass the locally managed stream and name to App.tsx
      await onStartStreaming(streamName, modalScopedMediaStream);
      // App.tsx will set its own userLocalMediaStream and handle closing the modal.
      // We don't cleanupModalStream() here because it's now owned by App.tsx
      setModalScopedMediaStream(null); // Modal no longer owns it
      // onClose(); // App.tsx's onStartStreamingFlow is expected to close the modal
    } catch (e: any) {
      console.error("Error during onStartStreaming call:", e);
      setError(e.message || "Failed to start broadcast. Please try again later.");
      setModalStep('mediaError'); // Stay in modal on error
      // Don't cleanup stream here, user might want to retry. Let App handle it if it fails at its level.
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCloseAndCleanup = () => {
    cleanupModalStream(); // Ensure stream from this modal is stopped if modal closed manually
    onClose();
  }


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
          <button onClick={handleCloseAndCleanup} className="text-gray-400 hover:text-white transition-colors" aria-label="Close modal">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* ... (rest of the modal UI: password, loadingMedia, mediaError, setup, broadcasting steps remain largely the same) ... */}
        {/* Make sure to use `modalScopedMediaStream` for the preview video in the 'setup' step */}

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
              onClick={() => { resetModalState(false); /* This will take user back to password step */ }}
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
              {/* Use modalScopedMediaStream for the preview */}
              {modalScopedMediaStream && modalScopedMediaStream.active ? (
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
              disabled={isLoading || !modalScopedMediaStream || !modalScopedMediaStream.active || !streamName.trim()}
            >
              {isLoading ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <WifiIcon className="w-5 h-5 mr-2" />}
              {isLoading ? 'Starting...' : 'Go Live!'}
            </button>
          </form>
        )}
        
        {modalStep === 'broadcasting' && ( // This step might be very brief as App.tsx takes over.
          <div className="flex flex-col items-center justify-center py-8">
            <WifiIcon className="w-12 h-12 text-green-400 animate-pulse mb-4" />
            <p className="text-lg text-gray-300">Connecting to broadcast server...</p>
          </div>
        )}
      </div>
    </div>
  );
};
