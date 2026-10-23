import { detectAttachment } from './detect-attachment';

const bytes = (...values: number[]) => Buffer.from(values);
const PNG = Buffer.concat([
  bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  Buffer.alloc(8),
]);
const JPEG = Buffer.concat([bytes(0xff, 0xd8, 0xff, 0xe0), Buffer.alloc(8)]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< >>\nendobj\n');

describe('detectAttachment', () => {
  it('recognizes a PDF by its content, whatever the name says', () => {
    expect(detectAttachment('informe.pdf', PDF)).toMatchObject({
      kind: 'pdf',
      ext: 'pdf',
    });
    expect(detectAttachment('sin-extension', PDF)).toMatchObject({
      kind: 'pdf',
      ext: 'pdf',
    });
    expect(detectAttachment('foto.txt', PDF)).toMatchObject({
      kind: 'pdf',
      ext: 'pdf',
    });
  });

  it.each([
    ['png', PNG],
    ['jpg', JPEG],
    ['gif', Buffer.from('GIF89a\u0001\u0000\u0001\u0000')],
    [
      'webp',
      Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.alloc(4),
        Buffer.from('WEBPVP8 '),
      ]),
    ],
  ])('recognizes a %s image by its content', (ext, buffer) => {
    expect(detectAttachment(`foto.${ext}`, buffer)).toMatchObject({
      kind: 'image',
      ext,
    });
  });

  it('gives an image the extension of its content, not the one in the name', () => {
    expect(detectAttachment('foto.jpeg', PNG)).toMatchObject({
      kind: 'image',
      ext: 'png',
    });
  });

  it.each([
    'notas.txt',
    'LEEME.md',
    'datos.csv',
    'tabla.tsv',
    'config.json',
    'app.log',
    'a.xml',
    'a.yml',
    'a.yaml',
  ])('accepts %s when its content is text', (name) => {
    expect(
      detectAttachment(name, Buffer.from('a,b\n1,2\ncafé,ñandú\n')),
    ).toMatchObject({ kind: 'text' });
  });

  it('says csv is csv', () => {
    expect(
      detectAttachment('datos.csv', Buffer.from('a,b\n1,2')),
    ).toMatchObject({
      kind: 'text',
      ext: 'csv',
      mime: 'text/csv',
    });
  });

  it('refuses a binary file that is named like a text file', () => {
    expect(
      detectAttachment(
        'datos.csv',
        Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]),
      ),
    ).toBeNull();
    expect(
      detectAttachment(
        'notas.txt',
        Buffer.from([0x68, 0x6f, 0x00, 0x6c, 0x61]),
      ),
    ).toBeNull();
  });

  it('refuses text that is not valid UTF-8', () => {
    expect(
      detectAttachment('notas.txt', Buffer.from([0xc3, 0x28, 0x41])),
    ).toBeNull();
  });

  it.each([
    'programa.exe',
    'archivo.zip',
    'informe.docx',
    'hoja.xlsx',
    'imagen.svg',
    'script.sh',
    'sin-extension',
  ])('refuses %s', (name) => {
    expect(
      detectAttachment(name, Buffer.from('MZ contenido cualquiera')),
    ).toBeNull();
  });

  it('does not take an executable renamed to .pdf for a pdf', () => {
    expect(
      detectAttachment('virus.pdf', Buffer.from('MZ\u0090\u0000\u0003')),
    ).toBeNull();
  });
});
