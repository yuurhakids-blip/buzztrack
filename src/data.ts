import { Campaign, SuspiciousAccount, NetworkNode, NetworkLink } from './types';

// Initial pre-populated social buzzer campaigns
export const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-1',
    title: '#BicaraFaktaTolBaru',
    description: 'Coordinated promotion of a major smart highway infrastructure project. Designed to counter local community environmental concerns.',
    topic: 'Infrastructure & Economy',
    platforms: ['X', 'YouTube', 'TikTok'],
    intensity: 'High',
    sentiment: 'Positive',
    startDate: '2026-05-12',
    status: 'Active',
    botRatio: 0.74,
    reach: 1250000,
    hashtags: ['#BicaraFaktaTolBaru', '#TolSmartModern', '#InfrastrukturMaju'],
    keyNarrative: 'Stating that environmental concerns are artificial and manufactured, while amplifying infrastructure benefits via templated infographics.',
    buzzerCount: 312
  },
  {
    id: 'camp-2',
    title: '#BoikotPanganXCorp',
    description: 'Smear and boycott campaign directed against a local FMCG competitor following an alleged labor dispute. Highly aggressive and repetitive.',
    topic: 'Corporate Rivalry',
    platforms: ['X', 'TikTok'],
    intensity: 'Critical',
    sentiment: 'Negative',
    startDate: '2026-06-01',
    status: 'Active',
    botRatio: 0.88,
    reach: 4800000,
    hashtags: ['#BoikotPanganXCorp', '#BuruhTertindas', '#XCorpSakit'],
    keyNarrative: 'Amplification of unverified labor dispute videos with high emotional triggers, paired with identical copy-paste support replies.',
    buzzerCount: 890
  },
  {
    id: 'camp-3',
    title: '#DukungRUUSehat',
    description: 'Advocacy for the newly proposed Health Bill. High degree of automated account retweets within fractions of a second of core press releases.',
    topic: 'Public Policy',
    platforms: ['X', 'YouTube', 'TikTok'],
    intensity: 'Medium',
    sentiment: 'Positive',
    startDate: '2026-04-18',
    status: 'Monitoring',
    botRatio: 0.52,
    reach: 820000,
    hashtags: ['#DukungRUUSehat', '#KesehatanUntukSemua', '#ReformasiMedis'],
    keyNarrative: 'Spreading standard, authorized promotional banners and videos across TikTok to influence youth support, ignoring expert criticisms.',
    buzzerCount: 145
  },
  {
    id: 'camp-4',
    title: '#WaspadaInvestasiAman',
    description: 'Shill campaign promoting a high-yield unregulated crypto-broker. Using fake celebrity-endorsement accounts and bot testimonials.',
    topic: 'Financial Scams',
    platforms: ['TikTok', 'YouTube'],
    intensity: 'High',
    sentiment: 'Positive',
    startDate: '2026-05-29',
    status: 'Active',
    botRatio: 0.81,
    reach: 2100000,
    hashtags: ['#WaspadaInvestasiAman', '#CryptoCuanCepat', '#FinancialFreedom'],
    keyNarrative: 'Comment section flooding under popular finance creators with preset testimonials: "I earned $5k in a week under the guidance of tutor XY".',
    buzzerCount: 450
  },
  {
    id: 'camp-5',
    title: '#RakyatButuhSolusiCepat',
    description: 'Socio-political narrative campaign shifting public focus away from local administrative clean water issues toward macro economic ratings.',
    topic: 'Governance & Politics',
    platforms: ['X', 'TikTok', 'YouTube'],
    intensity: 'Critical',
    sentiment: 'Mixed',
    startDate: '2026-06-05',
    status: 'Active',
    botRatio: 0.68,
    reach: 3400000,
    hashtags: ['#RakyatButuhSolusiCepat', '#ApresiasiKinerjaPusat', '#KritikHarusSehat'],
    keyNarrative: 'Deflecting local performance criticisms by claiming achievements in non-related metrics, attacking critics as "agents of foreign agendas".',
    buzzerCount: 620
  }
];

