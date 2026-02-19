/**
 * Browser Test: Mobile Shipper (Expo Web - localhost:8081)
 * Handles: Onboarding -> Login -> Dashboard -> Loads -> Trucks
 * Run: node scripts/browser-test-mobile.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const URL = 'http://localhost:8081';
const DIR = './browser-test-results';
mkdirSync(DIR, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: true,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  // Log console errors
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('401') && !msg.text().includes('500')) {
      console.log(`   [ERR] ${msg.text().substring(0, 120)}`);
    }
  });

  try {
    // 1. Load app
    console.log('1. Loading Expo Web...');
    await page.goto(URL, { waitUntil: 'load', timeout: 30000 });

    // Wait for React Native Web to render
    await page.waitForFunction(() => {
      return document.querySelectorAll('div').length > 20;
    }, { timeout: 30000 });
    await sleep(3000);
    await page.screenshot({ path: `${DIR}/mobile-01-loaded.png`, fullPage: true });

    const bodyText = await page.textContent('body');
    console.log(`   Page content: ${bodyText.substring(0, 150)}`);

    // 2. Handle Onboarding (Skip or Next through it)
    console.log('\n2. Onboarding...');
    if (bodyText.includes('Find Loads') || bodyText.includes('Skip')) {
      // Click Skip to bypass onboarding
      const skipBtn = await page.$('div:has-text("Skip"):not(:has(div:has-text("Skip")))');
      if (skipBtn) {
        console.log('   Clicking Skip...');
        await skipBtn.click();
        await sleep(2000);
      } else {
        // Try clicking multiple "Next" then "Get Started"
        for (let i = 0; i < 4; i++) {
          const nextBtn = await page.$('div[role="button"]:has-text("Next")');
          const getStartedBtn = await page.$('div[role="button"]:has-text("Get Started")');
          if (getStartedBtn) {
            await getStartedBtn.click();
            console.log('   Clicked Get Started');
            break;
          } else if (nextBtn) {
            await nextBtn.click();
            console.log(`   Clicked Next (${i + 1})`);
            await sleep(1000);
          }
        }
      }
      await sleep(2000);
      await page.screenshot({ path: `${DIR}/mobile-02-after-onboarding.png`, fullPage: true });
      console.log(`   URL: ${page.url()}`);
    }

    // 3. Login screen
    console.log('\n3. Login...');
    const bodyAfterOnboard = await page.textContent('body');
    console.log(`   Content: ${bodyAfterOnboard.substring(0, 200)}`);

    // React Native Web TextInput renders as <input> inside complex div structure
    // Find all input-like elements
    const allInputs = await page.$$('input');
    console.log(`   HTML inputs: ${allInputs.length}`);

    // Also check for contenteditable divs (RN Web sometimes uses these)
    const editables = await page.$$('[contenteditable="true"]');
    console.log(`   Contenteditable: ${editables.length}`);

    // Check for RN TextInput (rendered as input with specific attributes)
    const rnInputs = await page.$$('input[data-focusable], input[dir="auto"]');
    console.log(`   RN TextInput elements: ${rnInputs.length}`);

    // Try all input selectors
    let emailInput = null;
    let pwInput = null;

    // Gather all inputs and their attributes
    for (let i = 0; i < allInputs.length; i++) {
      const attrs = await allInputs[i].evaluate(el => ({
        type: el.type, placeholder: el.placeholder, name: el.name,
        autoComplete: el.autocomplete, id: el.id,
        'aria-label': el.getAttribute('aria-label'),
      }));
      console.log(`   Input[${i}]:`, JSON.stringify(attrs));

      if (attrs.type === 'email' || attrs.placeholder?.toLowerCase().includes('email') ||
          attrs.autoComplete === 'email' || attrs['aria-label']?.toLowerCase().includes('email')) {
        emailInput = allInputs[i];
      } else if (attrs.type === 'password' || attrs.placeholder?.toLowerCase().includes('password') ||
                 attrs.autoComplete === 'current-password' || attrs['aria-label']?.toLowerCase().includes('password')) {
        pwInput = allInputs[i];
      }
    }

    // Fallback: first two inputs
    if (!emailInput && allInputs.length >= 2) {
      emailInput = allInputs[0];
      pwInput = allInputs[1];
      console.log('   Using first two inputs as email/password');
    } else if (!emailInput && allInputs.length === 1) {
      emailInput = allInputs[0];
      console.log('   Only one input found, treating as email');
    }

    if (emailInput) {
      await emailInput.fill('agri-shipper@demo.com');
      console.log('   Email filled');
    }
    if (pwInput) {
      await pwInput.fill('password');
      console.log('   Password filled');
    }

    await page.screenshot({ path: `${DIR}/mobile-03-login-filled.png`, fullPage: true });

    // Find and click login/sign-in button
    if (emailInput || pwInput) {
      const allBtns = await page.$$('div[role="button"], button');
      let clicked = false;
      for (const btn of allBtns) {
        const txt = (await btn.textContent().catch(() => '')).trim().toLowerCase();
        if (txt.includes('sign in') || txt.includes('login') || txt === 'log in') {
          console.log(`   Clicking: "${txt}"`);
          await btn.click();
          clicked = true;
          break;
        }
      }
      if (!clicked && pwInput) {
        console.log('   No button found, pressing Enter');
        await pwInput.press('Enter');
      }
      await sleep(5000);
      await page.screenshot({ path: `${DIR}/mobile-04-after-login.png`, fullPage: true });
      console.log(`   After login URL: ${page.url()}`);

      const afterLogin = await page.textContent('body');
      console.log(`   After login content: ${afterLogin.substring(0, 200)}`);
    }

    // 4. Dashboard
    console.log('\n4. Dashboard...');
    await sleep(2000);
    const dashText = await page.textContent('body');
    const hasDashboard = dashText.includes('Dashboard') || dashText.includes('Active') ||
                         dashText.includes('Total Loads') || dashText.includes('In Transit');
    console.log(`   Has dashboard content: ${hasDashboard}`);
    if (hasDashboard) {
      console.log(`   Dashboard text: ${dashText.substring(0, 400)}`);
    }
    await page.screenshot({ path: `${DIR}/mobile-05-dashboard.png`, fullPage: true });

    // 5. Navigate to My Loads
    console.log('\n5. My Loads...');
    // Look for tab navigation (bottom tabs in RN)
    const bottomTabs = await page.$$('div[role="button"], a[href*="loads"]');
    for (const tab of bottomTabs) {
      const txt = (await tab.textContent().catch(() => '')).trim();
      if (txt.includes('Loads') || txt.includes('My Loads')) {
        console.log(`   Clicking tab: "${txt.substring(0, 30)}"`);
        await tab.click();
        await sleep(3000);
        break;
      }
    }
    await page.screenshot({ path: `${DIR}/mobile-06-loads.png`, fullPage: true });
    const loadsText = await page.textContent('body');
    console.log(`   Loads content: ${loadsText.substring(0, 300)}`);

    // 6. Find Trucks
    console.log('\n6. Find Trucks...');
    const trucksTab = await page.$$('div[role="button"], a[href*="trucks"]');
    for (const tab of trucksTab) {
      const txt = (await tab.textContent().catch(() => '')).trim();
      if (txt.includes('Trucks') || txt.includes('Find')) {
        console.log(`   Clicking tab: "${txt.substring(0, 30)}"`);
        await tab.click();
        await sleep(3000);
        break;
      }
    }
    await page.screenshot({ path: `${DIR}/mobile-07-trucks.png`, fullPage: true });
    const trucksText = await page.textContent('body');
    console.log(`   Trucks content: ${trucksText.substring(0, 300)}`);

    // 7. Check for shipments/trips tab
    console.log('\n7. Shipments...');
    const shipTabs = await page.$$('div[role="button"]');
    for (const tab of shipTabs) {
      const txt = (await tab.textContent().catch(() => '')).trim();
      if (txt.includes('Shipment') || txt.includes('Trip')) {
        console.log(`   Clicking: "${txt.substring(0, 30)}"`);
        await tab.click();
        await sleep(3000);
        break;
      }
    }
    await page.screenshot({ path: `${DIR}/mobile-08-shipments.png`, fullPage: true });

  } catch (e) {
    console.log(`\nError: ${e.message}`);
    await page.screenshot({ path: `${DIR}/mobile-error.png`, fullPage: true }).catch(() => {});
  }

  await browser.close();
  console.log('\nDone. Screenshots in:', DIR);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
