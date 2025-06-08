import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, getDoc, collection, addDoc, query, orderBy, getDocs } from "firebase/firestore";
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

export interface QuestionHistory {
  id: string;
  question: string;
  questionType: string;
  difficulty: string;
  timestamp: number;
  candidateResponse?: string;
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

  return {
    data,
    loading,
    error,
    updateQuestion,
    updateSummary,
    updateCode,
    getQuestionHistory,
  };
}