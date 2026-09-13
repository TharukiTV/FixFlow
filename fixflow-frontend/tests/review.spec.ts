import {test,expect} from '@playwright/test'
test('admin corrects suggestion while original remains visible',async({page})=>{
  let ticket={id:1,description:'Wi-Fi failure',location:'Lab',status:'OPEN',createdAt:'2026-09-12T00:00:00Z',assignedTechnician:null,aiMode:'GEMINI',aiCategory:'IT',aiPriority:'MEDIUM',aiSummary:'Network issue',reviewedCategory:null as string|null,reviewedPriority:null as string|null,reviewedSummary:null as string|null,reviewedAt:null as string|null}
  await page.route('**/api/auth/me',route=>route.fulfill({json:{email:'admin@example.test',name:'Admin',role:'ADMIN'}}))
  await page.route('**/api/auth/csrf',route=>route.fulfill({json:{headerName:'X-CSRF-TOKEN',token:'test'}}))
  await page.route('**/api/incidents**',route=>{
    if(route.request().url().endsWith('/technicians')) return route.fulfill({json:[]})
    if(route.request().method()==='PATCH') {
      const review=route.request().postDataJSON()
      ticket={...ticket,reviewedCategory:review.category,reviewedPriority:review.priority,reviewedSummary:review.summary,reviewedAt:'2026-09-12T01:00:00Z'}
      return route.fulfill({json:ticket})
    }
    return route.fulfill({json:[ticket]})
  })
  await page.goto('/')
  await expect(page.getByText('Awaiting admin review')).toBeVisible()
  await page.getByText('Confirm or correct classification',{exact:true}).click()
  await page.getByLabel('Category',{exact:true}).selectOption('ELECTRICAL')
  await page.getByLabel('Priority',{exact:true}).selectOption('HIGH')
  await page.getByLabel('Review summary').fill('Power issue confirmed.')
  await page.getByRole('button',{name:'Save review',exact:true}).click()
  await expect(page.getByText('Reviewed by admin',{exact:true})).toBeVisible()
  await expect(page.locator('.saved-analysis > p').filter({hasText:'Power issue confirmed.'})).toBeVisible()
  await page.getByText('Original Gemini suggestion',{exact:true}).click()
  await expect(page.getByText('Network issue',{exact:true})).toBeVisible()
  await page.reload()
  await expect(page.getByText('Reviewed by admin',{exact:true})).toBeVisible()
})
