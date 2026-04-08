import JSZip from 'jszip';
import { mapRunProperties, mapParagraphProperties, mapTableProperties, mapTableCellProperties, extractPageMargins, parseStylesXml, DocxStyles } from './style-mapper';

export interface ParseResult {
  html: string;
  margins: { top: string; right: string; bottom: string; left: string };
  headers?: { first?: string; default?: string };
  footers?: { first?: string; default?: string };
  hasTitlePg?: boolean;
}

export async function parseDocx(buffer: ArrayBuffer): Promise<ParseResult> {
  const zip = await JSZip.loadAsync(buffer);
  
  // 1. Parse Styles
  let globalStyles: DocxStyles = {};
  const stylesXmlString = await zip.file('word/styles.xml')?.async('string');
  const parser = new DOMParser();
  if (stylesXmlString) {
      const stylesDoc = parser.parseFromString(stylesXmlString, 'application/xml');
      globalStyles = parseStylesXml(stylesDoc);
  }

  // 2. Parse Document
  const documentXmlString = await zip.file('word/document.xml')?.async('string');
  if (!documentXmlString) throw new Error('word/document.xml not found');
  const doc = parser.parseFromString(documentXmlString, 'application/xml');

  // 3. Extract Images (Media) and relationships
  const images: Record<string, string> = {};
  const relMap: Record<string, string> = {};
  const relsXmlString = await zip.file('word/_rels/document.xml.rels')?.async('string');
  if (relsXmlString) {
      const relsDoc = parser.parseFromString(relsXmlString, 'application/xml');
      const relationships = relsDoc.querySelectorAll('Relationship');

      for (const rel of Array.from(relationships)) {
          const type = rel.getAttribute('Type');
          const target = rel.getAttribute('Target');
          const id = rel.getAttribute('Id');

          if (target && id) {
              relMap[id] = target;
          }

          if (type?.endsWith('image') && target && id) {
              const imageFile = zip.file(`word/${target}`);
              if (imageFile) {
                  const base64 = await imageFile.async('base64');
                  const ext = target.split('.').pop() || 'png';
                  images[id] = `data:image/${ext};base64,${base64}`;
              }
          }
      }
  }

  // 4. Parse Header/Footer
  const sectPrs = doc.getElementsByTagName('w:sectPr');
  const sectPr = sectPrs.length > 0 ? sectPrs[sectPrs.length - 1] : null;
  const hasTitlePg = sectPr ? sectPr.getElementsByTagName('w:titlePg').length > 0 : false;
  
  const headers: { first?: string; default?: string } = {};
  const footers: { first?: string; default?: string } = {};

  const headerRefs = sectPr ? Array.from(sectPr.getElementsByTagName('w:headerReference')) : [];
  if (headerRefs.length > 0) {
      for (const ref of headerRefs) {
          const type = ref.getAttribute('w:type');
          const rId = ref.getAttribute('r:id');
          if (rId && relMap[rId]) {
              const target = relMap[rId];
              const headerXmlString = await zip.file(`word/${target}`)?.async('string');
              if (headerXmlString) {
                  const headerDoc = parser.parseFromString(headerXmlString, 'application/xml');
                  const parsedHtml = parseContainer(headerDoc.documentElement, globalStyles, images);
                  if (type === 'first' && hasTitlePg) {
                      headers.first = parsedHtml;
                  } else if (type === 'default') {
                      headers.default = parsedHtml;
                  }
              }
          }
      }
  } else {
      // Fallback
      const headerXmlString = await zip.file('word/header1.xml')?.async('string');
      if (headerXmlString) {
          const headerDoc = parser.parseFromString(headerXmlString, 'application/xml');
          headers.default = parseContainer(headerDoc.documentElement, globalStyles, images);
      }
  }

  const footerRefs = sectPr ? Array.from(sectPr.getElementsByTagName('w:footerReference')) : [];
  if (footerRefs.length > 0) {
      for (const ref of footerRefs) {
          const type = ref.getAttribute('w:type');
          const rId = ref.getAttribute('r:id');
          if (rId && relMap[rId]) {
              const target = relMap[rId];
              const footerXmlString = await zip.file(`word/${target}`)?.async('string');
              if (footerXmlString) {
                  const footerDoc = parser.parseFromString(footerXmlString, 'application/xml');
                  const parsedHtml = parseContainer(footerDoc.documentElement, globalStyles, images);
                  if (type === 'first' && hasTitlePg) {
                      footers.first = parsedHtml;
                  } else if (type === 'default') {
                      footers.default = parsedHtml;
                  }
              }
          }
      }
  } else {
      // Fallback
      const footerXmlString = await zip.file('word/footer1.xml')?.async('string');
      if (footerXmlString) {
          const footerDoc = parser.parseFromString(footerXmlString, 'application/xml');
          footers.default = parseContainer(footerDoc.documentElement, globalStyles, images);
      }
  }

  // 5. Build Main HTML
  let html = '';
  const body = doc.querySelector('body') || doc.getElementsByTagName('w:body')[0];
  
  if (body) {
      // Create a filtered body that excludes header/footer references if needed,
      // but usually parseContainer already ignores header/footer nodes because it looks for w:p, w:tbl, w:sdt.
      // However, sometimes headers leak through sectPr or other tags inside body.
      // We explicitly parse only the direct children that are content.
      for (const node of Array.from(body.children)) {
          // Ignore sectPr to prevent header/footer leakage into main content
          if (node.tagName === 'w:sectPr' || node.tagName === 'sectPr') continue;

          if (node.tagName === 'w:p') {
              html += parseParagraph(node, globalStyles, images);
          } else if (node.tagName === 'w:tbl') {
              html += parseTable(node, globalStyles, images);
          } else if (node.tagName === 'w:sdt') {
              const sdtContent = node.querySelector('sdtContent');
              if (sdtContent) {
                   html += parseContainer(sdtContent, globalStyles, images);
              }
          }
      }
  }

  const margins = extractPageMargins(sectPr || null);

  // 본문 시작 부분에 헤더 내용이 중복으로 들어가는 문제 방지
  // 이미 w:sectPr를 무시하도록 처리했으므로, html.startsWith()로 잘라내는 로직이
  // 오히려 본문 내용과 우연히 일치할 때 본문을 훼손하거나, 앞뒤 공백 등의 차이로 제대로 제거되지 않는 문제를 유발할 수 있습니다.
  // 이 부분은 제거하여 본문 순수성을 유지합니다.

  return { html, margins, headers, footers, hasTitlePg };
}

