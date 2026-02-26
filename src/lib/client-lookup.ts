// TODO: Replace mock with real API call to external client management system

export interface ClientRecord {
  hxtNumber: string
  name: string
  email: string
  dob?: string
  nationality?: string
  address?: string
  employer?: string
  riskProfile?: string
}

const MOCK_CLIENTS: Record<string, ClientRecord> = {
  'HXT-10001': { hxtNumber: 'HXT-10001', name: 'James & Sarah Mitchell', email: 'james.mitchell@gmail.com', dob: '15 March 1978', nationality: 'British', address: '42 Kensington Gardens, London W8 4PX', employer: 'Barclays Investment Bank', riskProfile: 'Balanced' },
  'HXT-10002': { hxtNumber: 'HXT-10002', name: 'David Chen', email: 'david.chen@outlook.com', dob: '22 August 1985', nationality: 'Singaporean', address: '8 Marina Boulevard, Singapore 018981', employer: 'DBS Group Holdings', riskProfile: 'Growth' },
  'HXT-10003': { hxtNumber: 'HXT-10003', name: 'Emma Thompson', email: 'emma.t@yahoo.co.uk', dob: '3 November 1972', nationality: 'British', address: '15 Harley Street, London W1G 9QY', employer: 'Self-employed', riskProfile: 'Cautious' },
  'HXT-10004': { hxtNumber: 'HXT-10004', name: 'Robert & Lisa Nakamura', email: 'r.nakamura@email.com', dob: '10 January 1980', nationality: 'Japanese / American', address: '3-14-1 Roppongi, Minato-ku, Tokyo', employer: 'Goldman Sachs Japan', riskProfile: 'Adventurous' },
  'HXT-10005': { hxtNumber: 'HXT-10005', name: 'Sophie Williams', email: 'sophie.w@proton.me', dob: '7 June 1990', nationality: 'British', address: '29 Castle Street, Edinburgh EH2 3DN', employer: 'Deloitte LLP', riskProfile: 'Balanced' },
  'HXT-10006': { hxtNumber: 'HXT-10006', name: 'Michael & Priya Patel', email: 'michael.patel@gmail.com', dob: '19 December 1975', nationality: 'British / Indian', address: '58 Victoria Road, Dubai Marina, UAE', employer: 'HSBC Middle East', riskProfile: 'Growth' },
}

export async function lookupClient(hxtNumber: string): Promise<ClientRecord | null> {
  // Simulate 1s API delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const normalized = hxtNumber.trim().toUpperCase()
  return MOCK_CLIENTS[normalized] ?? null
}
