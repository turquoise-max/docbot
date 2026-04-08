import JSZip from 'jszip';
import { mapRunProperties, mapParagraphProperties, mapTableProperties, mapTableCellProperties, extractPageMargins, parseStylesXml, DocxStyles } from './style-mapper';

export interface ParseResult {
  html: string;
  margins: { top: string; right: string; bottom: string; left: string };
  headerHtml?: string;
  footerHtml?: string;
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

  // 3. Extract Images (Media)
  const images: Record<string, string> = {};
  const relsXmlString = await zip.file('word/_rels/document.xml.rels')?.async('string');
  if (relsXmlString) {
      const relsDoc = parser.parseFromString(relsXmlString, 'application/xml');
      const relationships = relsDoc.querySelectorAll('Relationship');
      
      for (const rel of Array.from(relationships)) {
          const type = rel.getAttribute('Type');
          const target = rel.getAttribute('Target');
          const id = rel.getAttribute('Id');
          
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
  let headerHtml = '';
  const headerXmlString = await zip.file('word/header1.xml')?.async('string');
  if (headerXmlString) {
      const headerDoc = parser.parseFromString(headerXmlString, 'application/xml');
      headerHtml = parseContainer(headerDoc.documentElement, globalStyles, images);
  }

  let footerHtml = '';
  const footerXmlString = await zip.file('word/footer1.xml')?.async('string');
  if (footerXmlString) {
      const footerDoc = parser.parseFromString(footerXmlString, 'application/xml');
      footerHtml = parseContainer(footerDoc.documentElement, globalStyles, images);
  }

  // 5. Build Main HTML
  let html = '';
  const body = doc.querySelector('body');
  
  if (body) {
      // Create a filtered body that excludes header/footer references if needed,
      // but usually parseContainer already ignores header/footer nodes because it looks for w:p, w:tbl, w:sdt.
      // However, sometimes headers leak through sectPr or other tags inside body.
      // We explicitly parse only the direct children that are content.
      for (const node of Array.from(body.children)) {
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

  const sectPr = body?.querySelector('sectPr');
  const margins = extractPageMargins(sectPr || null);

  return { html, margins, headerHtml, footerHtml };
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
        if (!extraStyles.includes('font-size')) extraStyles += ' font-size: 32pt;';
        if (!extraStyles.includes('font-weight')) extraStyles += ' font-weight: bold;';
    } else if (pStyleId?.startsWith('Heading1')) {
        tag = 'h1';
        if (!extraStyles.includes('font-size')) extraStyles += ' font-size: 24pt;';
        if (!extraStyles.includes('font-weight')) extraStyles += ' font-weight: bold;';
    } else if (pStyleId?.startsWith('Heading2')) {
        tag = 'h2';
        if (!extraStyles.includes('font-size')) extraStyles += ' font-size: 18pt;';
        if (!extraStyles.includes('font-weight')) extraStyles += ' font-weight: bold;';
    } else if (pStyleId?.startsWith('Heading3')) {
        tag = 'h3';
        if (!extraStyles.includes('font-size')) extraStyles += ' font-size: 14pt;';
        if (!extraStyles.includes('font-weight')) extraStyles += ' font-weight: bold;';
    }

    return `<${tag} style="${extraStyles}">${innerHtml || '<br/>'}</${tag}>`;
}

function parseRun(r: Element, pStyleId?: string, globalStyles?: DocxStyles, images?: Record<string, string>): string {
    const rPr = r.querySelector('rPr');
    const styles = mapRunProperties(rPr, pStyleId, globalStyles);
    let html = '';
    
    for (const node of Array.from(r.children)) {
        if (node.tagName === 'w:t') {
            html += escapeHtml(node.textContent || '');
        } else if (node.tagName === 'w:tab') {
            html += '&emsp;';
        } else if (node.tagName === 'w:br') {
            html += '<br/>';
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
