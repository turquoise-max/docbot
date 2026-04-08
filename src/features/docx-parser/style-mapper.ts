import { twipsToPt, halfPointsToPt, twipsToPx, parseUnit } from './unit-converter';

export interface DocxStyles {
  [styleId: string]: {
    pPr?: string;
    rPr?: string;
    basedOn?: string;
  };
}

export function mapRunProperties(rPr: Element | null, styleContext?: string, globalStyles?: DocxStyles): string {
  if (!rPr && !styleContext && !globalStyles) return '';
  const styles: string[] = [];

  // Apply style context (e.g., from pStyle or rStyle)
  if (styleContext && globalStyles && globalStyles[styleContext] && globalStyles[styleContext].rPr) {
      styles.push(globalStyles[styleContext].rPr!);
  }

  // Also resolve base styles recursively (simplified)
  let currentStyleId = styleContext;
  let safetyCounter = 0;
  while (currentStyleId && globalStyles && globalStyles[currentStyleId] && globalStyles[currentStyleId].basedOn && safetyCounter < 5) {
      currentStyleId = globalStyles[currentStyleId].basedOn;
      if (currentStyleId && globalStyles[currentStyleId] && globalStyles[currentStyleId].rPr) {
          // Push base styles to the beginning so direct properties override them
          styles.unshift(globalStyles[currentStyleId].rPr!);
      }
      safetyCounter++;
  }

  // Direct Run Properties override inherited styles
  if (rPr) {
    // Bold
    const bNode = rPr.querySelector('b');
    if (bNode) {
        const val = bNode.getAttribute('w:val');
        if (val !== 'false' && val !== '0') styles.push('font-weight: bold;');
    }
    const bCsNode = rPr.querySelector('bCs');
    if (bCsNode) {
        const val = bCsNode.getAttribute('w:val');
        if (val !== 'false' && val !== '0') styles.push('font-weight: bold;');
    }

    // Italic
    const iNode = rPr.querySelector('i');
    if (iNode) {
        const val = iNode.getAttribute('w:val');
        if (val !== 'false' && val !== '0') styles.push('font-style: italic;');
    }
    const iCsNode = rPr.querySelector('iCs');
    if (iCsNode) {
        const val = iCsNode.getAttribute('w:val');
        if (val !== 'false' && val !== '0') styles.push('font-style: italic;');
    }

    // Underline
    const uNode = rPr.querySelector('u');
    if (uNode) {
      const val = uNode.getAttribute('w:val');
      if (val && val !== 'none' && val !== 'false' && val !== '0') styles.push('text-decoration: underline;');
    }

    // Strike
    const strikeNode = rPr.querySelector('strike');
    if (strikeNode) {
        const val = strikeNode.getAttribute('w:val');
        if (val !== 'false' && val !== '0') {
            // Check if there's already an underline, if so combine them
            const hasUnderline = styles.some(s => s.startsWith('text-decoration: underline'));
            if (hasUnderline) {
                const idx = styles.findIndex(s => s.startsWith('text-decoration: underline'));
                styles[idx] = 'text-decoration: underline line-through;';
            } else {
                styles.push('text-decoration: line-through;');
            }
        }
    }

    // Size
    const sz = rPr.querySelector('sz')?.getAttribute('w:val');
    if (sz) styles.push(`font-size: ${halfPointsToPt(parseUnit(sz))}pt;`);

    // Color
    const color = rPr.querySelector('color')?.getAttribute('w:val');
    const themeColor = rPr.querySelector('color')?.getAttribute('w:themeColor');
    
    if (color && color !== 'auto') {
        styles.push(`color: #${color};`);
    } else if (themeColor) {
        const mappedColor = mapThemeColor(themeColor);
        if (mappedColor) styles.push(`color: ${mappedColor};`);
    }

    // Highlight
    const highlight = rPr.querySelector('highlight')?.getAttribute('w:val');
    if (highlight && highlight !== 'none') {
        const colorMap: Record<string, string> = {
            yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff',
            blue: '#0000ff', red: '#ff0000', darkBlue: '#000080', darkCyan: '#008080',
            darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000',
            darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000'
        };
        if (colorMap[highlight]) {
            styles.push(`background-color: ${colorMap[highlight]};`);
        }
    }
    
    // Shading (background)
    const shd = rPr.querySelector('shd')?.getAttribute('w:fill');
    if (shd && shd !== 'auto') {
        styles.push(`background-color: #${shd}; border-radius: 4px; padding: 2px 4px;`);
    }
  }

  return styles.join(' ');
}

