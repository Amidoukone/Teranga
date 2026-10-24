import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkspaceQueue, { workspaceTarget } from './WorkspaceQueue';
import { getWorkspace } from '../../services/operations';
const mockGeo = { user:{id:7,role:'client'},countryId:99,regionId:null };
let mockSearch='';
const mockLocation={pathname:'/operations',search:''};
const mockSummary=jest.fn();
jest.mock('../../contexts/GeoContext',()=>({useGeo:()=>mockGeo}));
jest.mock('../../services/auth',()=>({getLocalUser:()=>mockGeo.user}));
jest.mock('../../services/operations',()=>({getWorkspace:jest.fn()}));
jest.mock('../../i18n/useLocale',()=>({useLocale:()=>({formatDateTime:String})}));
jest.mock('react-i18next',()=>{const t=(key)=>key;return{useTranslation:()=>({t})};});
jest.mock('react-router-dom',()=>{
  const React=require('react');
  return { Link:({to,state,children,...props})=><a href={to} {...props}>{children}</a>,useLocation:()=>mockLocation,
    useSearchParams:()=>{const[params,set]=React.useState(()=>new URLSearchParams(mockSearch));const update=React.useCallback((value)=>{mockLocation.search='?'+value.toString();set(new URLSearchParams(value));},[]);return[params,update];} };
},{virtual:true});
const item=(extra={})=>({key:'service:14',kind:'service',id:14,title:'Visite de la maison',status:'completed',openStepCount:0,actionStepCount:0,action:{code:'result_review',kind:'service',id:14},...extra});
const result=(items=[item()],extra={})=>({items,pagination:{total:items.length},summary:{action:items.length,following:2,unread:3},...extra});
beforeEach(()=>{jest.clearAllMocks();mockSearch='';mockLocation.search='';mockGeo.user={id:7,role:'client'};getWorkspace.mockResolvedValue(result());});
const show=(props={})=>render(<WorkspaceQueue view="action" active onSummary={mockSummary} {...props}/>);

test('the centre loads an exact server page and keeps a diaspora client’s work independent of booking geography',async()=>{
  show();expect(await screen.findByRole('article',{name:'Visite de la maison'})).toBeInTheDocument();
  expect(getWorkspace).toHaveBeenCalledWith({view:'action',q:'',kind:'all',page:1,limit:20});
  expect(mockSummary).toHaveBeenCalledWith({action:1,following:2,unread:3});
  expect(screen.getByRole('link',{name:'workspaceQueue.actions.result_review'})).toHaveAttribute('href','/services/14');
});
test('task actions open the right step or the limited intervention, even when identifiers overlap',async()=>{
  mockGeo.user={id:7,role:'agent'};
  getWorkspace.mockResolvedValue(result([item({status:'in_progress',openStepCount:2,actionStepCount:2,action:{code:'step_complete',kind:'task',id:29}}),item({key:'task:14',kind:'task',title:'Relevé du compteur',action:{code:'step_start',kind:'task',id:14}})]));
  show();expect(await screen.findAllByRole('article')).toHaveLength(2);
  expect(screen.getByRole('link',{name:'workspaceQueue.actions.step_complete'})).toHaveAttribute('href','/services/14/tasks?etape=29#steps');
  expect(screen.getByRole('link',{name:'workspaceQueue.actions.step_start'})).toHaveAttribute('href','/tasks/14');
  expect(getWorkspace.mock.calls[0][0]).not.toHaveProperty('countryId');
});
test('following explains who is awaited and exposes a case link rather than a write action',async()=>{
  getWorkspace.mockResolvedValue(result([item({action:null})]));show({view:'following'});
  expect(await screen.findByText('workspaceQueue.waitingClient')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'workspaceQueue.open'})).toHaveAttribute('href','/services/14');
  expect(screen.queryByRole('link',{name:'workspaceQueue.actions.result_review'})).not.toBeInTheDocument();
});
test('search, family and pagination are sent to the server and retained in the address',async()=>{
  getWorkspace.mockResolvedValue(result([item()],{pagination:{total:25}}));show();await screen.findByRole('article');
  userEvent.type(screen.getByLabelText('workspaceQueue.search'),'compteur');userEvent.click(screen.getByRole('button',{name:'workspaceQueue.find'}));
  await waitFor(()=>expect(getWorkspace).toHaveBeenCalledWith(expect.objectContaining({q:'compteur',page:1})));
  userEvent.selectOptions(screen.getByLabelText('workspaceQueue.kind'),'service');
  await waitFor(()=>expect(getWorkspace).toHaveBeenCalledWith(expect.objectContaining({q:'compteur',kind:'service'})));
  userEvent.click(screen.getByRole('button',{name:'Page 2'}));await waitFor(()=>expect(getWorkspace).toHaveBeenCalledWith(expect.objectContaining({page:2})));
  expect(mockLocation.search).toContain('q=compteur');expect(mockLocation.search).toContain('page=2');
});
test('network errors retain the same scope; revoked access clears the queue and counters',async()=>{
  show();await screen.findByRole('article');getWorkspace.mockRejectedValueOnce(new Error('offline'));userEvent.click(screen.getByRole('button',{name:'operations.refresh'}));
  await screen.findByRole('alert');expect(screen.getByRole('article')).toBeInTheDocument();
  getWorkspace.mockRejectedValueOnce({response:{status:403}});userEvent.click(screen.getByRole('button',{name:'operations.refresh'}));
  await waitFor(()=>expect(screen.queryByRole('article')).not.toBeInTheDocument());expect(mockSummary).toHaveBeenLastCalledWith(null);
});
test('a response from a previous role never appears in the new role’s queue',async()=>{
  let resolve;getWorkspace.mockImplementationOnce(()=>new Promise((done)=>{resolve=done;}));const view=show();await waitFor(()=>expect(getWorkspace).toHaveBeenCalled());
  mockGeo.user={id:7,role:'agent'};getWorkspace.mockResolvedValue(result([item({title:'Travail de l’agent'})]));view.rerender(<WorkspaceQueue view="action" active onSummary={mockSummary}/>);
  await screen.findByRole('article',{name:'Travail de l’agent'});await act(async()=>resolve(result([item({title:'Ancien dossier privé'})])));
  expect(screen.queryByText('Ancien dossier privé')).not.toBeInTheDocument();
});
test('a hidden queue does not refresh or discard an unsent search draft',async()=>{
  const view=show();await screen.findByRole('article');userEvent.type(screen.getByLabelText('workspaceQueue.search'),'Brouillon');
  view.rerender(<WorkspaceQueue view="action" active={false} onSummary={mockSummary}/>);fireEvent.online(window);
  await act(async()=>Promise.resolve());expect(getWorkspace).toHaveBeenCalledTimes(1);expect(screen.getByLabelText('workspaceQueue.search')).toHaveValue('Brouillon');
});
test('coordination, dispute and project-step targets stay typed and specific',()=>{
  expect(workspaceTarget(item({action:{code:'coordinate',kind:'service',id:14}}),'admin')).toBe('/operations?vue=coordonner&type=service&demande=14');
  expect(workspaceTarget(item({action:{code:'resolve',kind:'service',id:14}}),'admin')).toBe('/admin/disputes?serviceId=14');
  expect(workspaceTarget(item({kind:'project',action:{code:'step_review',kind:'task',id:29}}),'admin')).toBe('/tasks/29');
});
test('administrative queues honor the selected territory in addition to server-side authorization',async()=>{
  mockGeo.user={id:7,role:'admin'};show();await screen.findByRole('article');
  expect(getWorkspace).toHaveBeenCalledWith(expect.objectContaining({countryId:99,regionId:null}));
});
