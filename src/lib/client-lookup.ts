// TODO: Replace mock with real API call to external client management system

export interface ClientRecord {
  hxtNumber: string
  name: string
  email: string
}

const MOCK_CLIENTS: Record<string, ClientRecord> = {
  'HXT-10001': { hxtNumber: 'HXT-10001', name: 'James & Sarah Mitchell', email: 'james.mitchell@gmail.com' },
  'HXT-10002': { hxtNumber: 'HXT-10002', name: 'David Chen', email: 'david.chen@outlook.com' },
  'HXT-10003': { hxtNumber: 'HXT-10003', name: 'Emma Thompson', email: 'emma.t@yahoo.co.uk' },
  'HXT-10004': { hxtNumber: 'HXT-10004', name: 'Robert & Lisa Nakamura', email: 'r.nakamura@email.com' },
  'HXT-10005': { hxtNumber: 'HXT-10005', name: 'Sophie Williams', email: 'sophie.w@proton.me' },
  'HXT-10006': { hxtNumber: 'HXT-10006', name: 'Michael & Priya Patel', email: 'michael.patel@gmail.com' },
}

export async function lookupClient(hxtNumber: string): Promise<ClientRecord | null> {
  // Simulate 1s API delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const normalized = hxtNumber.trim().toUpperCase()
  return MOCK_CLIENTS[normalized] ?? null
}
