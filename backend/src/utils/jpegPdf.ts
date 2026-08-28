function readU16(b: Buffer, i: number) { return b.readUInt16BE(i); }
function readU32(b: Buffer, i: number) { return b.readUInt32BE(i); }

/** Build a small PDF containing JPEG pages without an external PDF dependency. */
export function jpegImagesToPdf(images: Buffer[]): Buffer {
  if (!images.length) throw new Error('At least one scanned page is required.');
  const objects: Buffer[] = [];
  const add = (data: string | Buffer) => { objects.push(Buffer.isBuffer(data) ? data : Buffer.from(data, 'binary')); return objects.length; };

  const pagesId = add('');
  const pageIds: number[] = [];
  const imageIds: number[] = [];

  for (let index = 0; index < images.length; index++) {
    const image = images[index];
    if (image.length < 4 || image[0] !== 0xff || image[1] !== 0xd8) throw new Error(`Page ${index + 1} is not a JPEG image.`);
    const { width, height, components } = jpegSize(image);
    const colorSpace = components === 1 ? '/DeviceGray' : components === 4 ? '/DeviceCMYK' : '/DeviceRGB';
    const imageId = add(Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`, 'binary'),
      image,
      Buffer.from('\nendstream', 'binary')
    ]));
    imageIds.push(imageId);

    const maxW = 540, maxH = 720;
    const scale = Math.min(maxW / width, maxH / height);
    const w = Math.max(1, width * scale), h = Math.max(1, height * scale);
    const x = (612 - w) / 2, y = (792 - h) / 2;
    const content = `q\n${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im${index + 1} Do\nQ\n`;
    const contentId = add(`<< /Length ${Buffer.byteLength(content, 'binary')} >>\nstream\n${content}endstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }

  objects[pagesId - 1] = Buffer.from(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets = [0];
  let offset = chunks[0].length;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(offset);
    const head = Buffer.from(`${i + 1} 0 obj\n`, 'binary');
    const tail = Buffer.from('\nendobj\n', 'binary');
    chunks.push(head, objects[i], tail);
    offset += head.length + objects[i].length + tail.length;
  }
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'binary'));
  return Buffer.concat(chunks);
}

function jpegSize(buf: Buffer): { width: number; height: number; components: number } {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    i += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    if (i + 2 > buf.length) break;
    const len = readU16(buf, i);
    if (len < 2 || i + len > buf.length) break;
    const sof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (sof) return { height: readU16(buf, i + 3), width: readU16(buf, i + 5), components: buf[i + 7] };
    i += len;
  }
  throw new Error('Could not read JPEG dimensions.');
}
