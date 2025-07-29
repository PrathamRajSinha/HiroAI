interface VideoCallProps {
  roomId: string;
  role: string;
}

export function VideoCall({ roomId, role }: VideoCallProps) {
  // Use the original Daily.co API that was working
  const videoCallUrl = `https://aiinterview.daily.co/${roomId}`;

  return (
    <div className="h-full flex flex-col">
      {/* Daily.co Video Call with Built-in Chat */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden flex-1">
        <iframe
          src={videoCallUrl}
          className="w-full h-full rounded-lg"
          allow="camera; microphone; fullscreen; speaker; display-capture"
          title="Daily Video Chat with Built-in Chat"
          style={{ border: 'none', minHeight: '300px' }}
        />
        
        {/* Role indicator overlay */}
        <div className="absolute top-2 left-2 z-10">
          <div className="px-2 py-1 bg-violet-600 text-white rounded text-xs font-medium shadow-lg">
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </div>
        </div>
      </div>
      
      {/* Info about chat */}
      <div className="mt-2 text-xs text-gray-600 text-center">
        Click the chat icon in the video call to use built-in messaging
      </div>
    </div>
  );
}