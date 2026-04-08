import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('document') as File;

    if (!file) {
      return NextResponse.json({ error: 'No document file provided' }, { status: 400 });
    }

    // Prepare the form data to send to the Syncfusion WordProcessor server-side API
    const sfFormData = new FormData();
    sfFormData.append('files', file);

    // Provide the URL of the Syncfusion Document Editor server-side API.
    // For development, Syncfusion provides a public endpoint, but it is highly recommended to host your own.
    // See: https://ej2.syncfusion.com/react/documentation/document-editor/server-side-dependencies/
    const syncfusionServiceUrl = 'https://document.syncfusion.com/web-services/docx-editor/api/documenteditor/Import';

    const response = await fetch(syncfusionServiceUrl, {
      method: 'POST',
      body: sfFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Syncfusion API error:', errorText);
      return NextResponse.json({ error: 'Failed to convert document' }, { status: response.status });
    }

    const sfdt = await response.text();
    return new NextResponse(sfdt, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    console.error('Document import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}