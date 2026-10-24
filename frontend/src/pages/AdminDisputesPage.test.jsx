import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminDisputesPage from './AdminDisputesPage';
import { listMissionDisputes } from '../services/missions';
let mockSearch='?serviceId=14';
const mockSetSearch=jest.fn();
jest.mock('react-router-dom',()=>({useSearchParams:()=>[new URLSearchParams(mockSearch),mockSetSearch],Link:({to,children,...props})=><a href={to} {...props}>{children}</a>}),{virtual:true});
jest.mock('react-i18next',()=>{const t=(key)=>key;return{useTranslation:()=>({t})};});
jest.mock('../services/missions',()=>({listMissionDisputes:jest.fn(),updateMissionDispute:jest.fn()}));
jest.mock('../i18n/useLocale',()=>({useLocale:()=>({formatDate:String})}));
jest.mock('../utils/notify',()=>({notify:jest.fn()}));
const dispute=(serviceId)=>({id:serviceId,serviceId,status:'open',reason:'autre',description:'Résultat à vérifier',service:{title:`Problème du dossier ${serviceId}`}});
beforeEach(()=>{jest.clearAllMocks();mockSearch='?serviceId=14';listMissionDisputes.mockResolvedValue([dispute(14)]);});
test('a case from the queue restricts the request and offers an explicit return to all problems',async()=>{
  render(<AdminDisputesPage/>);await screen.findByText('Problème du dossier 14');
  expect(listMissionDisputes).toHaveBeenCalledWith({serviceId:14});
  fireEvent.click(screen.getByRole('button',{name:'workspaceQueue.allProblems'}));expect(mockSetSearch).toHaveBeenCalledWith({});
});
test('a late response for an old case cannot replace the currently selected problem',async()=>{
  let resolve;listMissionDisputes.mockImplementationOnce(()=>new Promise((done)=>{resolve=done;}));const view=render(<AdminDisputesPage/>);
  await waitFor(()=>expect(listMissionDisputes).toHaveBeenCalled());mockSearch='?serviceId=15';listMissionDisputes.mockResolvedValue([dispute(15)]);view.rerender(<AdminDisputesPage/>);
  await screen.findByText('Problème du dossier 15');await act(async()=>resolve([dispute(14)]));expect(screen.queryByText('Problème du dossier 14')).not.toBeInTheDocument();
});
