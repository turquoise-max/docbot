const HTMLtoDOCX = require('html-to-docx');
const fs = require('fs');

async function runTest() {
  try {
    const htmlString = `
      <h1>Hello World</h1>
      <p>This is a test paragraph.</p>
      <table>
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
        </tr>
        <tr>
          <td>Data 1</td>
          <td>Data 2</td>
        </tr>
      </table>
    `;

    console.log('Attempting to convert HTML to DOCX...');
    
    // Convert HTML to DOCX buffer
    const fileBuffer = await HTMLtoDOCX(htmlString, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });

    console.log('Conversion successful. Buffer size:', fileBuffer.length, 'bytes');
    
    // Save to disk just to verify
    fs.writeFileSync('test-output.docx', fileBuffer);
    console.log('Successfully wrote to test-output.docx');

  } catch (error) {
    console.error('Error during conversion:', error);
  }
}

runTest();