// List of flagged or suspected buzzer/bot accounts
export const SUSPICIOUS_ACCOUNTS: SuspiciousAccount[] = [
  {
    id: 'acc-1',
    username: 'kartika_jaya99',
    displayName: 'Kartika Jaya 🇮🇩',
    platform: 'X',
    followers: 125,
    following: 1980,
    botScore: 92,
    status: 'Verified Bot',
    lastActive: '2026-06-10 01:54',
    reason: 'Frequent multi-platform copypasta. Retweets campaign masters within 3.5 seconds of posting.',
    recentCopypastaCount: 47
  },
  {
    id: 'acc-2',
    username: 'candra_wibowo_dr',
    displayName: 'Wibowo Sinergi',
    platform: 'YouTube',
    followers: 3400,
    following: 50,
    botScore: 85,
    status: 'Under Investigation',
    lastActive: '2026-06-10 01:48',
    reason: 'Uploads identical shorts videos across over 40 separate channels within a 5-minute span.',
    recentCopypastaCount: 32
  },
  {
    id: 'acc-3',
    username: 'riarahayu.beauty',
    displayName: 'Ria Rahayu (Real Account)',
    platform: 'TikTok',
    followers: 12200,
    following: 154,
    botScore: 68,
    status: 'Flagged',
    lastActive: '2026-06-09 23:15',
    reason: 'Likely compromised account. Sudden shift to massive crypto brokerage comments containing botnet-coordinated links under top influencer accounts.',
    recentCopypastaCount: 15
  },
  {
    id: 'acc-4',
    username: 'pembela_keadilan_id',
    displayName: 'Patriot Kebenaran',
    platform: 'TikTok',
    followers: 1800,
    following: 9800,
    botScore: 97,
    status: 'Verified Bot',
    lastActive: '2026-06-10 02:01',
    reason: 'Generates automated high-frequency comments under political talk-shows using pre-recorded TikTok sounds.',
    recentCopypastaCount: 84
  },
  {
    id: 'acc-5',
    username: 'suarabangsa_tv',
    displayName: 'Suara Bangsa Nusantara',
    platform: 'YouTube',
    followers: 43000,
    following: 12,
    botScore: 74,
    status: 'Flagged',
    lastActive: '2026-06-10 01:10',
    reason: 'Syndicated content farm. Uploads identical 30-second shorts featuring synthetic voices across 15 separate puppet channels.',
    recentCopypastaCount: 19
  }
];

// Initial mock data for the network correlation visualization
export const INITIAL_NETWORK_NODES: NetworkNode[] = [
  { id: 'narrative-main', label: 'Campaign Hub', group: 'campaign', size: 28 },
  
  // Master accounts directing the buzzer activity
  { id: 'master-1', label: 'Opinion Leader A (Propagandist)', group: 'buzzer_master', size: 22, botScore: 45 },
  { id: 'master-2', label: 'Botnet Master Node', group: 'buzzer_master', size: 22, botScore: 98 },
  
  // Hashtags coordinated by the buzzer networks
  { id: 'hash-1', label: '#BoikotPanganXCorp', group: 'hashtag', size: 18 },
  { id: 'hash-2', label: '#BicaraFaktaTolBaru', group: 'hashtag', size: 18 },
  { id: 'hash-3', label: '#RakyatButuhSolusiCepat', group: 'hashtag', size: 18 },
  
  // Direct robot worker accounts / amplifying clients
  { id: 'bot-1', label: '@kartika_jaya99', group: 'buzzer_node', size: 12, botScore: 92, platform: 'X' },
  { id: 'bot-2', label: '@pembela_keadilan_id', group: 'buzzer_node', size: 12, botScore: 97, platform: 'TikTok' },
  { id: 'bot-3', label: '@candra_wibowo_dr', group: 'buzzer_node', size: 12, botScore: 85, platform: 'YouTube' },
  { id: 'bot-4', label: '@riarahayu.beauty', group: 'buzzer_node', size: 12, botScore: 68, platform: 'TikTok' },
  { id: 'bot-5', label: 'Bot_Client_X202', group: 'buzzer_node', size: 10, botScore: 99, platform: 'X' },
  { id: 'bot-6', label: 'Bot_Client_X304', group: 'buzzer_node', size: 10, botScore: 95, platform: 'X' },
  { id: 'bot-7', label: 'Bot_Client_T99', group: 'buzzer_node', size: 10, botScore: 91, platform: 'TikTok' }
];

export const INITIAL_NETWORK_LINKS: NetworkLink[] = [
  { source: 'narrative-main', target: 'master-1', value: 5 },
  { source: 'narrative-main', target: 'master-2', value: 8 },
  
  { source: 'master-1', target: 'hash-1', value: 4 },
  { source: 'master-1', target: 'hash-3', value: 6 },
  { source: 'master-2', target: 'hash-2', value: 9 },
  { source: 'master-2', target: 'hash-1', value: 7 },
  
  { source: 'hash-1', target: 'bot-2', value: 8 },
  { source: 'hash-1', target: 'bot-4', value: 5 },
  { source: 'hash-1', target: 'bot-7', value: 9 },
  
  { source: 'hash-2', target: 'bot-1', value: 9 },
  { source: 'hash-2', target: 'bot-3', value: 7 },
  { source: 'hash-2', target: 'bot-5', value: 10 },
  { source: 'hash-2', target: 'bot-6', value: 8 },
  
  { source: 'hash-3', target: 'bot-1', value: 6 },
  { source: 'hash-3', target: 'bot-2', value: 7 },
  { source: 'hash-3', target: 'bot-3', value: 5 }
];
