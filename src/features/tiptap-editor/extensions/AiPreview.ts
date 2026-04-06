import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { AiPreviewComponent } from '../components/AiPreviewComponent';

export interface AiPreviewOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiPreview: {
      /**
       * Add an AI preview block
       */
      setAiPreview: (options: { originalContent: string; blockId: string; newContent?: string }) => ReturnType;
      /**
       * Update AI preview content during streaming
       */
      updateAiPreviewContent: (options: { id: string; content: string }) => ReturnType;
      /**
       * Remove AI preview and restore original
       */
      removeAiPreview: (id: string) => ReturnType;
      /**
       * Accept AI preview and replace original
       */
      acceptAiPreview: (id: string) => ReturnType;
    };
  }
}

export const AiPreview = Node.create<AiPreviewOptions>({
  name: 'aiPreview',

  group: 'block',

  content: 'inline*',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'ai-preview-block',
      },
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
      },
      originalContent: {
        default: '',
      },
      newContent: {
        default: '',
      },
      blockId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="ai-preview"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'ai-preview' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AiPreviewComponent);
  },

  addCommands() {
    return {
      setAiPreview:
        options =>
        ({ commands, tr }) => {
          const id = `ai-preview-${Date.now()}`;
          return commands.insertContent({
            type: this.name,
            attrs: {
              id,
              originalContent: options.originalContent,
              newContent: options.newContent || '',
              blockId: options.blockId,
            },
          });
        },
      
      updateAiPreviewContent:
        options =>
        ({ tr, state }) => {
          let pos = -1;
          state.doc.descendants((node, p) => {
            if (node.type.name === this.name && node.attrs.id === options.id) {
              pos = p;
              return false;
            }
          });

          if (pos !== -1) {
            tr.setNodeMarkup(pos, undefined, {
              ...state.doc.nodeAt(pos)?.attrs,
              newContent: options.content,
            });
            return true;
          }
          return false;
        },

      removeAiPreview:
        id =>
        ({ tr, state, dispatch }) => {
           let pos = -1;
           let originalContent = '';
           let nodeSize = 0;
           
           state.doc.descendants((node, p) => {
             if (node.type.name === this.name && node.attrs.id === id) {
               pos = p;
               originalContent = node.attrs.originalContent;
               nodeSize = node.nodeSize;
               return false;
             }
           });

           if (pos !== -1 && dispatch) {
             tr.delete(pos, pos + nodeSize);
             // Since it's a wrapper over the original block, we might not need to re-insert original if we didn't delete it
             // But if we replaced the block, we need to insert the original content back
             if (originalContent) {
                 tr.insert(pos, state.schema.nodeFromJSON(JSON.parse(originalContent)));
             }
             return true;
           }
           return false;
        },

      acceptAiPreview:
        id =>
        ({ tr, state, dispatch }) => {
           let pos = -1;
           let newContent = '';
           let nodeSize = 0;
           
           state.doc.descendants((node, p) => {
             if (node.type.name === this.name && node.attrs.id === id) {
               pos = p;
               newContent = node.attrs.newContent;
               nodeSize = node.nodeSize;
               return false;
             }
           });

           if (pos !== -1 && dispatch) {
             tr.delete(pos, pos + nodeSize);
             // We need a proper way to insert HTML content or nodes. For now, assuming newContent is HTML or text.
             // This might require a different approach depending on how newContent is structured.
             return true;
           }
           return false;
        }
    };
  },
});