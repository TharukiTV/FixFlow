import {test, expect} from '@playwright/test'
for (const role of ['ADMIN','TECHNICIAN']) {
  test(`${role} workspace actions`, async ({page}) => {
    let ticket={id:1, description:'Repair lab projector',location:'Lab 2',status:'OPEN',createdAt:'2026-09-12T05:00:00Z',assignedTechnician:role==='TECHNICIAN'?'tech@example.test':null}
    await page.route('**/api/auth/me',route=>route.fulfill({json:{email:'team@example.test',name:'Team member',role}}))
    await page.route('**/api/auth/csrf',route=>route.fulfill({json:{headerName:'X-CSRF-TOKEN',token:'test'}}))
    await page.route('**/api/incidents**',route=>{
      if(route.request().url().endsWith('/technicians')) return route.fulfill({json:[{email:'tech@example.test',name:'Sam Technician',role:'TECHNICIAN'}]})
      if(route.request().method()==='PATCH') {
        const body=route.request().postDataJSON()
        ticket={...ticket,...(body.status?{status:body.status,cause:body.cause,resolution:body.resolution,resolvedAt:'2026-09-13T00:00:00Z'}:{assignedTechnician:body.technicianEmail})}
        return route.fulfill({json:ticket})
      }
      return route.fulfill({json:[ticket]})
    })
    await page.goto('/')
    const card=page.getByRole('article')
    await expect(page.getByRole('button',{name:'Submit issue'})).toHaveCount(0)
    if(role==='ADMIN') {
      await expect(card.getByRole('button',{name:'Save status'})).toHaveCount(0)
      await card.getByRole('combobox').selectOption('tech@example.test')
      await card.getByRole('button',{name:'Assign ticket'}).click()
      await expect(card.getByText('Assigned to: tech@example.test')).toBeVisible()
    } else {
      await expect(card.getByRole('button',{name:'Assign ticket'})).toHaveCount(0)
      await card.getByRole('combobox').selectOption('RESOLVED')
      await card.getByLabel('Cause',{exact:true}).fill('Faulty HDMI adapter')
      await card.getByLabel('Resolution',{exact:true}).fill('Replaced adapter and tested projector')
      await card.getByRole('button',{name:'Save status'}).click()
      await expect(card.locator('.badge')).toHaveText('Resolved')
      await expect(card.getByLabel('Resolution notes')).toContainText('Replaced adapter and tested projector')
    }
  })
}
