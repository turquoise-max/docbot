import React from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Check, X } from 'lucide-react';

export const AiPreviewComponent = (props: NodeViewProps) => {
  const { node, updateAttributes, editor } = props;
  const { id, originalContent, newContent, blockId } = node.attrs;

  const handleAccept = () => {
    // In a real scenario, newContent could be HTML, and we'd want to insert it correctly
    // Since we need to replace the preview block with the new content
    const pos = props.getPos();
    if (typeof pos === 'number') {
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).insertContentAt(pos, newContent || ' ').run();
    }
  };

  const handleReject = () => {
    editor.commands.removeAiPreview(id);
    
    // We should also abort the stream here if possible. 
    // Usually, the abort controller is managed at the hook/component level that initiated the stream.
    // For this, we can dispatch a custom event that the parent can listen to.
    window.dispatchEvent(new CustomEvent('ai-preview-rejected', { detail: { id, blockId } }));
  };

  return (
    <NodeViewWrapper className="ai-preview-wrapper relative my-2 rounded-lg border-2 border-blue-400 bg-blue-50/50 p-4 transition-all">
      <div className="absolute right-2 top-2 flex gap-2">
        <button
          onClick={handleAccept}
          className="flex items-center justify-center rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700 shadow-sm"
          title="수락"
        >
          <Check size={16} />
        </button>
        <button
          onClick={handleReject}
          className="flex items-center justify-center rounded-md bg-white border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 shadow-sm"
          title="거절 (스트리밍 중단)"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mb-2 text-xs font-bold text-blue-700">AI 수정 미리보기</div>
      
      <div className="mt-2 text-gray-800" dangerouslySetInnerHTML={{ __html: newContent || '<span class="text-gray-400">생성 중...</span>' }} />
      
      {/* For reference, showing the original content semi-transparent */}
      {originalContent && (
        <div className="mt-4 border-t border-blue-200 pt-2 opacity-50 text-sm">
          <div className="mb-1 text-xs font-semibold text-gray-500">원본:</div>
          <div dangerouslySetInnerHTML={{ __html: originalContent }} />
        </div>
      )}
    </NodeViewWrapper>
  );
};