export async function uploadEncryptedBackupToAppData(accessToken: string, encryptedExport: unknown) {
  const metadata = {
    name: `jotter-backup-${Date.now()}.json`,
    parents: ['appDataFolder'],
  }
  const boundary = `jotter-${crypto.randomUUID()}`
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    JSON.stringify(encryptedExport),
    `--${boundary}--`,
    '',
  ].join('\r\n')

  const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  if (!resp.ok) throw new Error(await resp.text())
  return resp.json()
}
