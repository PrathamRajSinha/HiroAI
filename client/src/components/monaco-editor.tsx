import { useEffect, useRef } from "react";

declare global {
  interface Window {
    monaco: any;
    require: any;
  }
}

interface MonacoEditorProps {
  defaultValue?: string;
  value?: string;
  language?: string;
  theme?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export function MonacoEditor({
  defaultValue = `// Welcome to the Interview Code Editor
// This is where you can write and test code during the interview

function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10));

// Feel free to modify this code or write your own!`,
  value,
  language = "javascript",
  theme = "vs",
  readOnly = false,
  onChange,
}: MonacoEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoInstance = useRef<any>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    // Load Monaco Editor from CDN
    const script = document.createElement("script");
    script.src = "https://unpkg.com/monaco-editor@0.44.0/min/vs/loader.js";
    script.onload = () => {
      window.require.config({
        paths: { vs: "https://unpkg.com/monaco-editor@0.44.0/min/vs" },
      });

      window.require(["vs/editor/editor.main"], () => {
        if (editorRef.current && !monacoInstance.current) {
          monacoInstance.current = window.monaco.editor.create(
            editorRef.current,
            {
              value: value || defaultValue,
              language,
              theme,
              automaticLayout: true,
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              roundedSelection: false,
              scrollBeyondLastLine: false,
              readOnly,
            }
          );

          // Set up onChange listener
          if (onChange) {
            monacoInstance.current.onDidChangeModelContent(() => {
              const value = monacoInstance.current.getValue();
              onChange(value);
            });
          }
        }
      });
    };

    // Only add script if it doesn't exist
    if (!document.querySelector('script[src*="monaco-editor"]')) {
      document.head.appendChild(script);
    }

    // Cleanup
    return () => {
      if (monacoInstance.current) {
        monacoInstance.current.dispose();
        monacoInstance.current = null;
      }
    };
  }, [defaultValue, language, theme, readOnly, onChange]);

  // Handle value updates
  useEffect(() => {
    if (monacoInstance.current && value !== undefined) {
      const currentValue = monacoInstance.current.getValue();
      if (currentValue !== value) {
        monacoInstance.current.setValue(value);
      }
    }
  }, [value]);

  useEffect(() => {
    const handleResize = () => {
      if (monacoInstance.current) {
        monacoInstance.current.layout();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return <div ref={editorRef} className="h-full w-full" />;
}
