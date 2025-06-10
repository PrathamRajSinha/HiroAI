import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, MessageCircle } from 'lucide-react';
import DailyIframe from '@daily-co/daily-js';

interface VideoCallProps {
  roomId: string;
  role: string;
}

export function VideoCall({ roomId, role }: VideoCallProps) {
  const callContainerRef = useRef<HTMLDivElement>(null);
  const [callFrame, setCallFrame] = useState<any>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [participants, setParticipants] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  useEffect(() => {
    initializeDailyCall();
    return () => {
      if (callFrame) {
        callFrame.destroy();
      }
    };
  }, [roomId]);

  const initializeDailyCall = async () => {
    try {
      setConnectionStatus('connecting');
      
      if (!callContainerRef.current) {
        console.error('Call container ref not available');
        return;
      }
      
      // Create Daily call frame
      const frame = DailyIframe.createFrame(callContainerRef.current as HTMLElement, {
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: 'none'
        },
        showLeaveButton: false,
        showFullscreenButton: false
      });

      setCallFrame(frame);

      // Set up event listeners
      frame
        .on('joined-meeting', (event: any) => {
          console.log('Joined meeting:', event);
          setConnectionStatus('connected');
        })
        .on('participant-joined', (event: any) => {
          console.log('Participant joined:', event);
          updateParticipants(frame);
        })
        .on('participant-left', (event: any) => {
          console.log('Participant left:', event);
          updateParticipants(frame);
        })
        .on('participant-updated', (event: any) => {
          console.log('Participant updated:', event);
          updateParticipants(frame);
        })
        .on('app-message', (event: any) => {
          console.log('Chat message received:', event);
          if (event.data.type === 'chat') {
            setChatMessages(prev => [...prev, {
              id: Date.now(),
              text: event.data.message,
              from: event.fromId,
              participant: event.data.participant || 'Unknown',
              timestamp: new Date().toLocaleTimeString()
            }]);
          }
        })
        .on('error', (event: any) => {
          console.error('Daily call error:', event);
          setConnectionStatus('disconnected');
        });

      // Join the meeting
      const roomUrl = `https://hiro-ai.daily.co/${roomId}`;
      await frame.join({ url: roomUrl });

    } catch (error) {
      console.error('Error initializing Daily call:', error);
      setConnectionStatus('disconnected');
    }
  };

  const updateParticipants = (frame: any) => {
    if (frame) {
      const participantList = Object.values(frame.participants());
      setParticipants(participantList);
    }
  };

  const toggleVideo = async () => {
    if (callFrame) {
      await callFrame.setLocalVideo(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleAudio = async () => {
    if (callFrame) {
      await callFrame.setLocalAudio(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const sendChatMessage = (message: string) => {
    if (callFrame && message.trim()) {
      callFrame.sendAppMessage({
        type: 'chat',
        message: message.trim(),
        participant: role
      }, '*');
      
      // Add to local chat
      setChatMessages(prev => [...prev, {
        id: Date.now(),
        text: message.trim(),
        from: 'local',
        participant: role,
        timestamp: new Date().toLocaleTimeString()
      }]);
    }
  };

  return (
    <div className="h-full flex flex-col min-w-[320px] min-h-[240px]">
      {/* Video Container */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden flex-1" style={{ minHeight: '200px' }}>
        {/* Daily.co Video Frame */}
        <div 
          ref={callContainerRef} 
          className="w-full h-full"
          style={{ minHeight: '200px' }}
        />

        {/* Status Indicator Overlay */}
        <div className="absolute top-2 left-2 flex items-center gap-2 bg-black bg-opacity-50 px-2 py-1 rounded">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 
            connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
          <span className="text-white text-xs capitalize">{connectionStatus}</span>
        </div>

        {/* Role Badge */}
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          {role} ({participants.length} participants)
        </div>

        {/* Chat Toggle */}
        <div className="absolute top-2 right-2">
          <Button
            size="sm"
            variant={showChat ? "default" : "outline"}
            onClick={() => setShowChat(!showChat)}
            className="bg-black bg-opacity-50 border-white border-opacity-50 text-white hover:bg-white hover:bg-opacity-20"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
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

      {/* Chat Panel */}
      {showChat && (
        <div className="mt-3 border-t pt-3">
          <div className="max-h-32 overflow-y-auto mb-2 space-y-1">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="text-xs">
                <span className="font-medium text-gray-600">{msg.participant}:</span>
                <span className="ml-1 text-gray-800">{msg.text}</span>
                <span className="ml-2 text-gray-400">{msg.timestamp}</span>
              </div>
            ))}
            {chatMessages.length === 0 && (
              <div className="text-xs text-gray-500 text-center py-2">
                No messages yet. Start a conversation!
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  sendChatMessage(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
            />
            <Button
              size="sm"
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                if (input) {
                  sendChatMessage(input.value);
                  input.value = '';
                }
              }}
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}