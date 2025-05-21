
import React from 'react';
import { Stream } from '../types';
import { StreamCard } from './StreamCard';
import { FaceSmileIcon } from './icons'; // For empty state

interface StreamGridProps {
  streams: Stream[];
  onSelectStream: (stream: Stream) => void;
}

export const StreamGrid: React.FC<StreamGridProps> = ({ streams, onSelectStream }) => {
  if (streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 py-16">
        <FaceSmileIcon className="w-24 h-24 mb-4 text-purple-400" />
        <h2 className="text-2xl font-semibold mb-2">No Live Streams Yet</h2>
        <p className="text-lg">Why not start one? Click "Go Live" to begin!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {streams.map((stream) => (
        <StreamCard key={stream.id} stream={stream} onSelectStream={onSelectStream} />
      ))}
    </div>
  );
};
