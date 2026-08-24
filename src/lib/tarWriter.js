// Minimal POSIX/ustar tar writer + gzip, in the browser.
//
// Extracted from controllerTarball.js so the controller installer bundle and the relay
// repo bundle share one implementation — two hand-rolled tar writers drifting apart is
// exactly the kind of bug that only shows up as "the archive won't extract on the box".
// Uses the platform's CompressionStream('gzip'), so no packages are needed.

const BLOCK = 512;
const enc = new TextEncoder();

function padName(name) {
  // 100-byte name field. Every path we emit is short, so an overflow is a caller bug
  // rather than something to silently truncate.
  const bytes = enc.encode(name);
  if (bytes.length > 100) throw new Error(`Archive path too long for tar: ${name}`);
  return bytes;
}

function octal(value, width) {
  return enc.encode(value.toString(8).padStart(width - 1, "0") + "\0");
}

function header(name, size, mode) {
  const h = new Uint8Array(BLOCK);
  h.set(padName(name), 0);
  h.set(octal(mode, 8), 100); // mode
  h.set(octal(0, 8), 108); // uid
  h.set(octal(0, 8), 116); // gid
  h.set(octal(size, 12), 124);
  h.set(octal(Math.floor(Date.now() / 1000), 12), 136);
  h.set(enc.encode("        "), 148); // checksum placeholder: spaces
  h[156] = 0x30; // typeflag '0' = regular file
  h.set(enc.encode("ustar\0"), 257);
  h.set(enc.encode("00"), 263);

  let sum = 0;
  for (const b of h) sum += b;
  h.set(octal(sum, 8), 148);
  return h;
}

/** entries: [{ name, body, mode }] -> Uint8Array of the uncompressed tar. */
export function buildTar(entries) {
  const chunks = [];
  for (const e of entries) {
    const body = enc.encode(e.body);
    chunks.push(header(e.name, body.length, e.mode ?? 0o644));
    chunks.push(body);
    const rem = body.length % BLOCK;
    if (rem) chunks.push(new Uint8Array(BLOCK - rem));
  }
  // Two zero blocks terminate the archive.
  chunks.push(new Uint8Array(BLOCK * 2));

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export async function gzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

/** Builds a gzipped tar from entries and returns a Blob. */
export async function buildTarGz(entries) {
  return gzip(buildTar(entries));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}