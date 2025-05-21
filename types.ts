export interface Stream {
  id: string; 
  name: string;
  mediaStream: MediaStream;
  isUserStream: boolean; 
  isRemote: boolean; 
  peerId?: string; // For remote streams: broadcasterId. For local streams (when broadcasting): not directly used on Stream object, but PCs are mapped by viewerId.
}

export type ModalStep = 'password' | 'setup' | 'loadingMedia' | 'mediaError' | 'broadcasting';

// Base for all signaling messages
export interface BaseSignalMessage {
  type: string;
}

// Client to Server Messages
export interface BroadcastStartClientMessage extends BaseSignalMessage {
  type: 'broadcast_start';
  streamName: string; // Client tells server its desired stream name
}

export interface WatchRequestClientMessage extends BaseSignalMessage {
  type: 'watch_request';
  // No payload needed, server knows who sent it and if there's a broadcaster
}

export interface OfferClientMessage extends BaseSignalMessage {
  type: 'offer';
  sdp: RTCSessionDescriptionInit;
  viewerId: string; // Broadcaster sends an offer TO a specific viewerId
}

export interface AnswerClientMessage extends BaseSignalMessage {
  type: 'answer';
  sdp: RTCSessionDescriptionInit;
  broadcasterId: string; // Viewer sends an answer TO a specific broadcasterId
}

export interface CandidateClientMessage extends BaseSignalMessage {
  type: 'candidate';
  candidate: RTCIceCandidateInit | null;
  target: 'broadcaster' | 'viewer'; // Who is this candidate for?
  targetId?: string; // If target is 'viewer', this is the specific viewerId
}

export interface BroadcastStopClientMessage extends BaseSignalMessage {
  type: 'broadcast_stop';
}

// Server to Client Messages
export interface BroadcastAcceptedServerMessage extends BaseSignalMessage {
  type: 'broadcast_accepted';
  // Optional: server could assign an ID to the broadcaster here if needed
}
export interface WatchAcceptedServerMessage extends BaseSignalMessage {
    type: 'watch_accepted'; // For the viewer, confirms watch request, implies offer is coming
}

export interface BroadcastStartedServerMessage extends BaseSignalMessage {
  type: 'broadcast_started';
  broadcasterId: string;
  streamName: string;
}

export interface BroadcastEndedServerMessage extends BaseSignalMessage {
  type: 'broadcast_ended';
}

export interface InitiateOfferServerMessage extends BaseSignalMessage {
  type: 'initiate_offer';
  viewerId: string; // Server tells broadcaster to send an offer to this viewer
}

export interface OfferServerMessage extends BaseSignalMessage {
  type: 'offer';
  sdp: RTCSessionDescriptionInit;
  broadcasterId: string; // Offer is FROM this broadcasterId
}

export interface AnswerServerMessage extends BaseSignalMessage {
  type: 'answer';
  sdp: RTCSessionDescriptionInit;
  viewerId: string; // Answer is FROM this viewerId
}

export interface CandidateServerMessage extends BaseSignalMessage {
  type: 'candidate';
  candidate: RTCIceCandidateInit | null;
  fromViewerId?: string; // If candidate is from a viewer, for the broadcaster
  fromBroadcasterId?: string; // If candidate is from the broadcaster, for a viewer
}

export interface ViewerLeftServerMessage extends BaseSignalMessage {
  type: 'viewer_left';
  viewerId: string;
}

export interface ErrorServerMessage extends BaseSignalMessage {
  type: 'error';
  message: string;
}

// Union type for all possible messages received by the client
export type SignalMessage =
  | BroadcastAcceptedServerMessage
  | WatchAcceptedServerMessage
  | BroadcastStartedServerMessage
  | BroadcastEndedServerMessage
  | InitiateOfferServerMessage
  | OfferServerMessage
  | AnswerServerMessage
  | CandidateServerMessage
  | ViewerLeftServerMessage
  | ErrorServerMessage;

// Union type for all possible messages sent by the client
export type ClientSignalMessage =
  | BroadcastStartClientMessage
  | WatchRequestClientMessage
  | OfferClientMessage
  | AnswerClientMessage
  | CandidateClientMessage
  | BroadcastStopClientMessage;


export interface PeerConnectionContext {
  pc: RTCPeerConnection;
  peerId: string; // ID of the remote peer (viewerId for broadcaster, broadcasterId for viewer)
}