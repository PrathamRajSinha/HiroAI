import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Eye, Plus, Search, Users, Calendar, Clock, Trophy } from "lucide-react";

interface InterviewSession {
  id: string;
  candidateName: string;
  candidateId: string;
  roleTitle: string;
  roundNumber: number;
  interviewerName: string;
  date: string;
  timestamp: number;
  status: 'In Progress' | 'Completed' | 'Scheduled';
  jobContext?: {
    jobTitle: string;
    seniorityLevel: string;
    techStack: string;
    roleType: string;
  };
  summary?: string;
  overallScore?: number;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newInterview, setNewInterview] = useState({
    candidateName: "",
    roleTitle: "",
    interviewerName: "",
    jobTitle: "",
    seniorityLevel: "Mid",
    techStack: "",
    roleType: "Coding"
  });

  // Fetch all interviews
  const { data: interviews = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/interviews'],
    queryFn: async () => {
      const response = await apiRequest('/api/interviews', 'GET');
      return response.interviews || [];
    }
  });

  // Create new interview session
  const createInterviewMutation = useMutation({
    mutationFn: async (interviewData: any) => {
      return apiRequest('/api/interviews', 'POST', interviewData);
    },
    onSuccess: (data) => {
      toast({
        title: "Interview Created",
        description: "New interview session has been created successfully.",
      });
      setShowCreateDialog(false);
      setNewInterview({
        candidateName: "",
        roleTitle: "",
        interviewerName: "",
        jobTitle: "",
        seniorityLevel: "Mid",
        techStack: "",
        roleType: "Coding"
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: "Failed to create interview session. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Create next round
  const createNextRoundMutation = useMutation({
    mutationFn: async ({ interviewId, candidateId }: { interviewId: string; candidateId: string }) => {
      return apiRequest('/api/interviews/next-round', 'POST', { interviewId, candidateId });
    },
    onSuccess: (data) => {
      toast({
        title: "Next Round Created",
        description: "New interview round has been scheduled.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to Create Round",
        description: "Could not create next round. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Filter interviews based on search and status
  const filteredInterviews = interviews.filter((interview: InterviewSession) => {
    const matchesSearch = interview.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         interview.roleTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         interview.interviewerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || interview.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateInterview = () => {
    if (!newInterview.candidateName || !newInterview.roleTitle || !newInterview.interviewerName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    createInterviewMutation.mutate(newInterview);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Scheduled': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Interview Dashboard</h1>
              <p className="text-gray-600 mt-2">Manage and review all interview sessions</p>
            </div>
            
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-violet-600 hover:bg-violet-700">
                  <Plus className="h-4 w-4 mr-2" />
                  New Interview
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Interview</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="candidateName">Candidate Name *</Label>
                    <Input
                      id="candidateName"
                      placeholder="Enter candidate's full name"
                      value={newInterview.candidateName}
                      onChange={(e) => setNewInterview({...newInterview, candidateName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roleTitle">Role Title *</Label>
                    <Input
                      id="roleTitle"
                      placeholder="e.g., Frontend Engineer"
                      value={newInterview.roleTitle}
                      onChange={(e) => setNewInterview({...newInterview, roleTitle: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interviewerName">Interviewer Name *</Label>
                    <Input
                      id="interviewerName"
                      placeholder="Enter interviewer's name"
                      value={newInterview.interviewerName}
                      onChange={(e) => setNewInterview({...newInterview, interviewerName: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="seniorityLevel">Seniority</Label>
                      <Select value={newInterview.seniorityLevel} onValueChange={(value) => setNewInterview({...newInterview, seniorityLevel: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Junior">Junior</SelectItem>
                          <SelectItem value="Mid">Mid</SelectItem>
                          <SelectItem value="Senior">Senior</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="roleType">Interview Type</Label>
                      <Select value={newInterview.roleType} onValueChange={(value) => setNewInterview({...newInterview, roleType: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Coding">Coding</SelectItem>
                          <SelectItem value="Behavioral">Behavioral</SelectItem>
                          <SelectItem value="System Design">System Design</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="techStack">Tech Stack</Label>
                    <Input
                      id="techStack"
                      placeholder="e.g., React, TypeScript, Node.js"
                      value={newInterview.techStack}
                      onChange={(e) => setNewInterview({...newInterview, techStack: e.target.value})}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateInterview} disabled={createInterviewMutation.isPending}>
                      {createInterviewMutation.isPending ? "Creating..." : "Create Interview"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{interviews.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {interviews.filter((i: InterviewSession) => i.status === 'Completed').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {interviews.filter((i: InterviewSession) => i.status === 'In Progress').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {interviews.filter((i: InterviewSession) => {
                  const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                  return i.timestamp > weekAgo;
                }).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by candidate name, role, or interviewer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Interviews Table */}
        <Card>
          <CardHeader>
            <CardTitle>Interview Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading interviews...</div>
            ) : filteredInterviews.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No interviews found matching your criteria
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Interviewer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInterviews.map((interview: InterviewSession) => (
                    <TableRow key={interview.id}>
                      <TableCell className="font-medium">{interview.candidateName}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{interview.roleTitle}</div>
                          {interview.jobContext && (
                            <div className="text-sm text-gray-500">
                              {interview.jobContext.seniorityLevel} • {interview.jobContext.roleType}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">Round {interview.roundNumber}</Badge>
                      </TableCell>
                      <TableCell>{interview.interviewerName}</TableCell>
                      <TableCell>{formatDate(interview.timestamp)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(interview.status)}>
                          {interview.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {interview.overallScore ? (
                          <div className="flex items-center">
                            <span className="font-medium">{interview.overallScore}/10</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link href={`/interview/${interview.id}/review`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {interview.status === 'Completed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => createNextRoundMutation.mutate({
                                interviewId: interview.id,
                                candidateId: interview.candidateId
                              })}
                              disabled={createNextRoundMutation.isPending}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}