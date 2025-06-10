import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff } from 'lucide-react';

interface VideoCallProps {
  roomId: string;
  role: string;
}

export function VideoCall({ roomId, role }: VideoCallProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  useEffect(() => {
    startLocalVideo();
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startLocalVideo = async () => {
    try {
      setConnectionStatus('connecting');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setConnectionStatus('disconnected');
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Video Container with fixed aspect ratio */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9', maxHeight: '180px' }}>
        {/* Local Video */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {/* Remote Video (picture-in-picture) */}
        <div className="absolute top-2 right-2 w-16 h-12 bg-gray-800 rounded border border-gray-600 flex items-center justify-center overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
            Remote
          </div>
        </div>

        {/* Status Indicator */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 
            connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
          <span className="text-white text-xs capitalize">{connectionStatus}</span>
        </div>

        {/* Role Badge */}
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          {role}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3 flex justify-center gap-2">
        <Button
          size="sm"
          variant={isVideoEnabled ? "default" : "destructive"}
          onClick={toggleVideo}
        >
          {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>
        <Button
          size="sm"
          variant={isAudioEnabled ? "default" : "destructive"}
          onClick={toggleAudio}
        >
          {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}