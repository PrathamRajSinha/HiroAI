import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, getDoc, collection, addDoc, query, orderBy, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface InterviewData {
  question?: string;
  summary?: string;
  questionType?: string;
  difficulty?: string;
  code?: string;
  lastUpdatedBy?: 'interviewer' | 'candidate';
  timestamp?: number;
}

export interface JobContext {
  jobTitle: string;
  techStack: string;
  seniorityLevel: 'Junior' | 'Mid' | 'Senior';
  roleType: 'Coding' | 'Behavioral' | 'System Design';
  timestamp?: number;
}

export interface CodeFeedback {
  summary: string;
  scores: {
    correctness: number;
    relevance: number;
    efficiency: number;
    quality: number;
    readability: number;
    overall: number;
  };
  fullExplanation: string;
  suggestion?: string;
  scoreNote?: string;
}

export interface QuestionHistory {
  id: string;
  question: string;
  questionType: string;
  difficulty: string;
  timestamp: number;
  candidateCode?: string;
  aiFeedback?: CodeFeedback;
}

export function useInterviewRoom(roomId: string) {
  const [data, setData] = useState<InterviewData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, "interviews", roomId);
    
    const unsubscribe = onSnapshot(
      docRef,
      (doc) => {
        if (doc.exists()) {
          setData(doc.data() as InterviewData);
        } else {
          setData({});
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Firestore error:", err);
        setError("Failed to sync with Firebase");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [roomId]);

  const updateQuestion = async (question: string, questionType: string, difficulty: string) => {
    if (!roomId) return;

    try {
      const timestamp = Date.now();
      
      // Update current question
      const docRef = doc(db, "interviews", roomId);
      await setDoc(docRef, {
        question,
        questionType,
        difficulty,
        timestamp,
      }, { merge: true });

      // Add to history
      const historyRef = collection(db, "interviews", roomId, "history");
      await addDoc(historyRef, {
        question,
        questionType,
        difficulty,
        timestamp,
      });
    } catch (err) {
      console.error("Error updating question:", err);
      setError("Failed to save question");
    }
  };

  const updateSummary = async (summary: string) => {
    if (!roomId) return;

    try {
      const docRef = doc(db, "interviews", roomId);
      await setDoc(docRef, {
        summary,
        timestamp: Date.now(),
      }, { merge: true });
    } catch (err) {
      console.error("Error updating summary:", err);
      setError("Failed to save summary");
    }
  };

  const updateCode = async (code: string, userRole: 'interviewer' | 'candidate') => {
    if (!roomId) return;

    try {
      const docRef = doc(db, "interviews", roomId);
      await setDoc(docRef, {
        code,
        lastUpdatedBy: userRole,
        timestamp: Date.now(),
      }, { merge: true });
    } catch (err) {
      console.error("Error updating code:", err);
      setError("Failed to save code");
    }
  };

  const getQuestionHistory = async (): Promise<QuestionHistory[]> => {
    if (!roomId) return [];

    try {
      const historyRef = collection(db, "interviews", roomId, "history");
      const q = query(historyRef, orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as QuestionHistory));
    } catch (err) {
      console.error("Error fetching question history:", err);
      return [];
    }
  };

  const updateQuestionWithCode = async (questionId: string, candidateCode: string, aiFeedback?: CodeFeedback) => {
    if (!roomId) return;

    try {
      const questionRef = doc(db, "interviews", roomId, "history", questionId);
      const updateData: Partial<QuestionHistory> = { candidateCode };
      
      if (aiFeedback) {
        updateData.aiFeedback = aiFeedback;
      }
      
      await updateDoc(questionRef, updateData);
    } catch (err) {
      console.error("Error updating question with code:", err);
      throw err;
    }
  };

  const saveJobContext = async (jobContext: JobContext) => {
    if (!roomId) return;

    try {
      const docRef = doc(db, "interviews", roomId);
      await setDoc(docRef, {
        jobContext: {
          ...jobContext,
          timestamp: Date.now(),
        },
      }, { merge: true });
    } catch (err) {
      console.error("Error saving job context:", err);
      setError("Failed to save job context");
    }
  };

  const getJobContext = async (): Promise<JobContext | null> => {
    if (!roomId) return null;

    try {
      const docRef = doc(db, "interviews", roomId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists() && docSnap.data().jobContext) {
        return docSnap.data().jobContext as JobContext;
      }
      return null;
    } catch (err) {
      console.error("Error fetching job context:", err);
      return null;
    }
  };

  return {
    data,
    loading,
    error,
    updateQuestion,
    updateSummary,
    updateCode,
    getQuestionHistory,
    updateQuestionWithCode,
    saveJobContext,
    getJobContext,
  };
}