export interface Stream {
  id: string;
  name: string;
  mediaStream: MediaStream;
  isUserStream: boolean; // True if it's the current user's own broadcast
}

export type ModalStep = 'password' | 'setup' | 'loadingMedia' | 'mediaError' | 'broadcasting';