import JSZip from 'jszip';
import { mapRunProperties, mapParagraphProperties, mapTableProperties, mapTableCellProperties, extractPageMargins } from './style-mapper';

export interface ParseResult {
  html: string;
  margins: { top: string; right: string; bottom: string; left: string };
}

export async function parseDocx(buffer: ArrayBuffer): Promise<ParseResult> {
  const zip = await JSZip.loadAsync(buffer);
  
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error('word/document.xml not found');

  const parser = new DOMParser();
  const doc = parser.parseFromString(documentXml, 'application/xml');

  let html = '';
  const body = doc.querySelector('body');
  
  if (body) {
      for (const node of Array.from(body.children)) {
          if (node.tagName === 'w:p') {
              html += parseParagraph(node);
          } else if (node.tagName === 'w:tbl') {
              html += parseTable(node);
          }
      }
  }

  const sectPr = body?.querySelector('sectPr');
  const margins = extractPageMargins(sectPr || null);

  return { html, margins };
}

function parseParagraph(p: Element): string {
    const pPr = p.querySelector('pPr');
    const pStyle = pPr?.querySelector('pStyle')?.getAttribute('w:val');
    const styles = mapParagraphProperties(pPr);
    
    let innerHtml = '';
    for (const run of Array.from(p.querySelectorAll('r'))) {
        innerHtml += parseRun(run);
    }

    // Determine tag based on style (simple heuristic)
    let tag = 'p';
    let extraStyles = styles;
    
    if (pStyle?.startsWith('Heading1') || pStyle === 'Title') {
        tag = 'h1';
        if (!extraStyles.includes('font-size')) extraStyles += ' font-size: 24pt;';
        if (!extraStyles.includes('font-weight')) extraStyles += ' font-weight: bold;';
    } else if (pStyle?.startsWith('Heading2')) {
        tag = 'h2';
    } else if (pStyle?.startsWith('Heading3')) {
        tag = 'h3';
    }

    return `<${tag} style="${extraStyles}">${innerHtml || '<br/>'}</${tag}>`;
}

function parseRun(r: Element): string {
    const rPr = r.querySelector('rPr');
    const styles = mapRunProperties(rPr);
    let text = '';
    
    for (const node of Array.from(r.children)) {
        if (node.tagName === 'w:t') {
            text += node.textContent || '';
        } else if (node.tagName === 'w:tab') {
            text += '&emsp;';
        } else if (node.tagName === 'w:br') {
            text += '<br/>';
        }
    }
    
    if (!text) return '';
    
    if (styles) {
        return `<span style="${styles}">${escapeHtml(text)}</span>`;
    }
    return escapeHtml(text);
}

function parseTable(tbl: Element): string {
    const tblPr = tbl.querySelector('tblPr');
    const styles = mapTableProperties(tblPr);
    
    let html = `<table style="${styles}"><tbody>`;
    for (const tr of Array.from(tbl.querySelectorAll('tr'))) {
        html += '<tr>';
        for (const tc of Array.from(tr.querySelectorAll('tc'))) {
            const tcPr = tc.querySelector('tcPr');
            const tcStyles = mapTableCellProperties(tcPr);
            html += `<td style="${tcStyles}">`;
            
            for (const node of Array.from(tc.children)) {
                if (node.tagName === 'w:p') {
                    html += parseParagraph(node);
                } else if (node.tagName === 'w:tbl') {
                    html += parseTable(node); // nested table
                }
            }
            html += '</td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

function escapeHtml(unsafe: string): string {
    return unsafe
         .replace(/&/g, '&' + 'amp;')
         .replace(/</g, '&' + 'lt;')
         .replace(/>/g, '&' + 'gt;')
         .replace(/"/g, '&' + 'quot;')
         .replace(/'/g, '&' + '#039;');
}