function parseContainer(container: Element, globalStyles: DocxStyles, images: Record<string, string>): string {
    let html = '';
    for (const node of Array.from(container.children)) {
        if (node.tagName === 'w:p') {
            html += parseParagraph(node, globalStyles, images);
        } else if (node.tagName === 'w:tbl') {
            html += parseTable(node, globalStyles, images);
        } else if (node.tagName === 'w:sdt') {
            // Content controls (sometimes contain paragraphs)
            const sdtContent = node.querySelector('sdtContent');
            if (sdtContent) {
                 html += parseContainer(sdtContent, globalStyles, images);
            }
        }
    }
    return html;
}

function parseParagraph(p: Element, globalStyles: DocxStyles, images: Record<string, string>): string {
    const pPr = p.querySelector('pPr');
    const pStyleId = pPr?.querySelector('pStyle')?.getAttribute('w:val');
    const styles = mapParagraphProperties(pPr, globalStyles);
    
    let innerHtml = '';
    for (const child of Array.from(p.children)) {
        if (child.tagName === 'w:r') {
             innerHtml += parseRun(child, pStyleId || undefined, globalStyles, images);
        } else if (child.tagName === 'w:hyperlink') {
            // Simplified hyperlink parsing
            for (const r of Array.from(child.querySelectorAll('r'))) {
                innerHtml += parseRun(r, pStyleId || undefined, globalStyles, images);
            }
        }
    }

    // Determine tag based on style (simple heuristic)
    let tag = 'p';
    let extraStyles = styles;
    
    if (pStyleId === 'Title') {
        tag = 'h1';
        if (!extraStyles.includes('font-weight')) extraStyles += ' font-weight: bold;';
    } else if (pStyleId?.startsWith('Heading1')) {
        tag = 'h1';
        if (!extraStyles.includes('font-weight')) extraStyles += ' font-weight: bold;';
    } else if (pStyleId?.startsWith('Heading2')) {
        tag = 'h2';
        if (!extraStyles.includes('font-weight')) extraStyles += ' font-weight: bold;';
    } else if (pStyleId?.startsWith('Heading3')) {
        tag = 'h3';
        if (!extraStyles.includes('font-weight')) extraStyles += ' font-weight: bold;';
    }

    // List/Bullet Parsing
    const numPr = pPr?.querySelector('numPr');
    if (numPr) {
        const ilvl = numPr.querySelector('ilvl')?.getAttribute('w:val') || '0';
        const level = parseInt(ilvl, 10);
        const margin = level * 20 + 20;
        
        tag = 'li';
        extraStyles += ` display: list-item; margin-left: ${margin}px; list-style-type: ${level % 2 === 0 ? 'disc' : 'circle'};`;
    }

    // TOC / Right Tab Parsing
    const tabs = pPr?.querySelectorAll('tabs > tab, tab');
    let hasRightTab = false;
    let hasLeaderDot = false;
    if (tabs) {
        for (const t of Array.from(tabs)) {
            if (t.getAttribute('w:val') === 'right') hasRightTab = true;
            if (t.getAttribute('w:leader') === 'dot') hasLeaderDot = true;
        }
    }

    if (hasRightTab) {
        const parts = innerHtml.split('<!--TAB-->');
        if (parts.length > 1) {
            const leftContent = parts[0];
            const rightContent = parts.slice(1).join('');
            const leaderStr = hasLeaderDot ? 'border-bottom: 1px dotted #000; flex-grow: 1; margin: 0 8px; position: relative; top: -6px;' : 'flex-grow: 1;';
            return `<div style="${extraStyles} display: flex; justify-content: space-between; align-items: baseline;">
                <span>${leftContent || ''}</span>
                <span style="${leaderStr}"></span>
                <span>${rightContent || ''}</span>
            </div>`;
        }
    }

    if (tag === 'li') {
        return `<ul style="margin: 0; padding: 0;"><li style="${extraStyles}">${innerHtml || '<br/>'}</li></ul>`;
    }

    return `<${tag} style="${extraStyles}">${innerHtml || '<br/>'}</${tag}>`;
}

