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

### 7. **Advanced Reporting & Analytics**
- Comprehensive interview reports with candidate scoring
- PDF export functionality for interview summaries
- Email integration for automated report distribution
- Historical performance tracking

### 8. **Branding & User Experience**
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
- **January 2025**: Added "Send to Candidate" feature with real-time Firestore sync
- **January 2025**: Implemented Live Questions panel for candidates with real-time updates
- **January 2025**: Added custom topic input field for question generation
- **January 2025**: Enhanced backend API to support topic-focused questions
- **January 2025**: Implemented topic highlighting in generated questions
- **January 2025**: Complete Hiro.ai rebranding with violet theme
- **January 2025**: Logo integration and favicon implementation