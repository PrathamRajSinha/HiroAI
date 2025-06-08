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

function Router() {
  return (
    <Switch>
      <Route path="/" component={CreateInterview} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/interview/:roomId" component={InterviewRoom} />
      <Route path="/interview/:id/review" component={InterviewReview} />
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