export function mapParagraphProperties(pPr: Element | null, globalStyles?: DocxStyles): string {
  if (!pPr && !globalStyles) return 'line-height: 1.15;';
  const styles: string[] = [];

  const pStyleId = pPr?.querySelector('pStyle')?.getAttribute('w:val');
  
  if (pStyleId && globalStyles && globalStyles[pStyleId]) {
      if (globalStyles[pStyleId].pPr) {
          styles.push(globalStyles[pStyleId].pPr!);
      }
      
      // Resolve base styles recursively
      let currentStyleId = pStyleId;
      let safetyCounter = 0;
      while (currentStyleId && globalStyles[currentStyleId] && globalStyles[currentStyleId].basedOn && safetyCounter < 5) {
          currentStyleId = globalStyles[currentStyleId].basedOn!;
          if (globalStyles[currentStyleId] && globalStyles[currentStyleId].pPr) {
              styles.unshift(globalStyles[currentStyleId].pPr!);
          }
          safetyCounter++;
      }
  }

  // Direct Paragraph Properties override inherited
  if (pPr) {
    // Borders
    const pBdr = pPr.querySelector('pBdr');
    if (pBdr) {
        ['top', 'left', 'bottom', 'right'].forEach(side => {
            const border = pBdr.querySelector(side);
            if (border) {
                const val = border.getAttribute('w:val');
                if (val && val !== 'none' && val !== 'nil') {
                    const sz = border.getAttribute('w:sz');
                    const color = border.getAttribute('w:color');
                    
                    let borderStyle = 'solid';
                    if (val === 'dashed') borderStyle = 'dashed';
                    else if (val === 'dotted') borderStyle = 'dotted';
                    else if (val === 'double') borderStyle = 'double';
                    
                    const width = sz ? `${Math.max(1, parseInt(sz, 10) / 8)}pt` : '1px';
                    const borderColor = color && color !== 'auto' ? `#${color}` : '#000';
                    
                    styles.push(`border-${side}: ${width} ${borderStyle} ${borderColor};`);
                }
            }
        });
    }

    // Alignment
    const jc = pPr.querySelector('jc')?.getAttribute('w:val');
    if (jc) {
      if (jc === 'both') styles.push('text-align: justify;');
      else if (jc === 'end' || jc === 'right') styles.push('text-align: right;');
      else if (jc === 'center') styles.push('text-align: center;');
      else styles.push(`text-align: left;`);
    }

    // Spacing
    const spacing = pPr.querySelector('spacing');
    if (spacing) {
      const before = spacing.getAttribute('w:before');
      if (before) styles.push(`margin-top: ${twipsToPt(parseUnit(before))}pt;`);
      
      const after = spacing.getAttribute('w:after');
      if (after) styles.push(`margin-bottom: ${twipsToPt(parseUnit(after))}pt;`);

      const line = spacing.getAttribute('w:line');
      const lineRule = spacing.getAttribute('w:lineRule');
      if (line) {
          const lineValue = parseUnit(line);
          if (lineRule === 'auto' || !lineRule) {
              // DOCX unit: 240 = 1 line
              styles.push(`line-height: ${(lineValue / 240).toFixed(2)};`);
          } else {
              styles.push(`line-height: ${twipsToPt(lineValue)}pt;`);
          }
      } else {
          // If no line spacing is specified, use DOCX standard default
          styles.push(`line-height: 1.15;`);
      }
    } else {
        styles.push(`line-height: 1.15;`);
    }

    // Indentation
    const ind = pPr.querySelector('ind');
    if (ind) {
        const left = ind.getAttribute('w:left');
        if (left) styles.push(`margin-left: ${twipsToPt(parseUnit(left))}pt;`);
        
        const right = ind.getAttribute('w:right');
        if (right) styles.push(`margin-right: ${twipsToPt(parseUnit(right))}pt;`);
        
        const firstLine = ind.getAttribute('w:firstLine');
        if (firstLine) styles.push(`text-indent: ${twipsToPt(parseUnit(firstLine))}pt;`);
    }
  }

  return styles.join(' ');
}

export function mapTableProperties(tblPr: Element | null): string {
  if (!tblPr) return 'border-collapse: collapse; width: 100%;';
  const styles: string[] = ['border-collapse: collapse;'];

  // Table Width
  const tblW = tblPr.querySelector('tblW');
  if (tblW) {
      const type = tblW.getAttribute('w:type');
      const w = tblW.getAttribute('w:w');
      if (type === 'pct') {
          styles.push(`width: ${parseUnit(w) / 50}%;`);
      } else if (type === 'dxa') {
          styles.push(`width: ${twipsToPt(parseUnit(w))}pt;`);
      } else {
          styles.push('width: 100%;');
      }
  } else {
      styles.push('width: 100%;');
  }
  
  // Alignment
  const jc = tblPr.querySelector('jc')?.getAttribute('w:val');
  if (jc === 'center') styles.push('margin-left: auto; margin-right: auto;');
  else if (jc === 'right' || jc === 'end') styles.push('margin-left: auto;');

  return styles.join(' ');
}

