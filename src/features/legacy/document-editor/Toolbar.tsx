import React from 'react';

export function Toolbar() {
  const handleCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  return (
    <div className="flex items-center gap-1 p-2 bg-white border-b border-gray-200">
      <button 
        onClick={() => handleCommand('bold')}
        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 font-bold w-8 h-8 flex items-center justify-center"
        title="Bold"
      >
        B
      </button>
      <button 
        onClick={() => handleCommand('italic')}
        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 italic w-8 h-8 flex items-center justify-center"
        title="Italic"
      >
        I
      </button>
      <button 
        onClick={() => handleCommand('underline')}
        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 underline w-8 h-8 flex items-center justify-center"
        title="Underline"
      >
        U
      </button>
      <button 
        onClick={() => handleCommand('strikeThrough')}
        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 line-through w-8 h-8 flex items-center justify-center"
        title="Strikethrough"
      >
        S
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1"></div>

      <button 
        onClick={() => handleCommand('justifyLeft')}
        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 w-8 h-8 flex items-center justify-center"
        title="Align Left"
      >
        L
      </button>
      <button 
        onClick={() => handleCommand('justifyCenter')}
        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 w-8 h-8 flex items-center justify-center"
        title="Align Center"
      >
        C
      </button>
      <button 
        onClick={() => handleCommand('justifyRight')}
        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 w-8 h-8 flex items-center justify-center"
        title="Align Right"
      >
        R
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1"></div>

      <button 
        onClick={() => handleCommand('insertUnorderedList')}
        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 w-8 h-8 flex items-center justify-center"
        title="Bullet List"
      >
        •
      </button>
      <button 
        onClick={() => handleCommand('insertOrderedList')}
        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 w-8 h-8 flex items-center justify-center font-mono text-sm"
        title="Numbered List"
      >
        1.
      </button>
    </div>
  );
}