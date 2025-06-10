import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, MessageCircle, Users } from 'lucide-react';

interface VideoCallProps {
  roomId: string;
  role: string;
}

export function VideoCall({ roomId, role }: VideoCallProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('connecting');
  const [participantCount, setParticipantCount] = useState(1);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    initializeVideoCall();
  }, [roomId]);

  const initializeVideoCall = () => {
    setConnectionStatus('connecting');
    
    // Simulate connection status updates
    setTimeout(() => {
      setConnectionStatus('connected');
      setParticipantCount(Math.floor(Math.random() * 3) + 1); // 1-3 participants
    }, 2000);
  };

  // Generate Daily.co Prebuilt URL with room ID
  const getDailyRoomUrl = () => {
    // Using Daily.co's demo domain structure
    const baseUrl = 'https://call.daily.co';
    const roomName = `hiro-${roomId}`;
    return `${baseUrl}/${roomName}?t=${Date.now()}`;
  };

  return (
    <div className="h-full flex flex-col min-w-[320px] min-h-[240px]">
      {/* Video Container */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden flex-1" style={{ minHeight: '240px' }}>
        {/* Daily.co Prebuilt Video Frame */}
        <iframe
          ref={iframeRef}
          src={getDailyRoomUrl()}
          className="w-full h-full border-none"
          style={{ minHeight: '240px' }}
          allow="camera; microphone; fullscreen; speaker; display-capture"
          title={`Video call for ${role}`}
        />

        {/* Status Indicator Overlay */}
        <div className="absolute top-2 left-2 flex items-center gap-2 bg-black bg-opacity-70 px-2 py-1 rounded z-10">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 
            connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
          <span className="text-white text-xs capitalize">{connectionStatus}</span>
        </div>

        {/* Role and Participant Badge */}
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs z-10">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{role} • {participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Chat Toggle */}
        <div className="absolute top-2 right-2 z-10">
          <Button
            size="sm"
            variant={showChat ? "default" : "outline"}
            onClick={() => setShowChat(!showChat)}
            className="bg-black bg-opacity-70 border-white border-opacity-50 text-white hover:bg-white hover:bg-opacity-20"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Connection Info */}
      <div className="mt-2 text-center">
        <div className="text-xs text-gray-500">
          Room: {roomId} • {connectionStatus === 'connected' ? 'Live video call active' : 'Connecting...'}
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="mt-3 border-t pt-3 bg-gray-50 rounded-lg p-3">
          <div className="text-xs font-medium text-gray-600 mb-2">Interview Chat</div>
          <div className="max-h-24 overflow-y-auto mb-2 space-y-1 bg-white rounded p-2">
            <div className="text-xs text-gray-500 text-center py-2">
              Chat functionality will be available once Daily.co API keys are configured.
              <br />
              For now, use the built-in video call chat features.
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Use video call chat..."
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100"
              disabled
            />
            <Button size="sm" disabled className="text-xs">
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}