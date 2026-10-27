const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extracts plain text from a buffer or file path.
 * Supports .pdf, .docx, and text files (.txt, .md, etc.)
 */
const extractTextFromBuffer = async (buffer, filename = '') => {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.pdf') {
    const data = await pdfParse(buffer);
    return data.text || '';
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  // Fallback / plain text
  return buffer.toString('utf-8');
};

const extractTextFromFile = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  return extractTextFromBuffer(buffer, filePath);
};

module.exports = {
  extractTextFromBuffer,
  extractTextFromFile,
};
