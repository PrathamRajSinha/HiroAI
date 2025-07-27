import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TemplateManager } from "@/components/TemplateManager";
import { Settings, Briefcase, Copy } from "lucide-react";
import hiroLogo from "@assets/logo hiro_1749550404647.png";

export default function CreateInterview() {
  const [location] = useLocation();
  const [isRoomCreated, setIsRoomCreated] = useState<boolean>(false);
  const [roomId, setRoomId] = useState<string>("");
  
  // Interview configuration
  const [candidateName, setCandidateName] = useState<string>("");
  const [interviewerName, setInterviewerName] = useState<string>("");
  const [jobTitle, setJobTitle] = useState<string>("");
  const [seniorityLevel, setSeniorityLevel] = useState<string>("");
  const [roleType, setRoleType] = useState<string>("");
  const [techStack, setTechStack] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [defaultQuestionType, setDefaultQuestionType] = useState<string>("");
  const [defaultDifficulty, setDefaultDifficulty] = useState<string>("");
  
  const { toast } = useToast();

  // Load template data from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const templateData = params.get('template');
    
    if (templateData) {
      try {
        const template = JSON.parse(templateData);
        setJobTitle(template.jobTitle || '');
        setSeniorityLevel(template.seniorityLevel || '');
        setRoleType(template.roleType || '');
        setTechStack(template.techStack || '');
        setDepartment(template.department || '');
        setDefaultQuestionType(template.defaultQuestionType || '');
        setDefaultDifficulty(template.defaultDifficulty || '');
        
        toast({
          title: "Template Loaded",
          description: "Interview template has been applied to the form",
        });
      } catch (error) {
        console.error('Error parsing template data:', error);
      }
    }
  }, [location, toast]);

  // Create interview mutation
  const createInterviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/interviews', 'POST', {
        candidateName: candidateName.trim(),
        roleTitle: jobTitle.trim(),
        interviewerName: interviewerName.trim(),
        jobTitle: jobTitle.trim(),
        seniorityLevel,
        techStack,
        roleType,
        department,
        defaultQuestionType,
        defaultDifficulty
      });
    },
    onSuccess: (data) => {
      setRoomId(data.roomId);
      setIsRoomCreated(true);
      toast({
        title: "Interview Created!",
        description: "Interview room has been successfully created",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create interview",
        variant: "destructive",
      });
    }
  });

  const createRoom = () => {
    if (!candidateName.trim() || !jobTitle.trim() || !interviewerName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in candidate name, job title, and interviewer name",
        variant: "destructive",
      });
      return;
    }
    
    createInterviewMutation.mutate();
  };

  // Handle template loading
  const handleTemplateLoad = (templateData: any) => {
    setJobTitle(templateData.jobTitle || '');
    setSeniorityLevel(templateData.seniorityLevel || '');
    setRoleType(templateData.roleType || '');
    setTechStack(templateData.techStack || '');
    setDepartment(templateData.department || '');
    setDefaultQuestionType(templateData.defaultQuestionType || '');
    setDefaultDifficulty(templateData.defaultDifficulty || '');
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
                src={hiroLogo} 
                alt="Hiro.ai Logo" 
                className="w-10 h-10"
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

        <div className="container mx-auto p-6 max-w-6xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Create Interview</h1>
            <p className="text-muted-foreground">Configure your technical interview session</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Interview Configuration */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="candidateName">Candidate Name *</Label>
                      <Input
                        id="candidateName"
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        placeholder="e.g., John Smith"
                      />
                    </div>
                    <div>
                      <Label htmlFor="interviewerName">Interviewer Name *</Label>
                      <Input
                        id="interviewerName"
                        value={interviewerName}
                        onChange={(e) => setInterviewerName(e.target.value)}
                        placeholder="e.g., Jane Doe"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Job Context */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Job Context
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="jobTitle">Job Title *</Label>
                      <Input
                        id="jobTitle"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="e.g., Senior Frontend Developer"
                      />
                    </div>
                    <div>
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g., Engineering"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="seniorityLevel">Seniority Level</Label>
                      <Select value={seniorityLevel} onValueChange={setSeniorityLevel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Junior">Junior</SelectItem>
                          <SelectItem value="Mid">Mid</SelectItem>
                          <SelectItem value="Senior">Senior</SelectItem>
                          <SelectItem value="Lead">Lead</SelectItem>
                          <SelectItem value="Principal">Principal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="roleType">Role Type</Label>
                      <Select value={roleType} onValueChange={setRoleType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Frontend">Frontend</SelectItem>
                          <SelectItem value="Backend">Backend</SelectItem>
                          <SelectItem value="Full Stack">Full Stack</SelectItem>
                          <SelectItem value="DevOps">DevOps</SelectItem>
                          <SelectItem value="Mobile">Mobile</SelectItem>
                          <SelectItem value="Data Science">Data Science</SelectItem>
                          <SelectItem value="QA">QA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="techStack">Tech Stack</Label>
                    <Input
                      id="techStack"
                      value={techStack}
                      onChange={(e) => setTechStack(e.target.value)}
                      placeholder="e.g., React, TypeScript, Node.js, PostgreSQL"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Question Preferences */}
              <Card>
                <CardHeader>
                  <CardTitle>Question Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="defaultQuestionType">Default Question Type</Label>
                      <Select value={defaultQuestionType} onValueChange={setDefaultQuestionType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Coding">Coding</SelectItem>
                          <SelectItem value="System Design">System Design</SelectItem>
                          <SelectItem value="Behavioral">Behavioral</SelectItem>
                          <SelectItem value="Technical Discussion">Technical Discussion</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="defaultDifficulty">Default Difficulty</Label>
                      <Select value={defaultDifficulty} onValueChange={setDefaultDifficulty}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select difficulty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Easy">Easy</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button
                  onClick={createRoom}
                  className="flex-1"
                  size="lg"
                  disabled={createInterviewMutation.isPending}
                >
                  {createInterviewMutation.isPending ? "Creating..." : "Create Interview"}
                </Button>
                <Link href="/dashboard">
                  <Button variant="outline" size="lg">
                    Cancel
                  </Button>
                </Link>
              </div>
            </div>

            {/* Template Manager */}
            <div className="lg:col-span-1">
              <TemplateManager
                onTemplateLoad={handleTemplateLoad}
                currentTemplate={{
                  jobTitle,
                  seniorityLevel,
                  roleType,
                  techStack,
                  department,
                  defaultQuestionType,
                  defaultDifficulty
                }}
              />
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
              {jobTitle && `"${jobTitle}" - `}
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