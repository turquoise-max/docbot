import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { CommandItem } from '../extensions/SlashCommand';

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

export const CommandList = forwardRef((props: CommandListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 p-2 bg-white rounded-md shadow-lg border border-gray-200 max-h-[300px] overflow-y-auto w-64 z-50">
      {props.items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            className={`flex items-center gap-2 p-2 rounded-md text-sm text-left w-full hover:bg-gray-100 transition-colors ${
              index === selectedIndex ? 'bg-gray-100 text-blue-600' : 'text-gray-700'
            }`}
            key={index}
            onClick={() => selectItem(index)}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-white border border-gray-200 shadow-sm">
              <Icon size={16} />
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{item.title}</span>
              <span className="text-xs text-gray-500">{item.description}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
});

CommandList.displayName = 'CommandList';