import assert from 'node:assert/strict'
import { mkdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { cleanupStaleTemporaryFiles } from '../dist/services/temp-cleanup.js'

test('removes stale FileFlow work directories and uploads only', async () => {
  const suffix = `${process.pid}-${Date.now()}`
  const workDirectory = join(tmpdir(), `fileflow-ocr-${suffix}`)
  const unrelatedDirectory = join(tmpdir(), `unrelated-${suffix}`)
  const uploadDirectory = join(tmpdir(), 'fileflow-batch-images')
  const staleUpload = join(uploadDirectory, `stale-${suffix}`)
  await Promise.all([mkdir(workDirectory), mkdir(unrelatedDirectory), mkdir(uploadDirectory, { recursive: true })])
  await writeFile(staleUpload, 'temporary')
  const old = new Date(Date.now() - 10_000)
  await Promise.all([utimes(workDirectory, old, old), utimes(unrelatedDirectory, old, old), utimes(staleUpload, old, old)])
  const removed = await cleanupStaleTemporaryFiles(1_000)
  assert.equal(removed >= 2, true)
  await assert.rejects(stat(workDirectory))
  await assert.rejects(stat(staleUpload))
  assert.equal((await stat(unrelatedDirectory)).isDirectory(), true)
  await rm(unrelatedDirectory, { recursive: true, force: true })
})
