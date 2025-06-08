import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function CreateInterview() {
  const [roomId, setRoomId] = useState<string>("");
  const [isRoomCreated, setIsRoomCreated] = useState<boolean>(false);
  const [interviewTitle, setInterviewTitle] = useState<string>("");
  const [candidateName, setCandidateName] = useState<string>("");
  const { toast } = useToast();

  const createRoom = () => {
    if (!interviewTitle.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter an interview title",
        variant: "destructive",
      });
      return;
    }

    const generatedRoomId = crypto.randomUUID().slice(0, 8);
    setRoomId(generatedRoomId);
    setIsRoomCreated(true);
    
    toast({
      title: "Room Created!",
      description: "Interview room has been successfully created",
    });
  };

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

  const interviewerLink = roomId ? `${window.location.origin}/interview/${roomId}?role=interviewer` : "";
  const candidateLink = roomId ? `${window.location.origin}/interview/${roomId}?role=candidate` : "";

  if (!isRoomCreated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎯</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Create Interview Room</h1>
            <p className="text-gray-600">Set up a new technical interview session</p>
            <div className="mt-4">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  View Dashboard
                </Button>
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interview Title *
              </label>
              <input
                type="text"
                value={interviewTitle}
                onChange={(e) => setInterviewTitle(e.target.value)}
                placeholder="e.g., Frontend Developer Interview"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Candidate Name (Optional)
              </label>
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g., John Smith"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={createRoom}
              className="w-full px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl"
            >
              Create Interview Room
            </button>
          </div>

          <div className="mt-6 p-4 bg-violet-50 rounded-lg">
            <div className="text-sm text-violet-800">
              <div className="font-medium mb-2">Features:</div>
              <ul className="list-disc list-inside space-y-1 text-violet-700">
                <li>Real-time video chat with Daily.co</li>
                <li>Collaborative Monaco code editor</li>
                <li>AI-powered coding questions</li>
                <li>Separate links for interviewer and candidate</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
        {/* Success Message */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Interview Room Created!</h1>
          <p className="text-gray-600">
            {interviewTitle && `"${interviewTitle}" - `}
            Share these links with the interviewer and candidate
          </p>
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

        {/* Action Buttons */}
        <div className="text-center space-y-3">
          <button
            onClick={openInterviewRoom}
            className="w-full px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-lg transition-colors shadow-lg hover:shadow-xl"
          >
            Go to Interview Room
          </button>
          <button
            onClick={() => {
              setIsRoomCreated(false);
              setInterviewTitle("");
              setCandidateName("");
              setRoomId("");
            }}
            className="w-full px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Create New Room
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