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
      <div className="min-h-screen bg-background">
        {/* Top Navigation */}
        <nav className="bg-card border-b border-border px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img 
                src="/attached_assets/logo%20hiro_1749550404647.png" 
                alt="Hiro.ai Logo" 
                className="w-8 h-8"
              />
              <span className="text-xl font-bold text-foreground">Hiro.ai</span>
            </div>
            
            <Link href="/dashboard">
              <Button variant="outline">
                View Dashboard
              </Button>
            </Link>
          </div>
        </nav>

        <div className="flex items-center justify-center p-4 pt-16">
          <div className="bg-card rounded-xl shadow-lg p-8 max-w-md w-full border border-border">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <img 
                  src="/attached_assets/logo%20hiro_1749550404647.png" 
                  alt="Hiro.ai Logo" 
                  className="w-8 h-8"
                />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Create Interview Room</h1>
              <p className="text-muted-foreground">Set up a new technical interview session</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Interview Title *
                </label>
                <input
                  type="text"
                  value={interviewTitle}
                  onChange={(e) => setInterviewTitle(e.target.value)}
                  placeholder="e.g., Frontend Developer Interview"
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Candidate Name (Optional)
                </label>
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="e.g., John Smith"
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
                />
              </div>

              <Button
                onClick={createRoom}
                className="w-full"
                size="lg"
              >
                Create Interview Room
              </Button>
            </div>

            <div className="mt-6 p-4 bg-accent/10 rounded-lg border border-accent/20">
              <div className="text-sm text-foreground">
                <div className="font-medium mb-2">Features:</div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Real-time video chat with Daily.co</li>
                  <li>Collaborative Monaco code editor</li>
                  <li>AI-powered coding questions</li>
                  <li>Separate links for interviewer and candidate</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <nav className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">H</span>
            </div>
            <span className="text-xl font-bold text-foreground">Hiro.ai</span>
          </div>
          
          <Link href="/dashboard">
            <Button variant="outline">
              View Dashboard
            </Button>
          </Link>
        </div>
      </nav>

      <div className="flex items-center justify-center p-4 pt-16">
        <div className="bg-card rounded-xl shadow-lg p-8 max-w-2xl w-full border border-border">
          {/* Success Message */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✅</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Interview Room Created!</h1>
            <p className="text-muted-foreground">
              {interviewTitle && `"${interviewTitle}" - `}
              Share these links with the interviewer and candidate
            </p>
          </div>

          {/* Room ID Display */}
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <div className="text-sm font-medium text-foreground mb-1">Room ID</div>
            <div className="text-xl font-mono text-foreground">{roomId}</div>
          </div>

          {/* Links Section */}
          <div className="space-y-4 mb-8">
            {/* Interviewer Link */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground mb-1">Interviewer Link</div>
                  <div className="text-sm text-muted-foreground break-all font-mono bg-muted p-2 rounded">
                    {interviewerLink}
                  </div>
                </div>
                <Button
                  onClick={() => copyToClipboard(interviewerLink, "Interviewer")}
                  className="ml-4"
                  size="sm"
                  variant="secondary"
                >
                  Copy
                </Button>
              </div>
            </div>

            {/* Candidate Link */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground mb-1">Candidate Link</div>
                  <div className="text-sm text-muted-foreground break-all font-mono bg-muted p-2 rounded">
                    {candidateLink}
                  </div>
                </div>
                <Button
                  onClick={() => copyToClipboard(candidateLink, "Candidate")}
                  className="ml-4"
                  size="sm"
                  variant="secondary"
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="text-center space-y-4">
            <Button
              onClick={openInterviewRoom}
              className="w-full"
              size="lg"
            >
              Go to Interview Room
            </Button>
            <Link href="/dashboard">
              <Button className="w-full" variant="secondary" size="lg">
                View Interview Dashboard
              </Button>
            </Link>
            <Button
              onClick={() => {
                setIsRoomCreated(false);
                setInterviewTitle("");
                setCandidateName("");
                setRoomId("");
              }}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Create New Room
            </Button>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-accent/10 rounded-lg border border-accent/20">
            <div className="text-sm text-foreground">
              <div className="font-medium mb-2">Instructions:</div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Send the interviewer link to the person conducting the interview</li>
                <li>Send the candidate link to the person being interviewed</li>
                <li>Both participants can join the same room to collaborate in real-time</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}