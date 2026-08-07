import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import assert from 'node:assert/strict'
import test from 'node:test'
import { convertMedia } from '../dist/controllers/media-convert.controller.js'

const runFile = promisify(execFile)

test('converts audio to MP3 and removes temporary files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fileflow-media-test-'))
  const inputPath = join(directory, 'tone.wav')
  await runFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.2', '-y', inputPath])
  const result = { statusCode: 200, body: undefined, name: undefined }
  const response = {
    headersSent: false,
    status(code) { result.statusCode = code; return this },
    json(value) { result.body = value; return this },
    download: (path, name, callback) => {
      result.body = readFileSync(path); result.name = name; response.headersSent = true; callback()
    },
  }
  let forwardedError
  await convertMedia({ body: { format: 'mp3' }, file: { path: inputPath, size: 1, mimetype: 'audio/wav', originalname: 'tone.wav' } }, response, (error) => { forwardedError = error })
  if (forwardedError) throw forwardedError
  assert.equal(result.name, 'tone.mp3')
  assert.equal(result.body.subarray(0, 3).toString(), 'ID3')
  await rm(directory, { recursive: true, force: true })
})
