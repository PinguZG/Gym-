import { envMode, type IntegrationAdapter } from '../types';
import { mockGarmin } from '../mock';
import { sidecarSync } from '../live';

export const garmin: IntegrationAdapter = {
  id: 'garmin',
  label: 'Garmin Connect',
  capabilities: ['Aktivitäten / Workouts'],
  risk: 'Inoffiziell (python-garminconnect, Login über Garmin-SSO): Rate-Limits/MFA-/Cloudflare-Änderungen können Sync jederzeit brechen; Account-Sperre bei Missbrauch möglich.',
  mode: () => envMode('garmin'),
  sync: ({ since }) => (envMode('garmin') === 'mock' ? Promise.resolve(mockGarmin()) : sidecarSync('garmin', since))
};
