import { useState, useEffect, useCallback, useRef } from "react";
import { useInterviewRoom } from "./useFirestore";

interface UseCodeSyncProps {
  roomId: string;
  userRole: 'interviewer' | 'candidate';
  initialCode?: string;
}

export function useCodeSync({ roomId, userRole, initialCode = "" }: UseCodeSyncProps) {
  const [code, setCode] = useState(initialCode);
  const [isUpdating, setIsUpdating] = useState(false);
  const { data: interviewData, updateCode } = useInterviewRoom(roomId);
  
  // Track if we're currently updating to prevent infinite loops
  const isUpdatingFromFirestore = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Update local code when Firestore data changes (from other user)
  useEffect(() => {
    if (
      interviewData.code !== undefined && 
      interviewData.lastUpdatedBy !== userRole &&
      !isUpdatingFromFirestore.current
    ) {
      isUpdatingFromFirestore.current = true;
      setCode(interviewData.code);
      
      // Reset the flag after a short delay
      setTimeout(() => {
        isUpdatingFromFirestore.current = false;
      }, 100);
    }
  }, [interviewData.code, interviewData.lastUpdatedBy, userRole]);

  // Debounced function to update Firestore
  const debouncedUpdateCode = useCallback((newCode: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      if (!isUpdatingFromFirestore.current) {
        setIsUpdating(true);
        try {
          await updateCode(newCode, userRole);
        } catch (error) {
          console.error("Failed to sync code:", error);
        } finally {
          setIsUpdating(false);
        }
      }
    }, 500);
  }, [updateCode, userRole]);

  // Handle code changes from Monaco editor
  const handleCodeChange = useCallback((newCode: string) => {
    if (!isUpdatingFromFirestore.current) {
      setCode(newCode);
      debouncedUpdateCode(newCode);
    }
  }, [debouncedUpdateCode]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    code,
    isUpdating,
    handleCodeChange,
  };
}