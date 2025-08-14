# Hiro.ai Technical Interview Platform

## Overview
A cutting-edge technical interview platform that transforms hiring processes through intelligent, interactive AI-powered tools and comprehensive candidate assessment technologies.

## Project Architecture
- **Frontend**: React with TypeScript, Tailwind CSS, Wouter routing
- **Backend**: Express.js with TypeScript
- **Database**: Firestore (Firebase) for persistent storage
- **AI Integration**: Google Gemini AI for intelligent question generation and code evaluation
- **Real-time Features**: WebSocket for code synchronization and video calls
- **Styling**: Tailwind CSS with custom Hiro.ai branding (violet theme)

## Key Features

### 1. **Dashboard & Interview Management**
- Complete interview session tracking with status monitoring
- Interview statistics and analytics
- Session filtering and search capabilities
- Interview history with detailed timelines

### 2. **Smart Question Generation**
- AI-powered question generation using Google Gemini
- **Custom Topic Input**: Interviewers can specify focus areas (e.g., "React useEffect", "customer escalation")
- Multiple question types: Coding, Behavioral, System Design, Data Structures
- Difficulty levels: Easy, Medium, Hard
- Context-aware questions based on job requirements

### 3. **Real-time Code Collaboration**
- Monaco Editor integration for professional coding experience
- Live code synchronization between interviewer and candidate
- Syntax highlighting and auto-completion
- Role-based editing permissions

### 4. **AI-Powered Code Assessment**
- Intelligent code evaluation with detailed scoring
- Performance metrics: correctness, efficiency, quality, readability
- Comprehensive feedback with improvement suggestions
- Automated summary generation

### 5. **Multi-source Profile Analysis**
- **Resume Upload**: PDF parsing and question generation from resume content
- **GitHub Integration**: Repository analysis for technical question generation
- **LinkedIn Profile**: Professional background-based question creation
- Profile-specific question recommendations

### 6. **Interview Room Features**
- Clean, professional interview interface
- Real-time video calling capabilities
- Tabbed navigation for different information sources
- Question history tracking
- Live code feedback and evaluation

### 7. **Performance Analytics & AI Scorecard**
- **Real-time Performance Sidebar**: Live candidate insights for interviewers
- **AI Score Breakdown**: Detailed metrics for correctness, efficiency, code quality, and readability
- **Aggregated Analytics**: Overall performance tracking across all questions
- **Strengths & Weaknesses Analysis**: AI-identified candidate capabilities and improvement areas
- **Question-by-Question Tracking**: Individual question performance with collapsible details
- **Live Firestore Sync**: Real-time updates as candidates answer questions

### 8. **Advanced Reporting & Analytics**
- Comprehensive interview reports with candidate scoring
- PDF export functionality for interview summaries
- Email integration for automated report distribution
- Historical performance tracking

### 9. **Branding & User Experience**
- Custom Hiro.ai branding with violet color scheme
- Responsive design for all device types
- Professional logo integration
- Modern, intuitive user interface

## User Preferences
- Clean, professional interface design
- Violet (#7C3AED) primary color scheme
- Custom topic functionality for targeted questioning
- Real-time collaboration capabilities

## Recent Changes
- **January 2025**: Decoupled question generation from submission workflow - questions are now generated into preview state before sending to candidates
- **January 2025**: Added generatedQuestion state variable to hold AI-generated questions for review before submission
- **January 2025**: Updated Current Question card to show generated questions with "Generated (Not Sent)" badge vs "Sent to Candidate" status
- **January 2025**: Modified sendToCandidateMutation to use generatedQuestion state and only save to Firestore when explicitly sent
- **January 2025**: Enhanced question generation flow - generates to preview, then requires explicit send action
- **January 2025**: Added comprehensive Performance Sidebar (AI Scorecard) for real-time candidate insights
- **January 2025**: Implemented live AI score tracking with correctness, efficiency, quality, and readability metrics
- **January 2025**: Created aggregated performance analytics with strengths and weaknesses analysis
- **January 2025**: Added question-by-question score breakdown in collapsible interface
- **January 2025**: Integrated Firestore real-time sync for live performance updates
- **January 2025**: Added candidate consent screen with privacy & recording notice before interview room access
- **January 2025**: Implemented consent tracking in Firestore with IP address logging and timestamp
- **January 2025**: Created comprehensive Templates system for storing and reusing job configurations
- **January 2025**: Built Clone Interview feature for duplicating completed interview setups
- **January 2025**: Enhanced create-interview page with detailed job context and question preferences
- **January 2025**: Integrated TemplateManager component with save/load functionality
- **January 2025**: Added comprehensive "Mark Interview as Completed" functionality
- **January 2025**: Implemented AI-powered final summary generation combining code quality, verbal transcripts, and profile insights
- **January 2025**: Added interviewer feedback collection system with manual notes and hire/no hire decisions
- **January 2025**: Created CompletedInterviewView for displaying final interview results and summaries
- **January 2025**: Integrated interview completion workflow with status tracking and Firestore persistence
- **January 2025**: Added "Send to Candidate" feature with real-time Firestore sync
- **January 2025**: Implemented Live Questions panel for candidates with real-time updates
- **January 2025**: Added custom topic input field for question generation
- **January 2025**: Enhanced backend API to support topic-focused questions
- **January 2025**: Implemented topic highlighting in generated questions
- **January 2025**: Complete Hiro.ai rebranding with violet theme
- **January 2025**: Logo integration and favicon implementation
- **January 2025**: Added comprehensive candidate exit interview system with detailed feedback collection
- **January 2025**: Created candidate thank you page with animated UI and next steps information
- **January 2025**: Implemented candidate feedback API endpoint with Firestore integration
- **January 2025**: Added exit interview button to candidate interface for easy access to feedback form
- **January 2025**: Enhanced interview completion flow with PDF download functionality using client-side generation
- **January 2025**: Completely refactored PDF report generation with comprehensive candidate answers, AI scores, and detailed question-by-question analysis
- **January 2025**: Added interview statistics dashboard to PDF reports showing response rates, evaluation coverage, and average scores
- **January 2025**: Enhanced PDF report structure with separate sections for verbal responses and code solutions
- **January 2025**: Improved latest code analysis integration in PDF reports with complete AI feedback display