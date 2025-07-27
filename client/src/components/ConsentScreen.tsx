import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Mic, Video, FileText, Users } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import hiroLogo from "@assets/logo hiro_1749550404647.png";

interface ConsentScreenProps {
  roomId: string;
  onConsentGiven: () => void;
}

export function ConsentScreen({ roomId, onConsentGiven }: ConsentScreenProps) {
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const { toast } = useToast();

  const consentMutation = useMutation({
    mutationFn: () => apiRequest('/api/interviews/consent', 'POST', {
      roomId,
      consentGiven: true,
      timestamp: Date.now()
    }),
    onSuccess: () => {
      toast({
        title: "Consent Recorded",
        description: "Thank you for your consent. Proceeding to interview room...",
      });
      onConsentGiven();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record consent",
        variant: "destructive",
      });
    }
  });

  const handleConsent = () => {
    if (!hasReadTerms) {
      toast({
        title: "Please Confirm",
        description: "Please confirm that you have read and understood the terms",
        variant: "destructive",
      });
      return;
    }
    
    consentMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <img 
              src={hiroLogo} 
              alt="Hiro.ai Logo" 
              className="w-12 h-12"
            />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Interview Consent</h1>
          <p className="text-muted-foreground">
            Before we begin, please review and accept the following terms
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Privacy & Recording Notice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Information Cards */}
            <div className="grid gap-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Video className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-1">Video & Audio Recording</h3>
                  <p className="text-sm text-muted-foreground">
                    This interview may include video calls and audio recording for evaluation purposes. 
                    Your video/audio will only be accessible to authorized personnel involved in the hiring process.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Mic className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-1">Speech Transcription</h3>
                  <p className="text-sm text-muted-foreground">
                    Your verbal responses may be transcribed using AI technology to assist with evaluation 
                    and provide consistent feedback across candidates.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-1">Data Usage</h3>
                  <p className="text-sm text-muted-foreground">
                    Interview data will be used solely for evaluation, internal feedback, and improving 
                    our interview process. Data is securely stored and not shared with external parties.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-1">Access & Confidentiality</h3>
                  <p className="text-sm text-muted-foreground">
                    Only authorized hiring team members and necessary AI systems will have access to your 
                    interview data. All information is treated as confidential.
                  </p>
                </div>
              </div>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Your rights:</strong> You may request access to your data or ask questions about our 
                data handling practices. Contact the hiring team if you have concerns about privacy or data usage.
              </AlertDescription>
            </Alert>

            {/* Consent Checkbox */}
            <div className="flex items-start space-x-3 p-4 bg-accent/10 rounded-lg border border-accent/20">
              <Checkbox
                id="consent-terms"
                checked={hasReadTerms}
                onCheckedChange={(checked) => setHasReadTerms(checked as boolean)}
                className="mt-1"
              />
              <label 
                htmlFor="consent-terms" 
                className="text-sm text-foreground leading-relaxed cursor-pointer"
              >
                I have read and understood the above information regarding recording, transcription, 
                and data usage. I consent to participate in this interview under these terms.
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <Button
                onClick={handleConsent}
                disabled={!hasReadTerms || consentMutation.isPending}
                className="flex-1"
                size="lg"
              >
                {consentMutation.isPending ? "Processing..." : "I Understand & Continue"}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="px-8"
                size="lg"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Powered by Hiro.ai • Secure Interview Platform</p>
        </div>
      </div>
    </div>
  );
}