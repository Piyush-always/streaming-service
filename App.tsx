
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { StreamGrid } from './components/StreamGrid';
import { StreamPlayer } from './components/StreamPlayer';
import { AddStreamModal } from './components/AddStreamModal';
import { Stream, PeerConnectionContext, SignalMessage, ClientSignalMessage } from './types';
import { signalingService } from './services/signalingService';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]; // Public STUN server

const App: React.FC = () => {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [userLocalMediaStream, setUserLocalMediaStream] = useState<MediaStream | null>(null); // User's own camera/mic stream for broadcasting
  const localStreamIdRef = useRef<string | null>(null); // ID of the user's own stream in the `streams` array

  const peerConnectionsRef = useRef<Map<string, PeerConnectionContext>>(new Map()); // peerId -> {pc, peerId}
  const [signalingConnected, setSignalingConnected] = useState<boolean>(false);

  const cleanupPeerConnection = useCallback((peerId: string, notifyServer: boolean = false) => {
    const pcContext = peerConnectionsRef.current.get(peerId);
    if (pcContext) {
      pcContext.pc.close();
      peerConnectionsRef.current.delete(peerId);
      console.log(`App: Cleaned up peer connection for peerId: ${peerId}`);
    }
    setStreams(prev => prev.filter(s => !(s.isRemote && s.peerId === peerId)));
    // If I'm a broadcaster and a viewer left, the server might already know or I might notify.
    // If I'm a viewer and broadcaster left, server message `broadcast_ended` handles this.
  }, []);

  const resetLocalBroadcastingState = useCallback(() => {
    console.log("App: Resetting local broadcasting state.");
    setIsBroadcasting(false);
    if (userLocalMediaStream) {
      userLocalMediaStream.getTracks().forEach(track => track.stop());
      setUserLocalMediaStream(null);
    }
    if (localStreamIdRef.current) {
      setStreams(prev => prev.filter(s => s.id !== localStreamIdRef.current));
      localStreamIdRef.current = null;
    }
    // Close all peer connections if I was the broadcaster
    peerConnectionsRef.current.forEach((pcContext) => {
      cleanupPeerConnection(pcContext.peerId, false); // Server will handle viewer disconnects via 'viewer_left' or socket close
    });
    peerConnectionsRef.current.clear();
  }, [userLocalMediaStream, cleanupPeerConnection]);


  const handleSignalingMessage = useCallback(async (message: SignalMessage) => {
    console.log("App: Handling signaling message", message);
    switch (message.type) {
      case 'broadcast_accepted': // Server confirmed I am the broadcaster
        setIsBroadcasting(true);
        console.log("App: Broadcast accepted by server. I am now the broadcaster.");
        // My local stream should already be in `streams` via handleStartStreamingFlow
        break;

      case 'broadcast_started': // Someone else started broadcasting
        if (isBroadcasting) {
          console.log("App: Ignoring 'broadcast_started' as I am currently broadcasting.");
          return; 
        }
        console.log(`App: Remote broadcast started by ${message.broadcasterId}. Stream: ${message.streamName}. Requesting to watch.`);
        if (message.broadcasterId) {
            setStreams(prev => { // Add placeholder for remote stream
                if (prev.some(s => s.peerId === message.broadcasterId && s.isRemote)) return prev;
                return [...prev, {
                    id: `remote-${message.broadcasterId}-${Date.now()}`, 
                    name: message.streamName || `Stream from ${message.broadcasterId}`,
                    mediaStream: new MediaStream(), // Placeholder, will be populated by WebRTC 'ontrack'
                    isUserStream: false,
                    isRemote: true,
                    peerId: message.broadcasterId
                }];
            });
            signalingService.sendMessage({ type: 'watch_request' });
        }
        break;

      case 'initiate_offer': // Server tells me (broadcaster) to send an offer to a new viewer
        if (!isBroadcasting || !userLocalMediaStream) {
            console.warn("App: 'initiate_offer' received but not broadcasting or no local stream.");
            return;
        }
        const { viewerId } = message;
        if (!viewerId) {
            console.error("App: 'initiate_offer' received without viewerId.");
            return;
        }
        console.log(`App: Received 'initiate_offer' for viewerId: ${viewerId}. Creating PC and offer.`);
        
        const newPcOffer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        userLocalMediaStream.getTracks().forEach(track => newPcOffer.addTrack(track, userLocalMediaStream));
        
        newPcOffer.onicecandidate = (event) => {
          if (event.candidate) {
            signalingService.sendMessage({ type: 'candidate', candidate: event.candidate.toJSON(), target: 'viewer', targetId: viewerId });
          }
        };
        newPcOffer.onnegotiationneeded = async () => {
            console.log(`App: Negotiation needed for viewer ${viewerId}. (Re)creating offer.`);
             try {
                const offer = await newPcOffer.createOffer();
                await newPcOffer.setLocalDescription(offer);
                signalingService.sendMessage({ type: 'offer', sdp: newPcOffer.localDescription as RTCSessionDescriptionInit, viewerId: viewerId });
            } catch (e) {
                console.error(`App: Error (re)creating offer for viewer ${viewerId}:`, e);
            }
        };
        
        peerConnectionsRef.current.set(viewerId, { pc: newPcOffer, peerId: viewerId });

        try {
          const offer = await newPcOffer.createOffer();
          await newPcOffer.setLocalDescription(offer);
          signalingService.sendMessage({ type: 'offer', sdp: offer, viewerId: viewerId });
        } catch (e) {
          console.error(`App: Error creating initial offer for viewer ${viewerId}:`, e);
        }
        break;

      case 'offer': // Received an offer from the broadcaster (I am a viewer)
        if (isBroadcasting || !message.broadcasterId) {
            console.warn("App: 'offer' received but I'm broadcasting or no broadcasterId provided.");
            return;
        }
        const offerBroadcasterId = message.broadcasterId;
        console.log(`App: Received 'offer' from broadcasterId: ${offerBroadcasterId}. Creating PC and answer.`);

        const newPcAnswer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peerConnectionsRef.current.set(offerBroadcasterId, { pc: newPcAnswer, peerId: offerBroadcasterId });

        newPcAnswer.onicecandidate = (event) => {
          if (event.candidate) {
            signalingService.sendMessage({ type: 'candidate', candidate: event.candidate.toJSON(), target: 'broadcaster' });
          }
        };
        newPcAnswer.ontrack = (event) => {
          console.log(`App: Received remote track from broadcasterId: ${offerBroadcasterId}`, event.streams[0]);
          const remoteStream = event.streams[0];
          setStreams(prev => prev.map(s => 
            (s.peerId === offerBroadcasterId && s.isRemote) 
            ? { ...s, mediaStream: remoteStream } 
            : s
          ));
        };
        try {
          await newPcAnswer.setRemoteDescription(new RTCSessionDescription(message.sdp));
          const answer = await newPcAnswer.createAnswer();
          await newPcAnswer.setLocalDescription(answer);
          signalingService.sendMessage({ type: 'answer', sdp: answer, broadcasterId: offerBroadcasterId });
        } catch (e) {
          console.error(`App: Error handling 'offer'/creating 'answer' for broadcaster ${offerBroadcasterId}:`, e);
        }
        break;

      case 'answer': // Received an answer from a viewer (I am the broadcaster)
        if (!isBroadcasting || !message.viewerId) {
            console.warn("App: 'answer' received but I'm not broadcasting or no viewerId.");
            return;
        }
        const answeringViewerId = message.viewerId;
        const pcContextForAnswer = peerConnectionsRef.current.get(answeringViewerId);
        if (pcContextForAnswer) {
          try {
            await pcContextForAnswer.pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
            console.log(`App: Set remote description (answer) from viewerId: ${answeringViewerId}`);
          } catch (e) {
            console.error(`App: Error setting remote description (answer) for viewer ${answeringViewerId}:`, e);
          }
        } else {
            console.warn(`App: Received 'answer' for unknown viewerId: ${answeringViewerId}`);
        }
        break;

      case 'candidate': // Received an ICE candidate
        const pcContextForCandidate = 
            isBroadcasting && message.fromViewerId ? peerConnectionsRef.current.get(message.fromViewerId) :
            !isBroadcasting && message.fromBroadcasterId ? peerConnectionsRef.current.get(message.fromBroadcasterId) :
            null;

        if (pcContextForCandidate && message.candidate) {
          try {
            await pcContextForCandidate.pc.addIceCandidate(new RTCIceCandidate(message.candidate));
            console.log(`App: Added ICE candidate for/from peer ${pcContextForCandidate.peerId}`);
          } catch (e) {
            console.error(`App: Error adding ICE candidate for peer ${pcContextForCandidate.peerId}:`, e);
          }
        } else {
             console.warn("App: Could not find PC for ICE candidate or candidate missing", message);
        }
        break;
      
      case 'broadcast_ended':
        console.log("App: Received 'broadcast_ended'. Cleaning up remote stream and PC.");
        if (!isBroadcasting) { // I was a viewer
            // The server should ideally tell which broadcasterId ended, but assuming one for now.
            const remoteStreamEntry = streams.find(s => s.isRemote && s.mediaStream.active); // Find the active remote stream
            if(remoteStreamEntry && remoteStreamEntry.peerId){
                cleanupPeerConnection(remoteStreamEntry.peerId);
            } else { // Fallback: clean all remote streams and their PCs
                 peerConnectionsRef.current.forEach((pcCtx, peerId) => {
                    if (streams.some(s => s.peerId === peerId && s.isRemote)) {
                        cleanupPeerConnection(peerId);
                    }
                });
            }
            setStreams(prev => prev.filter(s => !s.isRemote)); // Clear all remote streams
        }
        break;

      case 'viewer_left':
        if (isBroadcasting && message.viewerId) {
          console.log(`App: Viewer ${message.viewerId} left.`);
          cleanupPeerConnection(message.viewerId, false); // Server already knows
        }
        break;
      
      case 'error':
        console.error("App: Received error from signaling server:", message.message);
        // Potentially display this error to the user
        break;
      
      case 'watch_accepted':
        console.log("App: Watch request accepted by server. Waiting for offer from broadcaster.");
        break;

      default:
        console.warn("App: Received unknown message type from signaling server:", message);
    }
  }, [isBroadcasting, userLocalMediaStream, cleanupPeerConnection, streams]);

  // Connect to signaling server
  useEffect(() => {
    signalingService.setOnMessage(handleSignalingMessage);
    signalingService.setOnOpen(() => {
        console.log("App: Signaling service connected.");
        setSignalingConnected(true);
    });
    signalingService.setOnClose((event) => {
        console.warn("App: Signaling service disconnected.", event);
        setSignalingConnected(false);
        // Potentially try to reconnect or inform user
        resetLocalBroadcastingState(); // If disconnected, can't broadcast
        setStreams(prev => prev.filter(s => !s.isRemote)); // Clear remote streams
    });
    signalingService.setOnError((event) => {
        console.error("App: Signaling service error.", event);
        setSignalingConnected(false);
        // Consider error handling, e.g., UI notification
    });

    signalingService.connect().catch(err => {
        console.error("App: Initial signaling connection failed:", err);
    });

    return () => {
      signalingService.close();
      resetLocalBroadcastingState();
      peerConnectionsRef.current.forEach(pcCtx => pcCtx.pc.close());
      peerConnectionsRef.current.clear();
    };
  }, [handleSignalingMessage, resetLocalBroadcastingState]);

  const handleStartStreamingFlow = useCallback(async (name: string, mediaStream: MediaStream) => {
    if (!signalingConnected) {
        console.error("App: Cannot start streaming, signaling service not connected.");
        throw new Error("Not connected to signaling server.");
    }
    if (isBroadcasting) {
        console.warn("App: Already broadcasting.");
        return;
    }
    console.log("App: Attempting to start streaming flow with name:", name);
    setUserLocalMediaStream(mediaStream); // This is the stream from AddStreamModal
    
    const newStreamId = `local-${Date.now()}`;
    localStreamIdRef.current = newStreamId;

    setStreams(prev => [...prev, {
      id: newStreamId,
      name: name,
      mediaStream: mediaStream,
      isUserStream: true,
      isRemote: false,
    }]);
    
    signalingService.sendMessage({ type: 'broadcast_start', streamName: name });
    // Server will respond with 'broadcast_accepted' which sets isBroadcasting = true
    setIsModalOpen(false); // Close modal after initiating
  }, [signalingConnected, isBroadcasting]);

  const handleStopStreaming = useCallback(() => {
    if (!isBroadcasting) {
      console.warn("App: Not broadcasting, cannot stop.");
      return;
    }
    console.log("App: Stopping user's broadcast.");
    signalingService.sendMessage({ type: 'broadcast_stop' });
    resetLocalBroadcastingState(); // Cleans up local media, PCs, and sets isBroadcasting to false
  }, [isBroadcasting, resetLocalBroadcastingState]);

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => { // Called by AddStreamModal's onClose
    setIsModalOpen(false);
    // If userLocalMediaStream was set for preview but not broadcasted, AddStreamModal should handle its cleanup.
  };

  const handleSelectStream = (streamToSelect: Stream) => {
    setSelectedStream(streamToSelect);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header 
        onAddStreamClick={handleOpenModal} 
        isUserStreaming={isBroadcasting}
        onStopStreamClick={handleStopStreaming}
      />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!signalingConnected && (
            <div className="p-4 mb-4 text-sm text-yellow-700 bg-yellow-100 rounded-lg dark:bg-yellow-200 dark:text-yellow-800" role="alert">
                <span className="font-medium">Connecting to server...</span> Please wait. If this persists, the signaling server might be unavailable.
            </div>
        )}
        {streams.length > 0 ? (
            <StreamGrid streams={streams} onSelectStream={handleSelectStream} />
        ) : (
             <div className="flex flex-col items-center justify-center h-full text-gray-500 py-16">
                <h2 className="text-2xl font-semibold mb-2">No Live Streams Yet</h2>
                <p className="text-lg">{signalingConnected ? 'Why not start one? Click "Go Live" to begin!' : 'Waiting for connection to server...'}</p>
            </div>
        )}
      </main>
      {selectedStream && (
        <StreamPlayer stream={selectedStream} onClose={() => setSelectedStream(null)} />
      )}
      <AddStreamModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onStartStreaming={handleStartStreamingFlow}
        // Pass the userLocalMediaStream for preview and reuse if broadcasting starts from modal
        userLocalMediaStream={userLocalMediaStream} 
        setUserLocalMediaStream={setUserLocalMediaStream}
      />
    </div>
  );
};

export default App;
