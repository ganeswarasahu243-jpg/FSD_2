/**
 * In-memory document text extraction for Supabase Edge Functions.
 * Supports .txt, .pdf, and .docx formats.
 */

export async function extractTextFromBytes(bytes: Uint8Array, filename = ''): Promise<string> {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

  if (ext === '.txt' || ext === '.md' || ext === '.json' || !ext) {
    return new TextDecoder().decode(bytes);
  }

  if (ext === '.docx') {
    try {
      const mammothPkg = await import('mammoth');
      const mammoth = (mammothPkg as Record<string, unknown>).default || mammothPkg;
      const buffer = typeof Buffer !== 'undefined' ? Buffer.from(bytes) : bytes;
      const result = await (mammoth as { extractRawText: (opts: { buffer: unknown }) => Promise<{ value: string }> }).extractRawText({ buffer });
      return result.value || '';
    } catch (err) {
      console.warn('DOCX parsing error:', err);
      return new TextDecoder().decode(bytes);
    }
  }

  if (ext === '.pdf') {
    try {
      // deno-lint-ignore no-explicit-any
      let pdfParse: any;
      try {
        // Direct require/import of core parser avoids pdf-parse v1.1.1 index.js debug ENOENT bug in ESM
        const direct = await import('pdf-parse/lib/pdf-parse.js');
        pdfParse = (direct as Record<string, unknown>).default || direct;
      } catch (_) {
        const pdfPkg = await import('pdf-parse');
        pdfParse = (pdfPkg as Record<string, unknown>).default || pdfPkg;
      }
      const buffer = typeof Buffer !== 'undefined' ? Buffer.from(bytes) : bytes;
      const data = await (pdfParse as (b: unknown) => Promise<{ text: string }>)(buffer);
      return data.text || '';
    } catch (err) {
      console.warn('PDF parsing error:', err);
      // Fallback regex extraction of text chunks from raw PDF bytes
      const rawStr = new TextDecoder('latin1').decode(bytes);
      const textMatches = rawStr.match(/\(([^()]+)\)[\s]*Tj/g) || [];
      const extracted = textMatches.map((m) => m.slice(1, m.indexOf(')'))).join(' ');
      return extracted || 'PDF content parsed';
    }
  }

  return new TextDecoder().decode(bytes);
}
