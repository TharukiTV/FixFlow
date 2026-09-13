import { test, expect } from '@playwright/test'
test('register, sign in, retain session, sign out, and expire session', async ({page}) => {
  let signedIn = false
  await page.route('**/api/auth/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/csrf')) return route.fulfill({json:{headerName:'X-CSRF-TOKEN', token:'test-token'}})
    if (path.endsWith('/register')) return route.fulfill({status:201})
    if (path.endsWith('/login')) { signedIn=true; return route.fulfill({status:204}) }
    if (path.endsWith('/logout')) {signedIn=false; return route.fulfill({status:204})}
    return route.fulfill(signedIn ? {json:{email:'test@example.test',name:'Test User',role:'USER'}} : {status:401})
  })
  await page.route('**/api/incidents', route => route.fulfill({json:[]}))
  await page.goto('/')
  await page.getByRole('button',{name:'New here? Create an account'}).click()
  await page.getByLabel('Name',{exact:true}).fill('Test User')
  await page.getByLabel('Email',{exact:true}).fill('test@example.test')
  await page.getByLabel('Password',{exact:true}).fill('test-password-123')
  await page.getByRole('button',{name:'Create account',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Account created')
  await page.getByLabel('Password',{exact:true}).fill('test-password-123')
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page.getByText('Test User',{exact:true})).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Sign out',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible()
  await page.getByLabel('Email',{exact:true}).fill('test@example.test')
  await page.getByLabel('Password',{exact:true}).fill('test-password-123')
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page.getByRole('button',{name:'Refresh',exact:true})).toBeVisible()
  await page.unroute('**/api/incidents')
  await page.route('**/api/incidents', route => route.fulfill({status:401}))
  await page.getByRole('button',{name:'Refresh',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible()
  await expect(page.getByRole('status')).toContainText('session expired')
})