export function mapTableCellProperties(tcPr: Element | null): string {
    if (!tcPr) return 'border: 1px dotted #ccc; padding: 4px;';
    const styles: string[] = [];

    // Borders
    const tcBorders = tcPr.querySelector('tcBorders');
    if (tcBorders) {
        ['top', 'left', 'bottom', 'right'].forEach(side => {
            const border = tcBorders.querySelector(side);
            if (border) {
                const val = border.getAttribute('w:val');
                const sz = border.getAttribute('w:sz');
                const color = border.getAttribute('w:color');
                
                let borderStyle = 'solid';
                if (val === 'dashed') borderStyle = 'dashed';
                if (val === 'dotted') borderStyle = 'dotted';
                if (val === 'none' || val === 'nil') borderStyle = 'none';
                
                const width = sz ? `${Math.max(1, parseUnit(sz) / 8)}pt` : '1px';
                const borderColor = color && color !== 'auto' ? `#${color}` : '#000';
                
                styles.push(`border-${side}: ${width} ${borderStyle} ${borderColor};`);
            } else {
                styles.push(`border-${side}: 1px dotted #ccc;`);
            }
        });
    } else {
        styles.push('border: 1px dotted #ccc;');
    }
    
    // Margins/Padding
    const tcMar = tcPr.querySelector('tcMar');
    if (tcMar) {
        ['top', 'left', 'bottom', 'right'].forEach(side => {
            const mar = tcMar.querySelector(side);
            if (mar) {
                const w = mar.getAttribute('w:w');
                if (w) styles.push(`padding-${side}: ${twipsToPt(parseUnit(w))}pt;`);
            }
        });
    } else {
         styles.push('padding: 4px;');
    }

    // Vertical alignment
    const vAlign = tcPr.querySelector('vAlign')?.getAttribute('w:val');
    if (vAlign) {
        if (vAlign === 'center') styles.push('vertical-align: middle;');
        else if (vAlign === 'bottom') styles.push('vertical-align: bottom;');
        else styles.push('vertical-align: top;');
    } else {
        styles.push('vertical-align: top;');
    }
    
    // Shading
    const shd = tcPr.querySelector('shd')?.getAttribute('w:fill');
    if (shd && shd !== 'auto') {
        styles.push(`background-color: #${shd};`);
    }

    return styles.join(' ');
}

export function extractPageMargins(sectPr: Element | null): { top: string, right: string, bottom: string, left: string } {
    const defaultMargins = { top: '25.4mm', right: '25.4mm', bottom: '25.4mm', left: '25.4mm' };
    if (!sectPr) return defaultMargins;

    const pgMar = sectPr.querySelector('pgMar');
    if (pgMar) {
        const top = pgMar.getAttribute('w:top');
        const right = pgMar.getAttribute('w:right');
        const bottom = pgMar.getAttribute('w:bottom');
        const left = pgMar.getAttribute('w:left');

        return {
            top: top ? `${twipsToPt(parseUnit(top))}pt` : defaultMargins.top,
            right: right ? `${twipsToPt(parseUnit(right))}pt` : defaultMargins.right,
            bottom: bottom ? `${twipsToPt(parseUnit(bottom))}pt` : defaultMargins.bottom,
            left: left ? `${twipsToPt(parseUnit(left))}pt` : defaultMargins.left,
        };
    }
    return defaultMargins;
}

export function parseStylesXml(doc: Document): DocxStyles {
    const styles: DocxStyles = {};
    const styleElements = doc.querySelectorAll('style');
    
    styleElements.forEach(style => {
        const styleId = style.getAttribute('w:styleId');
        if (!styleId) return;

        const pPr = style.querySelector('pPr');
        const rPr = style.querySelector('rPr');
        const basedOn = style.querySelector('basedOn')?.getAttribute('w:val') || undefined;

        styles[styleId] = {
            pPr: mapParagraphProperties(pPr),
            rPr: mapRunProperties(rPr),
            basedOn
        };
    });

    return styles;
}

export function mapThemeColor(themeColor: string): string | null {
    // A simplified map of common theme colors to hex codes
    const themeMap: Record<string, string> = {
        'accent1': '#4F81BD',
        'accent2': '#C0504D',
        'accent3': '#9BBB59',
        'accent4': '#8064A2',
        'accent5': '#4BACC6',
        'accent6': '#F79646',
        'dark1': '#000000',
        'light1': '#FFFFFF',
        'dark2': '#1F497D',
        'light2': '#EEECE1',
        'hyperlink': '#0000FF',
        'followedHyperlink': '#800080',
    };
    return themeMap[themeColor] || null;
}