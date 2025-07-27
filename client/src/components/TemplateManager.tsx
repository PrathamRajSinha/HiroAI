import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Plus, Download, Save, Trash2, Copy, Star, Clock, User } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { InterviewTemplate, CreateTemplate } from '../../../shared/template-schema';

interface TemplateManagerProps {
  onLoadTemplate?: (template: InterviewTemplate) => void;
  currentJobContext?: any;
  onSaveAsTemplate?: () => void;
}

export function TemplateManager({ onLoadTemplate, currentJobContext, onSaveAsTemplate }: TemplateManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<InterviewTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState<Partial<CreateTemplate>>({
    name: '',
    description: '',
    jobTitle: '',
    seniorityLevel: 'Mid',
    roleType: 'Fullstack',
    techStack: '',
    department: '',
    commonTopics: [],
    defaultQuestionType: 'Coding',
    defaultDifficulty: 'Medium',
    isPublic: false
  });
  const { toast } = useToast();

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/templates'],
    queryFn: () => apiRequest('/api/templates', 'GET')
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: (template: CreateTemplate) => apiRequest('/api/templates', 'POST', template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      setIsCreateDialogOpen(false);
      setNewTemplate({
        name: '',
        description: '',
        jobTitle: '',
        seniorityLevel: 'Mid',
        roleType: 'Fullstack',
        techStack: '',
        department: '',
        commonTopics: [],
        defaultQuestionType: 'Coding',
        defaultDifficulty: 'Medium',
        isPublic: false
      });
      toast({
        title: "Success",
        description: "Template created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create template",
        variant: "destructive",
      });
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => apiRequest(`/api/templates/${templateId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        variant: "destructive",
      });
    }
  });

  // Load current job context as template
  const loadCurrentAsTemplate = () => {
    if (currentJobContext) {
      setNewTemplate({
        name: `${currentJobContext.jobTitle} Template`,
        description: `Template for ${currentJobContext.jobTitle} interviews`,
        jobTitle: currentJobContext.jobTitle || '',
        seniorityLevel: currentJobContext.seniorityLevel || 'Mid',
        roleType: currentJobContext.roleType || 'Fullstack',
        techStack: currentJobContext.techStack || '',
        department: currentJobContext.department || '',
        commonTopics: [],
        defaultQuestionType: 'Coding',
        defaultDifficulty: 'Medium',
        isPublic: false
      });
      setIsCreateDialogOpen(true);
    }
  };

  const handleCreateTemplate = () => {
    if (!newTemplate.name?.trim() || !newTemplate.jobTitle?.trim() || !newTemplate.techStack?.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createTemplateMutation.mutate(newTemplate as CreateTemplate);
  };

  const handleLoadTemplate = (template: InterviewTemplate) => {
    if (onLoadTemplate) {
      onLoadTemplate(template);
      setIsLoadDialogOpen(false);
      toast({
        title: "Template Loaded",
        description: `${template.name} has been applied to the interview setup`,
      });
    }
  };

  const handleTopicAdd = (topic: string) => {
    if (topic.trim() && !newTemplate.commonTopics?.includes(topic.trim())) {
      setNewTemplate(prev => ({
        ...prev,
        commonTopics: [...(prev.commonTopics || []), topic.trim()]
      }));
    }
  };

  const handleTopicRemove = (index: number) => {
    setNewTemplate(prev => ({
      ...prev,
      commonTopics: prev.commonTopics?.filter((_, i) => i !== index) || []
    }));
  };

  return (
    <div className="flex gap-2">
      {/* Load Template Button */}
      <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Load Template
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Load Interview Template
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="h-96 w-full">
            {templatesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <div className="text-sm">No templates available</div>
                <div className="text-xs mt-1">Create your first template to get started</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template: InterviewTemplate) => (
                  <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm font-semibold">{template.name}</CardTitle>
                          {template.description && (
                            <div className="text-xs text-gray-500 mt-1">{template.description}</div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {template.isPublic && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Public
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          {template.seniorityLevel} {template.jobTitle}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {template.roleType}
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-gray-600">
                        <div><strong>Tech Stack:</strong> {template.techStack}</div>
                        <div><strong>Default:</strong> {template.defaultQuestionType} ({template.defaultDifficulty})</div>
                      </div>

                      {template.commonTopics && template.commonTopics.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-gray-700 mb-1">Common Topics:</div>
                          <div className="flex flex-wrap gap-1">
                            {template.commonTopics.slice(0, 3).map((topic, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {topic}
                              </Badge>
                            ))}
                            {template.commonTopics.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{template.commonTopics.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {new Date(template.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => handleLoadTemplate(template)}
                            className="bg-violet-600 hover:bg-violet-700 text-xs px-3 py-1 h-7"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Load
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
                            className="text-red-600 hover:bg-red-50 text-xs px-2 py-1 h-7"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Save as Template Button */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" onClick={loadCurrentAsTemplate}>
            <Save className="h-4 w-4 mr-2" />
            Save Template
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create Interview Template
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="h-96 w-full pr-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="templateName">Template Name *</Label>
                  <Input
                    id="templateName"
                    placeholder="e.g., Senior React Developer"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title *</Label>
                  <Input
                    id="jobTitle"
                    placeholder="e.g., Senior Frontend Developer"
                    value={newTemplate.jobTitle}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, jobTitle: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of when to use this template"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Seniority Level</Label>
                  <Select 
                    value={newTemplate.seniorityLevel} 
                    onValueChange={(value: any) => setNewTemplate(prev => ({ ...prev, seniorityLevel: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Entry">Entry Level</SelectItem>
                      <SelectItem value="Mid">Mid Level</SelectItem>
                      <SelectItem value="Senior">Senior Level</SelectItem>
                      <SelectItem value="Staff">Staff Level</SelectItem>
                      <SelectItem value="Principal">Principal Level</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role Type</Label>
                  <Select 
                    value={newTemplate.roleType} 
                    onValueChange={(value: any) => setNewTemplate(prev => ({ ...prev, roleType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Frontend">Frontend</SelectItem>
                      <SelectItem value="Backend">Backend</SelectItem>
                      <SelectItem value="Fullstack">Fullstack</SelectItem>
                      <SelectItem value="DevOps">DevOps</SelectItem>
                      <SelectItem value="Data Science">Data Science</SelectItem>
                      <SelectItem value="Mobile">Mobile</SelectItem>
                      <SelectItem value="QA">QA</SelectItem>
                      <SelectItem value="Product Manager">Product Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="techStack">Tech Stack *</Label>
                <Input
                  id="techStack"
                  placeholder="e.g., React, TypeScript, Node.js, PostgreSQL"
                  value={newTemplate.techStack}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, techStack: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  placeholder="e.g., Engineering, Product"
                  value={newTemplate.department}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, department: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Question Type</Label>
                  <Select 
                    value={newTemplate.defaultQuestionType} 
                    onValueChange={(value: any) => setNewTemplate(prev => ({ ...prev, defaultQuestionType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Coding">Coding</SelectItem>
                      <SelectItem value="Algorithm">Algorithm</SelectItem>
                      <SelectItem value="System Design">System Design</SelectItem>
                      <SelectItem value="Data Structures">Data Structures</SelectItem>
                      <SelectItem value="Behavioral">Behavioral</SelectItem>
                      <SelectItem value="Technical Knowledge">Technical Knowledge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Difficulty</Label>
                  <Select 
                    value={newTemplate.defaultDifficulty} 
                    onValueChange={(value: any) => setNewTemplate(prev => ({ ...prev, defaultDifficulty: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Easy">Easy</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Common Topics</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a topic and press Enter"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleTopicAdd(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        if (input?.value) {
                          handleTopicAdd(input.value);
                          input.value = '';
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {newTemplate.commonTopics && newTemplate.commonTopics.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newTemplate.commonTopics.map((topic, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {topic}
                          <button
                            onClick={() => handleTopicRemove(index)}
                            className="ml-2 text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTemplate}
              disabled={createTemplateMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}