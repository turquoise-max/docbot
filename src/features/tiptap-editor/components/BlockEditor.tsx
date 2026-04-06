import React, { forwardRef, useImperativeHandle } from 'react';
import { EditorContent } from '@tiptap/react';
import { useBlockEditor } from '../hooks/useBlockEditor';

interface BlockEditorProps {
  initialContent?: string;
  onSelectionChange?: (selectedText: string) => void;
}

export interface BlockEditorRef {
  replaceBlock: (blockId: string, newContent: string) => boolean;
  getHTML: () => string | undefined;
}

export const BlockEditor = forwardRef<BlockEditorRef, BlockEditorProps>(({ initialContent, onSelectionChange }, ref) => {
  const { editor, replaceBlock } = useBlockEditor({
    initialContent,
    onSelectionChange,
  });

  useImperativeHandle(ref, () => ({
    replaceBlock,
    getHTML: () => editor?.getHTML(),
  }));

  if (!editor) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden min-h-[500px]">
      <EditorContent editor={editor} />
    </div>
  );
});

BlockEditor.displayName = 'BlockEditor';