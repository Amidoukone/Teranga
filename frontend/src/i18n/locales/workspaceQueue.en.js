const workspaceQueue = {
  action: 'To do', following: 'Following', information: 'Information',
  hint: 'Your cases, next actions and useful updates in one place.',
  search: 'Search for a case, step or reference', find: 'Search', kind: 'Case type', all: 'All types',
  kinds: { service: 'Services', project: 'Projects', order: 'Orders', task: 'Interventions' },
  loading: 'Loading your work…', failed: 'The work queue is unavailable. Your information remains accessible.',
  emptyAction: 'Nothing to do right now', emptyFollowing: 'No cases to follow right now', emptyFiltered: 'No cases match this search.',
  emptyHint: 'Use the other views to find ongoing work and received information.',
  steps: '{{count}} step(s) to follow', actionSteps: '{{count}} step(s) need you', deadline: 'Next deadline', open: 'Open case',
  actions: { result_review: 'Review result', coordinate: 'Organize this case', resolve: 'Review the problem', service_execute: 'Continue the work', project_execute: 'Continue the project', order_execute: 'Continue the order', step_start: 'Start a step', step_complete: 'Continue a step', step_review: 'Review a step', step_assign: 'Assign a step' },
  reasons: { result_review: 'The result has been submitted to you. Review the evidence before accepting it.', coordinate: 'This case needs your attention or a coordination adjustment.', resolve: 'A problem needs a coordinator’s decision.', service_execute: 'The work is assigned to you. Open the case for its next step.', project_execute: 'Find the phases, documents and actions for this project.', order_execute: 'Find preparation, shipping and handover actions.', step_start: 'An assigned step is ready to start.', step_complete: 'A step in this case is in progress.', step_review: 'A completed step needs your administrative review.', step_assign: 'A step is waiting for an assignee.' },
  waitingClient: 'Waiting for client acceptance.', waitingReview: 'The work is awaiting coordinator review.', waitingTeam: 'Other people are working on this case. No action is needed from you right now.', waitingSteps: 'There are still steps to follow in this case.',
  coordinationTools: 'Coordination tools', back: 'Back to the queue', reading: 'Show information', unreadOnly: 'Unread', allInformation: 'All updates',
  taskTitle: 'Intervention #{{id}}', taskHint: 'Perform and document this intervention here.', taskFailed: 'This intervention is unavailable within your access.', taskSaved: 'Intervention saved.',
  focusedCase: 'Case #{{id}}', allProblems: 'All problems',
};
export default workspaceQueue;
