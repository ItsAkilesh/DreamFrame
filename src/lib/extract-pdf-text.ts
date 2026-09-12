// extract-pdf-text.ts
// Purpose: Extract plain text from an uploaded PDF script.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
