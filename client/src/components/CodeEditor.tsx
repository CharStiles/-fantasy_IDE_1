import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { indentWithTab } from "@codemirror/commands";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { linter, lintGutter } from "@codemirror/lint";
import { glsl } from "@nuskey8/codemirror-lang-glsl";

// Extend window type to include nodeSystem
declare global {
  interface Window {
    nodeSystem?: any;
  }
}

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  language: "javascript" | "wgsl";
}

// GLSL linter function for CodeMirror 6
function glslLinter(view: EditorView) {
  const found = [];
  
  // Use the ShaderManager's last compilation errors if available
  if (window.nodeSystem && window.nodeSystem.shaderManager) {
    const errors = window.nodeSystem.shaderManager.lastCompilationErrors || [];
    
    for (const error of errors) {
      if (error && Number(error.line) > 0) {
        const lineNum = Number(error.line) - 1; // Convert to 0-based indexing
        const start = Math.max(0, Number(error.character) - 1);
        const end = start + 1;
        
        found.push({
          from: view.state.doc.line(lineNum).from + start,
          to: view.state.doc.line(lineNum).from + end,
          message: error.message,
          severity: "error" as const
        });
      }
    }
  }
  
  return found;
}


export function CodeEditor({ code, onChange, language }: CodeEditorProps) {
  const editor = useRef<EditorView>();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    const startState = EditorState.create({
      doc: code,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        vscodeDark,
        lintGutter(),
        language === "javascript" ? javascript() : glsl(),
        language === "wgsl" ? linter(glslLinter) : [],
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      ],
    });

    editor.current = new EditorView({
      state: startState,
      parent: container.current,
    });

    return () => editor.current?.destroy();
  }, [container.current, language]);

  // Update editor content when code prop changes
  useEffect(() => {
    if (editor.current && editor.current.state.doc.toString() !== code) {
      editor.current.dispatch({
        changes: {
          from: 0,
          to: editor.current.state.doc.length,
          insert: code
        }
      });
    }
  }, [code]);

  return (
    <div 
      ref={container} 
      className="h-full w-full overflow-auto bg-[#1E1E1E] text-white rounded-md"
    />
  );
}