import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskWorkspacePage from './TaskWorkspacePage';
import { getTaskWorkspace, updateTaskStatus } from '../services/tasks';
let mockId='29';
const mockGeo={user:{id:7,role:'agent'},countryId:1};
const mockLocation={state:{from:'/operations?vue=a-faire&q=compteur'},search:''};
jest.mock('../contexts/GeoContext',()=>({useGeo:()=>mockGeo}));
jest.mock('react-router-dom',()=>({useParams:()=>({id:mockId}),useLocation:()=>mockLocation,Link:({to,state,children,...props})=><a href={to} {...props}>{children}</a>}),{virtual:true});
jest.mock('react-i18next',()=>{const t=(key)=>key;return{useTranslation:()=>({t})};});
jest.mock('../i18n/useLocale',()=>({useLocale:()=>({formatDate:String,formatNumber:String})}));
jest.mock('../services/tasks',()=>({getTaskWorkspace:jest.fn(),updateTaskStatus:jest.fn()}));
jest.mock('../services/evidences',()=>({getEvidences:jest.fn(),uploadEvidences:jest.fn(),deleteEvidence:jest.fn()}));
jest.mock('../services/operations',()=>({getAssignableAgents:jest.fn()}));
jest.mock('../utils/confirm',()=>({confirmAction:jest.fn()}));
jest.mock('../utils/labels',()=>({TASK_TYPES:{},TASK_PRIORITIES:{},CURRENCY_LABELS:{}}));
const data=(extra={})=>({task:{id:29,title:'Relever le compteur',status:'created',assignedTo:7,capabilities:{canStart:true}},viewer:{id:7,role:'agent'},parentServiceId:null,...extra});
beforeEach(()=>{jest.clearAllMocks();mockId='29';getTaskWorkspace.mockResolvedValue(data());updateTaskStatus.mockResolvedValue({});});
test('a task-only case retains its actions and the queue return context without revealing a parent link',async()=>{
  render(<TaskWorkspacePage/>);await screen.findByRole('heading',{name:'Relever le compteur'});
  expect(screen.getByRole('link',{name:'workspaceQueue.back'})).toHaveAttribute('href',mockLocation.state.from);
  expect(screen.queryByRole('link',{name:'serviceSteps.back'})).not.toBeInTheDocument();
  userEvent.click(screen.getByRole('button',{name:'serviceSteps.start'}));await waitFor(()=>expect(updateTaskStatus).toHaveBeenCalledWith(29,'in_progress'));
});
test('a permitted parent link opens the exact step and proof section',async()=>{
  getTaskWorkspace.mockResolvedValue(data({parentServiceId:14}));render(<TaskWorkspacePage/>);
  expect(await screen.findByRole('link',{name:'serviceSteps.back'})).toHaveAttribute('href','/services/14/tasks?etape=29#steps');
});

test('a project step returns to the same project without broadening the task workspace', async () => {
  const previous = mockLocation.state;
  mockLocation.state = { from: '/projects/14#project-tasks' };
  render(<TaskWorkspacePage />);
  expect(await screen.findByRole('link', { name: 'dossier.backProject' })).toHaveAttribute('href', '/projects/14#project-tasks');
  expect(screen.queryByRole('link', { name: 'serviceSteps.back' })).not.toBeInTheDocument();
  mockLocation.state = previous;
});

test.each(['/tasks?propertyId=8&page=2&q=compteur', '/tasks?status=validated'])('returns to the intervention archive with its filters: %s', async (from) => {
  const previous = mockLocation.state;
  mockLocation.state = { from };
  render(<TaskWorkspacePage />);
  expect(await screen.findByRole('link', { name: 'nav.backInterventions' })).toHaveAttribute('href', from);
  mockLocation.state = previous;
});

test.each(['https://example.com/tasks', '//example.com/tasks', '/tasks/29', '/tasks?bad=\\evil'])('rejects an unrelated archive return: %s', async (from) => {
  const previous = mockLocation.state;
  mockLocation.state = { from };
  render(<TaskWorkspacePage />);
  expect(await screen.findByRole('link', { name: 'workspaceQueue.back' })).toHaveAttribute('href', '/operations');
  mockLocation.state = previous;
});
test('a failed refresh retains the task until consultation is revoked',async()=>{
  render(<TaskWorkspacePage/>);await screen.findByRole('heading',{name:'Relever le compteur'});
  getTaskWorkspace.mockRejectedValueOnce(new Error('offline'));fireEvent.online(window);await screen.findByRole('alert');
  expect(screen.getByRole('heading',{name:'Relever le compteur'})).toBeInTheDocument();
  getTaskWorkspace.mockRejectedValueOnce({response:{status:404}});fireEvent.online(window);
  await waitFor(()=>expect(screen.queryByRole('heading',{name:'Relever le compteur'})).not.toBeInTheDocument());
});
test('opening another intervention discards late information from the previous one',async()=>{
  let resolve;getTaskWorkspace.mockImplementationOnce(()=>new Promise((done)=>{resolve=done;}));const view=render(<TaskWorkspacePage/>);await waitFor(()=>expect(getTaskWorkspace).toHaveBeenCalled());
  mockId='30';getTaskWorkspace.mockResolvedValue(data({task:{id:30,title:'Nouvelle intervention',capabilities:{}}}));view.rerender(<TaskWorkspacePage/>);await screen.findByRole('heading',{name:'Nouvelle intervention'});
  await act(async()=>resolve(data()));expect(screen.queryByRole('heading',{name:'Relever le compteur'})).not.toBeInTheDocument();
});