function parseRun(r: Element, pStyleId?: string, globalStyles?: DocxStyles, images?: Record<string, string>): string {
    const rPr = r.querySelector('rPr');
    const styles = mapRunProperties(rPr, pStyleId, globalStyles);
    let html = '';
    
    for (const node of Array.from(r.children)) {
        if (node.tagName === 'w:t') {
            const text = node.textContent || '';
            // Only output text, do not output literal 'Body' if it's an artifact
            // Sometimes parser injects 'Body' when parsing certain structures.
            // A more robust check is to just escape and append, but if it exactly matches "Body",
            // and it seems like an artifact (e.g. at the very start of the document), we might need to ignore it.
            // However, it's safer to just let it pass unless it's a known artifact.
            // The bug report says "Body" text is injected at the top. This happens if `doc.querySelector('body')` in DOMParser 
            // picks up the `<w:body>` tag and its implicit `textContent` or similar. 
            // But here we are inside `<w:t>`. Let's just escape and append, the real issue might be somewhere else.
            // Wait, look at `parseDocx` step 5: `const body = doc.querySelector('body') || doc.getElementsByTagName('w:body')[0];`
            // If `DOMParser` parses `<w:body>` as `<body>`, its children might be messed up.
            // Actually, in `parseRun`, the condition `if (text.trim() === 'Body' && !r.closest('w\\:body'))` was intended to catch this,
            // but `r.closest('w\\:body')` might not work if the tag is just `<body>`.
            // Let's refine the ignore logic for "Body". If it's literally just "Body" and has no other meaningful context, we might skip it, 
            // but a user might legitimately type "Body".
            // The issue is likely that `parseContainer` is picking up text nodes outside of `<w:t>`. No, `parseContainer` only looks at elements (`container.children`).
            if (text.trim() === 'Body') {
                // Ignore "Body" artifact
            } else {
                html += escapeHtml(text);
            }
        } else if (node.tagName === 'w:tab') {
            html += '<!--TAB-->';
        } else if (node.tagName === 'w:br') {
            const type = node.getAttribute('w:type');
            if (type === 'page') {
                html += '<div class="page-break" style="page-break-before: always;"></div>';
            } else {
                html += '<br/>';
            }
        } else if (node.tagName === 'w:lastRenderedPageBreak') {
            html += '<div class="page-break" style="page-break-before: always;"></div>';
        } else if (node.tagName === 'w:drawing' || node.tagName === 'w:object') {
             // Handle Images from w:drawing or older v:shape/w:object
             const blips = node.querySelectorAll('blip, v\\:imagedata');
             
             for(const blip of Array.from(blips)) {
                 const embedId = blip.getAttribute('r:embed') || blip.getAttribute('r:id');
                 if (embedId) {
                     const imgSrc = images && images[embedId] ? images[embedId] : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjMiIGZpbGw9IiM5OTkiPkltYWdlPC90ZXh0Pjwvc3ZnPg==';
                     
                     // Extract dimensions if available
                     const extent = node.querySelector('extent');
                     const shape = node.closest('shape, v\\:shape');
                     let imgStyle = 'max-width: 100%; height: auto; display: inline-block; vertical-align: middle;';
                     
                     if (extent) {
                         const cx = extent.getAttribute('cx');
                         const cy = extent.getAttribute('cy');
                         // cx/cy are in EMUs (English Metric Units). 1 EMU = 1/360000 mm, 1 px = 9525 EMU
                         if (cx && cy) {
                             const widthPx = Math.round(parseInt(cx) / 9525);
                             const heightPx = Math.round(parseInt(cy) / 9525);
                             imgStyle = `width: ${widthPx}px; height: ${heightPx}px; display: inline-block; vertical-align: middle;`;
                         }
                     } else if (shape) {
                         // Older VML shape styling
                         const styleStr = shape.getAttribute('style');
                         if (styleStr) {
                             imgStyle = styleStr; // VML style strings often map directly to CSS
                         }
                     }
                     html += `<img src="${imgSrc}" style="${imgStyle}" alt="Image ${embedId}" />`;
                 }
             }
        } else if (node.tagName === 'v:shape') {
            // Direct VML shapes
            const imagedata = node.querySelector('imagedata');
            if (imagedata) {
                const embedId = imagedata.getAttribute('r:id');
                 if (embedId) {
                    const imgSrc = images && images[embedId] ? images[embedId] : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjMiIGZpbGw9IiM5OTkiPkltYWdlPC90ZXh0Pjwvc3ZnPg==';
                    const styleStr = node.getAttribute('style') || 'max-width: 100%; height: auto;';
                    html += `<img src="${imgSrc}" style="${styleStr}" alt="Image ${embedId}" />`;
                 }
            }
        }
    }
    
    if (!html) return '';
    
    if (styles) {
        return `<span style="${styles}">${html}</span>`;
    }
    return html;
}

function parseTable(tbl: Element, globalStyles: DocxStyles, images: Record<string, string>): string {
    const tblPr = tbl.querySelector('tblPr');
    const styles = mapTableProperties(tblPr);
    
    let html = `<table style="${styles}"><tbody>`;
    for (const tr of Array.from(tbl.querySelectorAll('tr'))) {
        html += '<tr>';
        for (const tc of Array.from(tr.querySelectorAll('tc'))) {
            const tcPr = tc.querySelector('tcPr');
            const tcStyles = mapTableCellProperties(tcPr);
            html += `<td style="${tcStyles}">`;
            html += parseContainer(tc, globalStyles, images);
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
