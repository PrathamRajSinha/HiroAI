import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Plus } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface CloneInterviewButtonProps {
  interviewId: string;
  jobTitle?: string;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'default' | 'ghost';
}

export function CloneInterviewButton({ 
  interviewId, 
  jobTitle, 
  size = 'sm', 
  variant = 'outline' 
}: CloneInterviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cloneName, setCloneName] = useState(`${jobTitle ? `${jobTitle} ` : ''}Interview Clone`);
  const [cloneDescription, setCloneDescription] = useState('');
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const cloneInterviewMutation = useMutation({
    mutationFn: () => apiRequest('/api/clone-interview', 'POST', {
      interviewId,
      name: cloneName,
      description: cloneDescription
    }),
    onSuccess: (data) => {
      toast({
        title: "Interview Cloned",
        description: "Interview setup has been cloned. Creating new interview...",
      });
      
      // Navigate to create interview with template data
      const template = data.template;
      const queryParams = new URLSearchParams({
        template: JSON.stringify({
          jobTitle: template.jobTitle,
          seniorityLevel: template.seniorityLevel,
          roleType: template.roleType,
          techStack: template.techStack,
          department: template.department,
          defaultQuestionType: template.defaultQuestionType,
          defaultDifficulty: template.defaultDifficulty
        })
      });
      
      setLocation(`/create-interview?${queryParams.toString()}`);
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clone interview",
        variant: "destructive",
      });
    }
  });

  const handleClone = () => {
    if (!cloneName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a name for the cloned interview",
        variant: "destructive",
      });
      return;
    }
    
    cloneInterviewMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Copy className="h-4 w-4 mr-2" />
          Clone
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clone Interview Setup
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            This will copy the interview configuration (job details, tech stack, etc.) 
            to create a new interview. Responses and history will not be copied.
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cloneName">Interview Name *</Label>
            <Input
              id="cloneName"
              placeholder="e.g., Senior React Developer Interview"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cloneDescription">Description (Optional)</Label>
            <Textarea
              id="cloneDescription"
              placeholder="Brief description for this cloned interview setup"
              value={cloneDescription}
              onChange={(e) => setCloneDescription(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleClone}
              disabled={cloneInterviewMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {cloneInterviewMutation.isPending ? "Cloning..." : "Clone & Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}