import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { html } = await req.json();

    if (!html) {
      return NextResponse.json({ error: 'HTML string is required' }, { status: 400 });
    }

    // Convert HTML string to Blob
    const blob = new Blob([html], { type: 'text/html' });
    const formData = new FormData();
    formData.append('document.html', blob, 'document.html');

    // Send to Syncfusion API
    const response = await fetch('https://document.syncfusion.com/web-services/docx-editor/api/documenteditor/Import', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Syncfusion API responded with status: ${response.status}`);
    }

    const sfdtText = await response.text();

    return new NextResponse(sfdtText, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    console.error('Error converting HTML to SFDT:', error);
    return NextResponse.json({ error: 'Failed to convert HTML to SFDT' }, { status: 500 });
  }
}