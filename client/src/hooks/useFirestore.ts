import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface InterviewData {
  question?: string;
  summary?: string;
  questionType?: string;
  difficulty?: string;
  timestamp?: number;
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
      const docRef = doc(db, "interviews", roomId);
      await setDoc(docRef, {
        question,
        questionType,
        difficulty,
        timestamp: Date.now(),
      }, { merge: true });
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

  return {
    data,
    loading,
    error,
    updateQuestion,
    updateSummary,
  };
}