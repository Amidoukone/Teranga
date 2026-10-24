const {test,expect}=require('@playwright/test');
const {installApiMocks,seedAuthenticatedSession}=require('./support/mockApi');
for(const width of [360,1440]) {
  test(`one work centre separates actions, following and information at ${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:900});
    const rows=[...Array.from({length:25},(_,index)=>({key:`service:${index+1}`,kind:'service',id:index+1,title:`Résultat à vérifier ${index+1}`,status:'completed',action:{code:'result_review',kind:'service',id:index+1}})),
      {key:'service:9000',kind:'service',id:9000,title:'Ancien résultat à examiner',status:'completed',action:{code:'result_review',kind:'service',id:9000}},
      {key:'project:1',kind:'project',id:1,title:'Projet à confirmer',status:'completed',action:{code:'result_review',kind:'project',id:1}},
      {key:'order:77',kind:'order',id:77,title:'CMD-SUIVI',status:'processing',action:null}];
    const service={id:9000,title:'Ancien résultat à examiner',status:'completed',type:'other'};
    const ctx=await installApiMocks(page,{state:{workspaceItems:rows,services:[service]}});await seedAuthenticatedSession(page,ctx.user,ctx.token);
    await page.addInitScript(()=>{localStorage.setItem('teranga_lang','fr');localStorage.setItem('i18nextLng','fr');localStorage.setItem('teranga_analytics_consent','denied');});
    await page.route('**/api/**',async(route)=>{
      const path=new URL(route.request().url()).pathname.replace(/^\/api(?:\/v1)?/,'');
      if(path==='/services/9000')return route.fulfill({json:{service}});
      return route.fallback();
    });
    await page.goto('/operations');const main=page.getByRole('main');
    await expect(main.getByRole('button',{name:'À faire (27)',exact:true})).toBeVisible();
    await expect(main.getByRole('button',{name:'À suivre (1)',exact:true})).toBeVisible();
    await expect(main.getByRole('button',{name:'Informations (1)',exact:true})).toBeVisible();
    await expect(main.getByRole('article')).toHaveCount(20);await main.getByRole('button',{name:'Page 2',exact:true}).click();
    await expect(main.getByRole('article')).toHaveCount(7);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
    await page.screenshot({path:testInfo.outputPath('work-centre.png'),fullPage:true});
    await main.getByLabel('Rechercher un dossier, une étape ou une référence',{exact:true}).fill('Ancien');
    await main.getByRole('button',{name:'Rechercher',exact:true}).click();await expect(main.getByRole('article')).toHaveCount(1);
    await main.getByRole('link',{name:'Vérifier le résultat',exact:true}).click();await expect(page).toHaveURL(/\/services\/9000$/);
    await main.getByRole('link',{name:/Retour aux services/}).click();
    await expect(main.getByLabel('Rechercher un dossier, une étape ou une référence',{exact:true})).toHaveValue('Ancien');
    await main.getByLabel('Rechercher un dossier, une étape ou une référence',{exact:true}).fill('');await main.getByRole('button',{name:'Rechercher',exact:true}).click();
    await main.getByRole('button',{name:'À suivre (1)',exact:true}).click();await expect(main.getByRole('article',{name:'CMD-SUIVI'})).toBeVisible();
    await main.getByRole('button',{name:'Informations (1)',exact:true}).click();
    await main.getByRole('button',{name:'Marquer comme lu',exact:true}).click();await expect(main.getByRole('heading',{name:'Vous êtes à jour',exact:true})).toBeVisible();
    await main.getByRole('button',{name:'Tout le suivi',exact:true}).click();await expect(main.getByRole('article')).toHaveCount(1);
    expect(ctx.state.workspaceItems.filter((item)=>item.action)).toHaveLength(27);
  });
}
test('an agent opens a property intervention from the same queue without gaining a parent service',async({page})=>{
  const task={id:29,title:'Relever le compteur',status:'created',assignedTo:101,type:'visit',priority:'normal'};
  const ctx=await installApiMocks(page,{user:{role:'agent'},state:{tasks:[task],workspaceItems:[{key:'task:29',kind:'task',id:29,title:task.title,status:'created',openStepCount:1,actionStepCount:1,action:{code:'step_start',kind:'task',id:29}}]}});
  await seedAuthenticatedSession(page,ctx.user,ctx.token);await page.addInitScript(()=>{localStorage.setItem('teranga_lang','fr');localStorage.setItem('i18nextLng','fr');});
  await page.goto('/operations');await page.getByRole('link',{name:'Commencer une étape',exact:true}).click();
  await expect(page).toHaveURL(/\/tasks\/29$/);await expect(page.getByRole('link',{name:'Retour au dossier du service',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Commencer l’étape',exact:true}).click();await expect(page.getByRole('button',{name:'Terminer l’étape',exact:true})).toBeVisible();
});
