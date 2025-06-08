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

    let isEditorCreated = false;

    const initializeEditor = () => {
      if (editorRef.current && !monacoInstance.current && !isEditorCreated) {
        isEditorCreated = true;
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
    };

    // Check if Monaco is already loaded
    if (window.monaco) {
      initializeEditor();
    } else {
      // Load Monaco Editor from CDN
      const existingScript = document.querySelector('script[src*="monaco-editor"]');
      
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/monaco-editor@0.44.0/min/vs/loader.js";
        script.onload = () => {
          window.require.config({
            paths: { vs: "https://unpkg.com/monaco-editor@0.44.0/min/vs" },
          });

          window.require(["vs/editor/editor.main"], () => {
            initializeEditor();
          });
        };
        document.head.appendChild(script);
      } else {
        // Script exists, wait for it to load
        const checkMonaco = setInterval(() => {
          if (window.monaco) {
            clearInterval(checkMonaco);
            initializeEditor();
          }
        }, 100);
      }
    }

    // Cleanup only when component unmounts
    return () => {
      if (monacoInstance.current) {
        monacoInstance.current.dispose();
        monacoInstance.current = null;
      }
    };
  }, []); // Remove dependencies to prevent re-initialization

  // Handle value updates
  useEffect(() => {
    if (monacoInstance.current && value !== undefined) {
      const currentValue = monacoInstance.current.getValue();
      if (currentValue !== value) {
        monacoInstance.current.setValue(value);
      }
    }
  }, [value]);

  // Handle language and theme updates
  useEffect(() => {
    if (monacoInstance.current) {
      const model = monacoInstance.current.getModel();
      if (model) {
        window.monaco.editor.setModelLanguage(model, language);
      }
    }
  }, [language]);

  useEffect(() => {
    if (monacoInstance.current) {
      monacoInstance.current.updateOptions({ theme });
    }
  }, [theme]);

  useEffect(() => {
    if (monacoInstance.current) {
      monacoInstance.current.updateOptions({ readOnly });
    }
  }, [readOnly]);

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
