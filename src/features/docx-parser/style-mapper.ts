import { twipsToPt, halfPointsToPt, twipsToPx, parseUnit } from './unit-converter';

export function mapRunProperties(rPr: Element | null): string {
  if (!rPr) return '';
  const styles: string[] = [];

  // Bold
  if (rPr.querySelector('b')) styles.push('font-weight: bold;');
  if (rPr.querySelector('bCs')) styles.push('font-weight: bold;'); // Complex script bold

  // Italic
  if (rPr.querySelector('i')) styles.push('font-style: italic;');
  if (rPr.querySelector('iCs')) styles.push('font-style: italic;');

  // Underline
  if (rPr.querySelector('u')) {
    const val = rPr.querySelector('u')?.getAttribute('w:val');
    if (val !== 'none') styles.push('text-decoration: underline;');
  }

  // Strike
  if (rPr.querySelector('strike')) styles.push('text-decoration: line-through;');

  // Size
  const sz = rPr.querySelector('sz')?.getAttribute('w:val');
  if (sz) styles.push(`font-size: ${halfPointsToPt(parseUnit(sz))}pt;`);

  // Color
  const color = rPr.querySelector('color')?.getAttribute('w:val');
  if (color && color !== 'auto') styles.push(`color: #${color};`);

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
      styles.push(`background-color: #${shd};`);
  }

  return styles.join(' ');
}

export function mapParagraphProperties(pPr: Element | null): string {
  if (!pPr) return '';
  const styles: string[] = [];

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
        if (lineRule === 'auto') {
            styles.push(`line-height: ${(parseUnit(line) / 240).toFixed(2)};`);
        } else {
            styles.push(`line-height: ${twipsToPt(parseUnit(line))}pt;`);
        }
    }
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