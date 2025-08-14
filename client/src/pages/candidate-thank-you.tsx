import React, { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Heart, Star, Calendar, Mail, Linkedin } from 'lucide-react';

export function CandidateThankYou() {
  const [match, params] = useRoute('/candidate/:roomId/thank-you');
  const [currentTime, setCurrentTime] = useState(new Date());
  const roomId = params?.roomId;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!roomId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="text-red-600 mb-2">Invalid Interview Link</div>
            <div className="text-sm text-gray-600">The interview link appears to be invalid.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-blue-50">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-32 h-32 bg-violet-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-32 w-24 h-24 bg-blue-200 rounded-full opacity-20 animate-pulse delay-300"></div>
        <div className="absolute bottom-32 left-1/3 w-40 h-40 bg-purple-200 rounded-full opacity-20 animate-pulse delay-700"></div>
        <div className="absolute bottom-20 right-20 w-28 h-28 bg-indigo-200 rounded-full opacity-20 animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="max-w-2xl mx-auto text-center">
          {/* Success Icon */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6 animate-bounce">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Star className="h-6 w-6 text-yellow-500 animate-pulse" />
              <Star className="h-6 w-6 text-yellow-500 animate-pulse delay-100" />
              <Star className="h-6 w-6 text-yellow-500 animate-pulse delay-200" />
              <Star className="h-6 w-6 text-yellow-500 animate-pulse delay-300" />
              <Star className="h-6 w-6 text-yellow-500 animate-pulse delay-400" />
            </div>
          </div>

          {/* Main Content */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
            <CardContent className="p-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Thank You!
              </h1>
              
              <div className="text-xl text-gray-700 mb-6">
                Your interview has been completed successfully
              </div>

              <div className="text-gray-600 mb-8 space-y-3">
                <p>
                  We appreciate the time you took to participate in our interview process. 
                  Your responses and feedback are valuable to us.
                </p>
                <p>
                  Our team will review your interview and get back to you with next steps 
                  within the next few business days.
                </p>
              </div>

              {/* Status Cards */}
              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <div className="text-sm font-medium text-green-800">Interview Complete</div>
                  <div className="text-xs text-green-600">All questions answered</div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <Heart className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <div className="text-sm font-medium text-blue-800">Feedback Submitted</div>
                  <div className="text-xs text-blue-600">Thank you for your input</div>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <Calendar className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                  <div className="text-sm font-medium text-purple-800">Next Steps</div>
                  <div className="text-xs text-purple-600">We'll be in touch soon</div>
                </div>
              </div>

              {/* Interview Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="text-sm text-gray-600 mb-2">Interview Session Details</div>
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Session ID: {roomId}</div>
                  <div>Completed: {currentTime.toLocaleString()}</div>
                  <div>Platform: Hiro.ai Interview Platform</div>
                </div>
              </div>

              {/* What's Next */}
              <div className="text-left bg-violet-50 border border-violet-200 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-violet-900 mb-3">What happens next?</h3>
                <ul className="text-sm text-violet-800 space-y-2">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-violet-600 rounded-full mt-2 flex-shrink-0"></div>
                    Our team will review your interview responses and technical assessments
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-violet-600 rounded-full mt-2 flex-shrink-0"></div>
                    You'll receive an email update within 2-3 business days
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-violet-600 rounded-full mt-2 flex-shrink-0"></div>
                    If selected, we'll schedule the next round of interviews
                  </li>
                </ul>
              </div>

              {/* Contact Information */}
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-4">
                  Have questions? Feel free to reach out to us:
                </div>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" size="sm" className="text-xs">
                    <Mail className="h-3 w-3 mr-1" />
                    Contact HR
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs">
                    <Linkedin className="h-3 w-3 mr-1" />
                    Connect
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-8 text-center">
            <div className="text-sm text-gray-500 mb-2">
              Powered by <span className="font-semibold text-violet-600">Hiro.ai</span>
            </div>
            <div className="text-xs text-gray-400">
              Intelligent Interview Platform
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CandidateThankYou;