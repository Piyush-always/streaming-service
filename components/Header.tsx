
import React from 'react';
import { VideoCameraIcon, StopCircleIcon } from './icons'; // Assuming icons.tsx will have StopCircleIcon

interface HeaderProps {
  onAddStreamClick: () => void;
  isUserStreaming: boolean;
  onStopStreamClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onAddStreamClick, isUserStreaming, onStopStreamClick }) => {
  return (
    <header className="bg-gray-800 shadow-lg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
          StreamHub
        </h1>
        {isUserStreaming ? (
          <button
            onClick={onStopStreamClick}
            className="flex items-center bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75"
          >
            <StopCircleIcon className="w-5 h-5 mr-2" />
            Stop My Stream
          </button>
        ) : (
          <button
            onClick={onAddStreamClick}
            className="flex items-center bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75"
          >
            <VideoCameraIcon className="w-5 h-5 mr-2" />
            Go Live
          </button>
        )}
      </div>
    </header>
  );
};
