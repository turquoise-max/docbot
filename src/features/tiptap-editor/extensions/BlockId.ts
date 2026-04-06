import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { v4 as uuidv4 } from 'uuid';

export const BlockId = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'table', 'tableRow', 'tableCell', 'tableHeader'],
        attributes: {
          blockId: {
            default: null,
            parseHTML: element => element.getAttribute('data-block-id'),
            renderHTML: attributes => {
              if (!attributes.blockId) {
                return {};
              }
              return {
                'data-block-id': attributes.blockId,
              };
            },
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockId'),
        appendTransaction: (transactions, oldState, newState) => {
          const docChanges = transactions.some(transaction => transaction.docChanged) && !oldState.doc.eq(newState.doc);

          if (!docChanges) {
            return;
          }

          const { tr } = newState;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (node.isBlock && !node.attrs.blockId) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                blockId: uuidv4(),
              });
              modified = true;
            }
          });

          if (modified) {
            return tr;
          }
          return undefined;
        },
      }),
    ];
  },
});