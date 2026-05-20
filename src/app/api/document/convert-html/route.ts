import { NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore html-to-docx handles types poorly but works fine in node
import HTMLtoDOCX from 'html-to-docx';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    const { html } = await req.json();

    if (!html) {
      return NextResponse.json({ error: 'HTML string is required' }, { status: 400 });
    }

    // 0. Use cheerio to enforce specific table styles before conversion
    const $ = cheerio.load(html, { xmlMode: false });
    
    $('table').each((_, table) => {
      // Set default table styles
      $(table).css('border-collapse', 'collapse');
      $(table).css('width', '100%');

      // Style Headers (th)
      $(table).find('th').each((__, th) => {
        $(th).css('background-color', '#1a3a5c');
        $(th).css('color', '#ffffff');
        $(th).css('font-weight', 'bold');
        $(th).css('padding', '4px 8px'); // Reduce row padding
        $(th).css('border', '1px solid #dee2e6');
      });

      // Style Cells (td)
      $(table).find('tr').each((rIdx, tr) => {
        $(tr).find('td').each((cIdx, td) => {
          $(td).css('padding', '4px 8px'); // Reduce row padding
          $(td).css('border', '1px solid #dee2e6');

          // Emphasize the first column
          if (cIdx === 0) {
            $(td).css('font-weight', 'bold');
            $(td).css('background-color', '#f4f6f8'); // Light gray-blue for first column
          }
        });
      });
    });

    const styledHtml = $.html();

    // 1. Convert HTML directly to a DOCX buffer using html-to-docx
    // This perfectly preserves tables, lists, formatting, etc.
    const docxBuffer = await HTMLtoDOCX(styledHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });

    // 2. Wrap the DOCX buffer in a Blob to simulate a file upload to Syncfusion
    const blob = new Blob([docxBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    
    const formData = new FormData();
    formData.append('document.docx', blob, 'document.docx');

    // 3. Send the DOCX file to Syncfusion Import API
    // Syncfusion is highly optimized for DOCX -> SFDT conversion.
    const response = await fetch('https://document.syncfusion.com/web-services/docx-editor/api/documenteditor/Import', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Syncfusion API responded with status: ${response.status}`);
    }

    // 4. Return the perfectly converted SFDT text directly to the client
    const sfdtText = await response.text();

    return new NextResponse(sfdtText, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
    
  } catch (error) {
    console.error('Error converting HTML to SFDT via DOCX:', error);
    return NextResponse.json({ error: 'Failed to convert HTML to SFDT' }, { status: 500 });
  }
}