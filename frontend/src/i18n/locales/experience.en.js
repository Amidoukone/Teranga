const experience = {
  clientHome: {
    greeting: 'Hello {{name}}', hint: 'Tell us what you need and follow its handling here.',
    attention: 'Your response is needed', active: 'Your active requests', review: 'Review the result',
    empty: 'You have no other requests in progress.', all: 'View all my requests', more: 'Your other spaces', payments: 'My payments',
    partial: 'This overview covers your 100 most recent requests. Open all requests to see more.',
  },
  workspace: {
    loadError: 'Could not load your workspace. Try again when your connection returns.',
    management: 'Your operations', managementHint: 'Follow assignments and intervene on blocked requests.',
    openOperations: 'Open the operations queue', overview: 'Territory activity', openOrders: 'Open orders', activeTasks: 'Tasks in progress', managementLinks: 'Territory management',
    overviewError: 'The operations overview is incomplete.', financeError: 'The financial summary is unavailable.',
    finance: 'View amounts by currency', currencyHint: 'Each currency is shown separately. Totals never combine different currencies.', noTransactions: 'No transactions recorded in this territory.',
    financeFields: { revenues: 'Revenue', expenses: 'Expenses', commissions: 'Commissions', adjustments: 'Adjustments', balance: 'Balance' },
  },
  requestProgress: { label: 'Your request progress', received: 'Received', assigned: 'Assigned', execution: 'In progress', review: 'To review', finished: 'Finished' },
  fieldWorkspace: {
    title: 'My work', hint: 'Offers to accept and work to continue are shown first.',
    available: 'Available for new requests', offline: 'Unavailable for new requests', busy: 'Work in progress',
    goAvailable: 'Become available', goOffline: 'Become unavailable', duration: 'For a duration of', minutes: '{{count}} minutes',
    settings: 'Set my workload capacity', showHistory: 'View finished requests', showActive: 'Return to active work', supervised: 'Open my supervised missions',
    providerHint: 'Your availability allows new offers within your territory.',
  },
  requestDraft: {
    clear: 'Clear this draft and start again',
    restored: 'Your previous input was restored in this tab. Choose the service and check the details before sending.',
    retryAttachments: 'Resend attachments only', createdSessionFailed: 'Your request was created. Keep its reference and sign in again to access tracking.',
  },
  requestHelp: {
    email: 'Email Teranga support',
    title: 'Need help?', hint: 'Find a request or contact the team that can help you.',
    reference: 'Request #{{id}} — share this reference with the team.', message: 'Hello Teranga, I need help with request #{{id}}: {{title}}.',
    call: 'Call the local team', whatsapp: 'Send the request reference', options: 'Help with this request',
    missing: 'The local contact is not configured. Open your request or workspace to find your contact person.',
    loadError: 'This request is unavailable or cannot be accessed with your account.', contact: 'Contact your team', findRequest: 'Find my requests', resources: 'Useful information',
  },
  operationsOverview: {
    all: 'All requests', limit: 'Overview of the first 25 requests of each type. Select a type to browse all its pages.',
    partial: 'Incomplete loading: {{types}}. Other requests remain available; refresh to try again.',
  },
  requestAmounts: {
    title: 'Price and payment', estimate: 'Reference amount', agreed: 'Agreed price', paid: 'Recorded payments with evidence', remaining: 'Remaining amount',
    toConfirm: 'Confirm with Teranga', unknown: 'Not calculated without a confirmed agreed price', unavailable: 'Payments are currently unavailable',
    note: 'A reference amount does not confirm either the price or payment.',
  },
};
export default experience;
