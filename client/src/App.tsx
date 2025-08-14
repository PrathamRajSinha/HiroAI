import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import InterviewRoom from "@/pages/interview-room-refactored";
import CreateInterview from "@/pages/create-interview";
import Dashboard from "@/pages/dashboard";
import InterviewReview from "@/pages/interview-review";
import InterviewThread from "@/pages/interview-thread";
import CandidateExitInterview from "@/pages/candidate-exit-interview";
import CandidateThankYou from "@/pages/candidate-thank-you";

function Router() {
  return (
    <Switch>
      <Route path="/" component={CreateInterview} />
      <Route path="/create-interview" component={CreateInterview} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/interview/:roomId" component={InterviewThread} />
      <Route path="/interview/:roomId" component={InterviewRoom} />
      <Route path="/interview/:id/review" component={InterviewReview} />
      <Route path="/candidate/:roomId/exit-interview" component={CandidateExitInterview} />
      <Route path="/candidate/:roomId/thank-you" component={CandidateThankYou} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
