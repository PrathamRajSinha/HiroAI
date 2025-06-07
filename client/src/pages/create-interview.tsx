import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function CreateInterview() {
  const [roomId, setRoomId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    // Generate unique room ID when component loads
    const generatedRoomId = crypto.randomUUID().slice(0, 8);
    setRoomId(generatedRoomId);
  }, []);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${type} link copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const openInterviewRoom = () => {
    const interviewerUrl = `/interview/${roomId}?role=interviewer`;
    window.open(interviewerUrl, '_blank');
  };

  const interviewerLink = `${window.location.origin}/interview/${roomId}?role=interviewer`;
  const candidateLink = `${window.location.origin}/interview/${roomId}?role=candidate`;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
        {/* Success Message */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Interview Room Created!</h1>
          <p className="text-gray-600">Share these links with the interviewer and candidate</p>
        </div>

        {/* Room ID Display */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm font-medium text-gray-700 mb-1">Room ID</div>
          <div className="text-xl font-mono text-gray-900">{roomId}</div>
        </div>

        {/* Links Section */}
        <div className="space-y-4 mb-8">
          {/* Interviewer Link */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700 mb-1">Interviewer Link</div>
                <div className="text-sm text-gray-600 break-all font-mono bg-gray-50 p-2 rounded">
                  {interviewerLink}
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(interviewerLink, "Interviewer")}
                className="ml-4 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                📋 Copy
              </button>
            </div>
          </div>

          {/* Candidate Link */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700 mb-1">Candidate Link</div>
                <div className="text-sm text-gray-600 break-all font-mono bg-gray-50 p-2 rounded">
                  {candidateLink}
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(candidateLink, "Candidate")}
                className="ml-4 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                📋 Copy
              </button>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center">
          <button
            onClick={openInterviewRoom}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-lg transition-colors shadow-lg hover:shadow-xl"
          >
            Go to Interview Room
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-800">
            <div className="font-medium mb-2">Instructions:</div>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Send the interviewer link to the person conducting the interview</li>
              <li>Send the candidate link to the person being interviewed</li>
              <li>Both participants can join the same room to collaborate in real-time</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}