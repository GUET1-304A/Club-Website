import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'

test('the default video stays small and its MP4 metadata precedes the media for progressive playback', async () => {
  const data = await readFile(new URL('../public/hero-bg.mp4', import.meta.url))
  assert.ok(data.length < 4 * 1024 * 1024, 'Background video must stay below 4 MiB; recompress before publishing.')
  const boxes = []
  for (let offset = 0; offset + 8 <= data.length;) {
    const size = data.readUInt32BE(offset)
    assert.ok(size >= 8 && offset + size <= data.length, 'Malformed MP4 container')
    boxes.push(data.toString('ascii', offset + 4, offset + 8))
    offset += size
  }
  assert.equal(boxes[0], 'ftyp')
  assert.ok(boxes.includes('moov') && boxes.includes('mdat'))
  assert.ok(boxes.indexOf('moov') < boxes.indexOf('mdat'), 'Encode using -movflags +faststart')
  const poster = await stat(new URL('../public/hero-poster.webp', import.meta.url))
  assert.ok(poster.size < 120 * 1024, 'Poster must remain lightweight')
})
