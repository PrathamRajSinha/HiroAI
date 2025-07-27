import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInterviewRoom } from '@/hooks/useFirestore';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { Clock, MessageCircle, Code, Mic, ChevronRight, ChevronDown, Eye, EyeOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionData {
  id: string;
  question: string;
  questionType: string;
  difficulty: string;
  timestamp: number;
  status: 'not_sent' | 'sent' | 'answered' | 'evaluated';
  transcript?: string;
  code?: string;
  analysis?: any;
}

interface QuestionTimelineProps {
  roomId: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function QuestionTimeline({ roomId, isCollapsed, onToggleCollapse }: QuestionTimelineProps) {
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  // Listen to questions collection
  useEffect(() => {
    if (!roomId) return;

    const questionsRef = collection(db, 'interviews', roomId, 'questions');
    const q = query(questionsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const questionsData = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          question: data.question || '',
          questionType: data.questionType || 'General',
          difficulty: data.difficulty || 'Medium',
          timestamp: data.timestamp || Date.now(),
          status: data.status || 'not_sent',
          transcript: data.transcript || '',
          code: data.code || '',
          analysis: data.analysis || null
        } as QuestionData;
      });

      const sortedQuestions = questionsData.sort((a, b) => b.timestamp - a.timestamp);
      setQuestions(sortedQuestions);
    }, (error) => {
      console.error('Error listening to questions:', error);
    });

    return unsubscribe;
  }, [roomId]);

  const toggleExpanded = (questionId: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedQuestions(newExpanded);
  };

  const updateQuestionStatus = async (questionId: string, newStatus: QuestionData['status']) => {
    try {
      const questionRef = doc(db, 'interviews', roomId, 'questions', questionId);
      await updateDoc(questionRef, {
        status: newStatus,
        statusUpdated: Date.now()
      });
    } catch (error) {
      console.error('Error updating question status:', error);
    }
  };

  const getStatusIcon = (status: QuestionData['status']) => {
    switch (status) {
      case 'not_sent':
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
      case 'sent':
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'answered':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'evaluated':
        return <CheckCircle className="h-4 w-4 text-violet-600" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: QuestionData['status']) => {
    switch (status) {
      case 'not_sent':
        return 'bg-gray-100 text-gray-700';
      case 'sent':
        return 'bg-blue-100 text-blue-700';
      case 'answered':
        return 'bg-green-100 text-green-700';
      case 'evaluated':
        return 'bg-violet-100 text-violet-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white border-l border-gray-200 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-100"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="mt-4 writing-mode-vertical-rl text-xs text-gray-500 font-medium">
          Timeline
        </div>
        {questions.length > 0 && (
          <Badge variant="secondary" className="mt-2 text-xs">
            {questions.length}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-violet-600" />
            <h3 className="font-semibold text-gray-900">Question Timeline</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="p-2 hover:bg-gray-100"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary" className="text-xs">
            {questions.length} Questions
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {questions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <div className="text-sm">No questions yet</div>
              <div className="text-xs mt-1">Questions will appear here as they're generated</div>
            </div>
          ) : (
            questions.map((question, index) => (
              <Card key={question.id} className={cn(
                "transition-all duration-200",
                expandedQuestions.has(question.id) ? "ring-2 ring-violet-200" : ""
              )}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(question.status)}
                      <div className="text-xs text-gray-500">
                        #{questions.length - index} • {formatTimestamp(question.timestamp)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-xs", getStatusColor(question.status))}>
                        {question.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(question.id)}
                        className="p-1 h-6 w-6"
                      >
                        {expandedQuestions.has(question.id) ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {question.questionType}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {question.difficulty}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="text-sm text-gray-700 mb-3 line-clamp-2">
                    {question.question}
                  </div>

                  {expandedQuestions.has(question.id) && (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border">
                        {question.question}
                      </div>

                      {question.transcript && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4 text-green-600" />
                            <span className="text-xs font-medium text-gray-700">Transcript</span>
                          </div>
                          <div className="text-xs text-gray-600 bg-green-50 p-3 rounded-lg border">
                            {question.transcript}
                          </div>
                        </div>
                      )}

                      {question.code && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Code className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-medium text-gray-700">Code</span>
                          </div>
                          <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded-lg border font-mono">
                            <pre className="whitespace-pre-wrap">{question.code}</pre>
                          </div>
                        </div>
                      )}

                      {question.analysis && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-violet-600" />
                            <span className="text-xs font-medium text-gray-700">AI Analysis</span>
                          </div>
                          <div className="text-xs text-gray-600 bg-violet-50 p-3 rounded-lg border">
                            {typeof question.analysis === 'string' ? question.analysis : JSON.stringify(question.analysis, null, 2)}
                          </div>
                        </div>
                      )}

                      <Separator />

                      <div className="flex gap-2">
                        {question.status === 'not_sent' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuestionStatus(question.id, 'sent')}
                            className="text-xs"
                          >
                            Mark as Sent
                          </Button>
                        )}
                        {question.status === 'sent' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuestionStatus(question.id, 'answered')}
                            className="text-xs"
                          >
                            Mark as Answered
                          </Button>
                        )}
                        {question.status === 'answered' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuestionStatus(question.id, 'evaluated')}
                            className="text-xs bg-violet-50 text-violet-700 hover:bg-violet-100"
                          >
                            Mark as Evaluated
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}