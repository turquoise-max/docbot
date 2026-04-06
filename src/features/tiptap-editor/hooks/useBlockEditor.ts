import { useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { BlockId } from '../extensions/BlockId';
import { AiPreview } from '../extensions/AiPreview';
import { SlashCommand, getSuggestionOptions } from '../extensions/SlashCommand';
import { Heading1, Heading2, Heading3, List, ListOrdered, Table as TableIcon } from 'lucide-react';

interface UseBlockEditorProps {
  initialContent?: string;
  onSelectionChange?: (selectedText: string) => void;
}

export const useBlockEditor = ({ initialContent = '', onSelectionChange }: UseBlockEditorProps = {}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      BlockId,
      AiPreview,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      SlashCommand.configure({
        suggestion: getSuggestionOptions([
          {
            title: '제목 1',
            description: '가장 큰 제목을 추가합니다.',
            icon: Heading1,
            command: ({ editor, range }) => {
              editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
            },
          },
          {
            title: '제목 2',
            description: '중간 크기의 제목을 추가합니다.',
            icon: Heading2,
            command: ({ editor, range }) => {
              editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
            },
          },
          {
            title: '제목 3',
            description: '작은 크기의 제목을 추가합니다.',
            icon: Heading3,
            command: ({ editor, range }) => {
              editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
            },
          },
          {
            title: '글머리 기호',
            description: '글머리 기호 목록을 생성합니다.',
            icon: List,
            command: ({ editor, range }) => {
              editor.chain().focus().deleteRange(range).toggleBulletList().run();
            },
          },
          {
            title: '번호 매기기',
            description: '번호가 매겨진 목록을 생성합니다.',
            icon: ListOrdered,
            command: ({ editor, range }) => {
              editor.chain().focus().deleteRange(range).toggleOrderedList().run();
            },
          },
          {
            title: '표 삽입',
            description: '3x3 표를 삽입합니다.',
            icon: TableIcon,
            command: ({ editor, range }) => {
              editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            },
          },
        ]),
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none max-w-none',
      },
    },
    onSelectionUpdate: ({ editor }) => {
      if (onSelectionChange) {
        const { state } = editor;
        const { selection } = state;
        if (!selection.empty) {
          const selectedText = state.doc.textBetween(selection.from, selection.to, ' ');
          onSelectionChange(selectedText);
        } else {
          onSelectionChange('');
        }
      }
    },
  });

  const replaceBlock = (blockId: string, newContent: string) => {
    if (!editor) return false;

    let targetPos = -1;
    let targetNodeSize = 0;

    editor.state.doc.descendants((node, pos) => {
      if (node.attrs.blockId === blockId) {
        targetPos = pos;
        targetNodeSize = node.nodeSize;
        return false; // Stop iterating once found
      }
    });

    if (targetPos !== -1) {
      editor.chain().focus().deleteRange({ from: targetPos, to: targetPos + targetNodeSize }).insertContentAt(targetPos, newContent).run();
      return true;
    }

    return false;
  };

  return {
    editor,
    replaceBlock,
  };
};