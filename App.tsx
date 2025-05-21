import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StreamGrid } from './components/StreamGrid';
import { StreamPlayer } from './components/StreamPlayer';
import { AddStreamModal } from './components/AddStreamModal';
import { Stream } from './types';

const App: React.FC = () => {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  
  const [isUserStreaming, setIsUserStreaming] = useState<boolean>(false);
  const [currentUserStreamId, setCurrentUserStreamId] = useState<string | null>(null);
  const [userLocalMediaStream, setUserLocalMediaStream] = useState<MediaStream | null>(null);

  const handleOpenModal = () => setIsModalOpen(true);
  
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    if (userLocalMediaStream) {
      console.log("handleCloseModal: Stopping userLocalMediaStream as modal is closing without broadcast completion.");
      userLocalMediaStream.getTracks().forEach(track => track.stop());
      setUserLocalMediaStream(null); 
    }
  }, [userLocalMediaStream, setUserLocalMediaStream]);

  const handleStartStreaming = useCallback(async (name: string, mediaStream?: MediaStream) => {
    if (!mediaStream || !mediaStream.active) {
      console.error("No active media stream provided to start streaming. Aborting.");
      if (mediaStream === userLocalMediaStream && userLocalMediaStream) {
         userLocalMediaStream.getTracks().forEach(track => track.stop());
         setUserLocalMediaStream(null);
      }
      setIsModalOpen(false); 
      return;
    }
    
    const newStreamId = `stream-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
    const newStream: Stream = {
      id: newStreamId,
      name: name, // User-defined name is the final name
      mediaStream: mediaStream, 
      isUserStream: true,
    };
    
    console.log(`App: Starting stream ${newStream.name} (ID: ${newStream.id}). MediaStream active: ${newStream.mediaStream.active}`);

    setStreams(prev => [...prev, newStream]);
    setIsUserStreaming(true);
    setCurrentUserStreamId(newStreamId);
    
    setUserLocalMediaStream(null); 
    
    setIsModalOpen(false); 
  }, [setIsModalOpen, setUserLocalMediaStream, userLocalMediaStream]);


  const handleStopStreaming = useCallback(() => {
    if (!currentUserStreamId) return;

    const streamToStop = streams.find(s => s.id === currentUserStreamId);
    if (streamToStop) {
      console.log(`App: Stopping user stream ${streamToStop.name} (ID: ${streamToStop.id}). MediaStream active before stop: ${streamToStop.mediaStream.active}`);
      streamToStop.mediaStream.getTracks().forEach(track => track.stop());
    }

    setStreams(prev => prev.filter(s => s.id !== currentUserStreamId));
    setIsUserStreaming(false);
    setCurrentUserStreamId(null);
    if (selectedStream?.id === currentUserStreamId) {
      setSelectedStream(null);
    }
  }, [currentUserStreamId, streams, selectedStream]);

  const handleSelectStream = (stream: Stream) => {
    if (!stream.mediaStream.active) {
        console.warn(`App: Attempted to select stream ${stream.name} (ID: ${stream.id}) but its MediaStream is inactive. Removing from list.`);
        setStreams(prev => prev.filter(s => s.id !== stream.id));
        setSelectedStream(null);
        return;
    }
    setSelectedStream(stream);
  };

  const handleClosePlayer = () => {
    setSelectedStream(null);
  };
  
  useEffect(() => {
    return () => {
      console.log("App component unmounting. Stopping all streams.");
      streams.forEach(stream => {
        if (stream.mediaStream && stream.mediaStream.active) {
          stream.mediaStream.getTracks().forEach(track => track.stop());
        }
      });
      if (userLocalMediaStream && userLocalMediaStream.active) { 
         userLocalMediaStream.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <Header
        onAddStreamClick={handleOpenModal}
        isUserStreaming={isUserStreaming}
        onStopStreamClick={handleStopStreaming}
      />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {selectedStream ? (
          <StreamPlayer stream={selectedStream} onClose={handleClosePlayer} />
        ) : (
          <StreamGrid streams={streams} onSelectStream={handleSelectStream} />
        )}
      </main>
      {isModalOpen && (
        <AddStreamModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onStartStreaming={handleStartStreaming}
          userLocalMediaStream={userLocalMediaStream}
          setUserLocalMediaStream={setUserLocalMediaStream}
        />
      )}
      <footer className="text-center p-4 text-sm text-gray-500">
        StreamHub &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default App;