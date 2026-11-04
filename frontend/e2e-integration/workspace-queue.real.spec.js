const {test,expect}=require('@playwright/test');
const {API_BASE_URL,loginAsSeededAdmin,loginAsSeededAgent,loginAsSeededClient,seedAuthenticatedSession,blockExternalTracking}=require('./support/realApi');
const headers=(session)=>({Authorization:`Bearer ${session.token}`});
test('real work centre groups three steps and opens the exact intervention while retaining the queue search',async({page,request},testInfo)=>{
  const admin=await loginAsSeededAdmin(request),agent=await loginAsSeededAgent(request),client=await loginAsSeededClient(request);
  const title=`Dossier regroupé ${Date.now()}`;
  const creation=await request.post(`${API_BASE_URL}/services`,{headers:headers(client),data:{title,type:'other'}});expect(creation.status()).toBe(201);const service=(await creation.json()).service;
  expect((await request.post(`${API_BASE_URL}/services/assign`,{headers:headers(admin),data:{serviceId:service.id,agentId:agent.user.id}})).status()).toBe(200);
  expect((await request.post(`${API_BASE_URL}/services/agent/services/${service.id}/start`,{headers:headers(agent)})).status()).toBe(200);
  for(let index=0;index<3;index+=1){
    const result=await request.post(`${API_BASE_URL}/tasks`,{headers:headers(client),data:{serviceId:service.id,title:`Contrôle ${index+1}`,type:'visit'}});expect(result.status()).toBe(201);const task=(await result.json()).task;
    expect((await request.put(`${API_BASE_URL}/tasks/${task.id}/assign`,{headers:headers(admin),data:{agentId:agent.user.id}})).status()).toBe(200);
  }
  const queue=await request.get(`${API_BASE_URL}/v1/operations/workspace`,{headers:headers(agent),params:{q:title}});expect(queue.status()).toBe(200);const data=await queue.json();
  expect(data.items).toHaveLength(1);expect(data.items[0].actionStepCount).toBe(3);
  await page.setViewportSize({width:360,height:900});await blockExternalTracking(page);await seedAuthenticatedSession(page,agent.user,agent.token);
  await page.goto(`/operations?vue=a-faire&q=${encodeURIComponent(title)}`);
  const card=page.getByRole('article',{name:title});await expect(card).toBeVisible();await expect(card.getByText('3 étape(s) vous attendent',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);await page.screenshot({path:testInfo.outputPath('grouped-work-mobile.png'),fullPage:true});
  await card.getByRole('link',{name:'Commencer une étape',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/services/${service.id}\\?etape=\\d+#steps$`));
  const step=page.getByRole('article');await step.getByRole('button',{name:'Commencer l’étape',exact:true}).click();await expect(step.getByRole('button',{name:'Terminer l’étape',exact:true})).toBeVisible();
  await page.getByRole('link',{name:/Retour à l’accueil/}).click();await expect(page.getByLabel('Rechercher un dossier, une étape ou une référence',{exact:true})).toHaveValue(title);
  await page.getByRole('button',{name:'À suivre (0)',exact:true}).click();await expect(page.getByRole('article')).toHaveCount(0);
});
test('real work centre keeps a property-only task actionable without creating or revealing a service',async({page,request})=>{
  const admin=await loginAsSeededAdmin(request),agent=await loginAsSeededAgent(request),client=await loginAsSeededClient(request);
  const creation=await request.post(`${API_BASE_URL}/properties`,{headers:headers(client),data:{title:`Maison de recette ${Date.now()}`,type:'house',address:'Adresse de recette',city:'Bamako',latitude:12.6392,longitude:-8.0029}});expect(creation.status()).toBe(201);const property=(await creation.json()).property;expect(property?.id).toBeTruthy();
  const title=`Relevé du bien ${Date.now()}`;
  const created=await request.post(`${API_BASE_URL}/tasks`,{headers:headers(client),data:{propertyId:property.id,title,type:'visit'}});expect(created.status()).toBe(201);const task=(await created.json()).task;expect(task.serviceId).toBeNull();
  expect((await request.put(`${API_BASE_URL}/tasks/${task.id}/assign`,{headers:headers(admin),data:{agentId:agent.user.id}})).status()).toBe(200);
  await blockExternalTracking(page);await seedAuthenticatedSession(page,agent.user,agent.token);await page.goto(`/operations?vue=a-faire&q=${encodeURIComponent(title)}`);
  await page.getByRole('article',{name:title}).getByRole('link',{name:'Commencer une étape',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`));
  await expect(page.getByRole('link',{name:'Retour au dossier du service',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Commencer l’étape',exact:true}).click();await expect(page.getByRole('button',{name:'Terminer l’étape',exact:true})).toBeVisible();
});

test('a real property opens its intervention archive and returns to the same context', async ({ page, request }) => {
  const client = await loginAsSeededClient(request);
  const title = `Bien et intervention ${Date.now()}`;
  const creation = await request.post(`${API_BASE_URL}/properties`, { headers: headers(client), data: { title, type: 'house', address: 'Adresse de recette', city: 'Bamako', latitude: 12.6392, longitude: -8.0029 } });
  expect(creation.status()).toBe(201); const property = (await creation.json()).property;
  const created = await request.post(`${API_BASE_URL}/tasks`, { headers: headers(client), data: { propertyId: property.id, title: `Visite ${title}`, type: 'visit' } });
  expect(created.status()).toBe(201); const task = (await created.json()).task;
  await blockExternalTracking(page); await seedAuthenticatedSession(page, client.user, client.token);
  await page.goto('/properties');
  await page.locator(`a[href="/properties/${property.id}"]`).click();
  await page.getByText('Interventions et historique', { exact: true }).click();
  await page.getByRole('article', { name: `Visite ${title}`, exact: true }).getByRole('link', { name: 'Ouvrir l’intervention', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`));
  await expect(page.getByRole('heading', { name: `Visite ${title}`, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retour au dossier du service', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Retour au bien', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/properties/${property.id}#property-interventions$`));
  await expect(page.getByRole('article', { name: `Visite ${title}`, exact: true })).toBeVisible();
});
