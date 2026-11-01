// Exercise native keyboard/focus navigation without depending on visible controls.
export async function showHeroAd(page, index) {
  const rail = page.locator('.landing-promos__rail');
  const scrollable = await rail.evaluate(element => element.scrollWidth > element.clientWidth + 2);
  if (scrollable) { await rail.focus(); await page.keyboard.press(index === await rail.locator('.landing-promo').count() - 1 ? 'End' : 'Home'); }
  await rail.locator('.landing-promo').nth(index).getByRole('link').first().focus();
  await rail.locator('.landing-promo').nth(index).scrollIntoViewIfNeeded();
  await page.waitForFunction(index => {
    const rail = document.querySelector('.landing-promos__rail').getBoundingClientRect();
    const card = document.querySelectorAll('.landing-promo')[index].getBoundingClientRect();
    return card.left >= rail.left - 2 && card.right <= rail.right + 2;
  }, index);
}
