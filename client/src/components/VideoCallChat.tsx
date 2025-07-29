import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User, Bot, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  message: string;
  sender: string;
  timestamp: Date;
  role: 'interviewer' | 'candidate';
}

interface VideoCallChatProps {
  roomId: string;
}

export function VideoCallChat({ roomId }: VideoCallChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // WebSocket connection for real-time chat
  useEffect(() => {
    if (!roomId) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/chat/${roomId}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log('Chat WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chat_message') {
            const newMessage: ChatMessage = {
              id: data.id || Date.now().toString(),
              message: data.message,
              sender: data.sender,
              timestamp: new Date(data.timestamp),
              role: data.role
            };
            setMessages(prev => [...prev, newMessage]);
          }
        } catch (error) {
          console.error('Error parsing chat message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('Chat WebSocket disconnected');
      };

      ws.onerror = (error) => {
        console.error('Chat WebSocket error:', error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to create chat WebSocket:', error);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId]);

  const sendMessage = () => {
    if (!newMessage.trim() || !wsRef.current || !isConnected) return;

    const messageData = {
      type: 'chat_message',
      message: newMessage.trim(),
      sender: 'User', // This would be dynamic based on authentication
      role: 'interviewer', // This would be dynamic based on user role
      timestamp: new Date().toISOString(),
      roomId
    };

    try {
      wsRef.current.send(JSON.stringify(messageData));
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: "Message Failed",
        description: "Could not send message. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-6 w-6 mx-auto mb-2 text-gray-400" />
              <div className="text-xs">No messages yet</div>
              <div className="text-xs mt-1">Start a conversation!</div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="flex items-start gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  message.role === 'interviewer' 
                    ? 'bg-violet-100 text-violet-600' 
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  {message.role === 'interviewer' ? (
                    <User className="h-3 w-3" />
                  ) : (
                    <Bot className="h-3 w-3" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      {message.sender}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-900 break-words">
                    {message.message}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-3 border-t border-gray-200">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="text-xs"
            disabled={!isConnected}
          />
          <Button
            onClick={sendMessage}
            size="sm"
            disabled={!newMessage.trim() || !isConnected}
            className="px-2"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
        {!isConnected && (
          <div className="text-xs text-gray-500 mt-1">
            Chat disconnected - reconnecting...
          </div>
        )}
      </div>
    </div>
  );
}