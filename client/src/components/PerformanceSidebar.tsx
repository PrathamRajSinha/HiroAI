import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronRight, 
  ChevronDown, 
  Award, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Target,
  Brain,
  CheckCircle,
  XCircle,
  Zap,
  Code,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AIFeedback {
  scores: {
    correctness: number;
    efficiency: number;
    quality: number;
    readability: number;
    overall: number;
  };
  feedback: string;
  suggestions: string;
  strengths: string[];
  weaknesses: string[];
}

interface QuestionScore {
  id: string;
  question: string;
  questionType: string;
  difficulty: string;
  timestamp: number;
  aiFeedback?: AIFeedback;
}

interface PerformanceSidebarProps {
  roomId: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function PerformanceSidebar({ roomId, isCollapsed, onToggleCollapse }: PerformanceSidebarProps) {
  const [questionScores, setQuestionScores] = useState<QuestionScore[]>([]);
  const [overallScores, setOverallScores] = useState({
    correctness: 0,
    efficiency: 0,
    quality: 0,
    readability: 0,
    overall: 0
  });
  const [aggregatedStrengths, setAggregatedStrengths] = useState<string[]>([]);
  const [aggregatedWeaknesses, setAggregatedWeaknesses] = useState<string[]>([]);

  // Listen to real-time updates from Firestore
  useEffect(() => {
    if (!roomId || !db) return;

    const unsubscribe = onSnapshot(
      doc(db, 'interviews', roomId),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const questions = data.questions || [];
          
          // Filter questions that have AI feedback
          const scoredQuestions = questions
            .filter((q: any) => q.aiFeedback)
            .map((q: any) => ({
              id: q.id || `question-${Date.now()}`,
              question: q.question,
              questionType: q.questionType || 'General',
              difficulty: q.difficulty || 'Medium',
              timestamp: q.timestamp || Date.now(),
              aiFeedback: q.aiFeedback
            }));

          setQuestionScores(scoredQuestions);
          calculateAggregatedScores(scoredQuestions);
        }
      },
      (error) => {
        console.error('Error listening to performance updates:', error);
      }
    );

    return () => unsubscribe();
  }, [roomId]);

  const calculateAggregatedScores = (scores: QuestionScore[]) => {
    if (scores.length === 0) {
      setOverallScores({
        correctness: 0,
        efficiency: 0,
        quality: 0,
        readability: 0,
        overall: 0
      });
      setAggregatedStrengths([]);
      setAggregatedWeaknesses([]);
      return;
    }

    // Calculate averages
    const totals = scores.reduce((acc, score) => {
      if (score.aiFeedback) {
        acc.correctness += score.aiFeedback.scores.correctness;
        acc.efficiency += score.aiFeedback.scores.efficiency;
        acc.quality += score.aiFeedback.scores.quality;
        acc.readability += score.aiFeedback.scores.readability;
        acc.overall += score.aiFeedback.scores.overall;
      }
      return acc;
    }, { correctness: 0, efficiency: 0, quality: 0, readability: 0, overall: 0 });

    const averages = {
      correctness: Math.round(totals.correctness / scores.length),
      efficiency: Math.round(totals.efficiency / scores.length),
      quality: Math.round(totals.quality / scores.length),
      readability: Math.round(totals.readability / scores.length),
      overall: Math.round(totals.overall / scores.length)
    };

    setOverallScores(averages);

    // Aggregate strengths and weaknesses
    const allStrengths: string[] = [];
    const allWeaknesses: string[] = [];

    scores.forEach(score => {
      if (score.aiFeedback) {
        allStrengths.push(...(score.aiFeedback.strengths || []));
        allWeaknesses.push(...(score.aiFeedback.weaknesses || []));
      }
    });

    // Get most common strengths and weaknesses
    const strengthCounts = allStrengths.reduce((acc, strength) => {
      acc[strength] = (acc[strength] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const weaknessCounts = allWeaknesses.reduce((acc, weakness) => {
      acc[weakness] = (acc[weakness] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topStrengths = Object.entries(strengthCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([strength]) => strength);

    const topWeaknesses = Object.entries(weaknessCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([weakness]) => weakness);

    setAggregatedStrengths(topStrengths);
    setAggregatedWeaknesses(topWeaknesses);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 8) return 'bg-green-100';
    if (score >= 6) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white border-l border-gray-200 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="mb-4 h-8 w-8 p-0"
          title="Expand AI Scorecard"
        >
          <BarChart3 className="h-4 w-4" />
        </Button>
        {questionScores.length > 0 && (
          <div className="text-center">
            <div className="text-lg font-bold text-violet-600">{overallScores.overall}</div>
            <div className="text-xs text-gray-500">Overall</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-600" />
            <h3 className="font-semibold text-gray-900">AI Scorecard</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Overall Performance Summary */}
          {questionScores.length > 0 ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Award className="h-4 w-4 text-violet-600" />
                    Overall Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-violet-600 mb-1">
                      {overallScores.overall}/10
                    </div>
                    <div className="text-xs text-gray-500">Average Score</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Correctness
                      </span>
                      <span className={cn("text-xs font-medium", getScoreColor(overallScores.correctness))}>
                        {overallScores.correctness}/10
                      </span>
                    </div>
                    <Progress value={overallScores.correctness * 10} className="h-1" />

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Efficiency
                      </span>
                      <span className={cn("text-xs font-medium", getScoreColor(overallScores.efficiency))}>
                        {overallScores.efficiency}/10
                      </span>
                    </div>
                    <Progress value={overallScores.efficiency * 10} className="h-1" />

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <Code className="h-3 w-3" />
                        Quality
                      </span>
                      <span className={cn("text-xs font-medium", getScoreColor(overallScores.quality))}>
                        {overallScores.quality}/10
                      </span>
                    </div>
                    <Progress value={overallScores.quality * 10} className="h-1" />

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Readability
                      </span>
                      <span className={cn("text-xs font-medium", getScoreColor(overallScores.readability))}>
                        {overallScores.readability}/10
                      </span>
                    </div>
                    <Progress value={overallScores.readability * 10} className="h-1" />
                  </div>
                </CardContent>
              </Card>

              {/* Strengths & Weaknesses */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-violet-600" />
                    Key Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {aggregatedStrengths.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        <span className="text-xs font-medium text-green-700">Strengths</span>
                      </div>
                      <div className="space-y-1">
                        {aggregatedStrengths.map((strength, index) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-green-100 text-green-700">
                            {strength}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {aggregatedWeaknesses.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="h-3 w-3 text-red-600" />
                        <span className="text-xs font-medium text-red-700">Areas for Improvement</span>
                      </div>
                      <div className="space-y-1">
                        {aggregatedWeaknesses.map((weakness, index) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-red-100 text-red-700">
                            {weakness}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Question Breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="h-4 w-4 text-violet-600" />
                    Question Breakdown ({questionScores.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {questionScores.map((questionScore, index) => (
                    <Collapsible key={questionScore.id}>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between w-full p-2 rounded-lg border hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            <ChevronRight className="h-3 w-3 text-gray-400" />
                            <span className="text-xs font-medium">Q{index + 1}</span>
                            <Badge variant="outline" className="text-xs">
                              {questionScore.questionType}
                            </Badge>
                          </div>
                          <div className={cn(
                            "text-xs font-bold px-2 py-1 rounded-full",
                            getScoreBgColor(questionScore.aiFeedback?.scores.overall || 0),
                            getScoreColor(questionScore.aiFeedback?.scores.overall || 0)
                          )}>
                            {questionScore.aiFeedback?.scores.overall || 0}/10
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 ml-4 space-y-2">
                        {questionScore.aiFeedback && (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="text-xs">
                                <span className="text-gray-500">Correctness: </span>
                                <span className={getScoreColor(questionScore.aiFeedback.scores.correctness)}>
                                  {questionScore.aiFeedback.scores.correctness}/10
                                </span>
                              </div>
                              <div className="text-xs">
                                <span className="text-gray-500">Efficiency: </span>
                                <span className={getScoreColor(questionScore.aiFeedback.scores.efficiency)}>
                                  {questionScore.aiFeedback.scores.efficiency}/10
                                </span>
                              </div>
                              <div className="text-xs">
                                <span className="text-gray-500">Quality: </span>
                                <span className={getScoreColor(questionScore.aiFeedback.scores.quality)}>
                                  {questionScore.aiFeedback.scores.quality}/10
                                </span>
                              </div>
                              <div className="text-xs">
                                <span className="text-gray-500">Readability: </span>
                                <span className={getScoreColor(questionScore.aiFeedback.scores.readability)}>
                                  {questionScore.aiFeedback.scores.readability}/10
                                </span>
                              </div>
                            </div>
                            
                            {questionScore.aiFeedback.feedback && (
                              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                {questionScore.aiFeedback.feedback}
                              </div>
                            )}
                          </>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-900 mb-2">No Performance Data Yet</h3>
                <p className="text-xs text-gray-500">
                  AI scores will appear here as the candidate answers questions and receives feedback.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}