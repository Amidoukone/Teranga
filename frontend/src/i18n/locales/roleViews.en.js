const roleViews = {
  home: { client: 'My overview', agent: 'My work', provider: 'My activity', admin: 'Operations overview' },
  search: 'Search', all: 'All',
  availability: { available: 'Available', offline: 'Unavailable', busy: 'Working' },
  backSupervised: 'Back to supervised missions', backAssigned: 'Back to assigned services',
  backDossier: 'Back to the case',
  agentServices: 'Assigned services', supervised: 'Supervised missions',
  supervise: 'Supervise the case', supervisedHint: 'Follow the providers’ interventions that you supervise.',
  availabilityHelp: 'Availability options', backHome: 'Back to home',
  clientHint: 'Find your requests and results awaiting confirmation.',
  providerHint: 'Find your offers, interventions and supporting files.',
  agentHint: 'Open an assigned service to carry out the work and submit your report.',
  managementHint: 'Coordinate requests and find the tools available in your scope.',
};
export default roleViews;
