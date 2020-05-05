const puppeteer = require('puppeteer');
const fs = require('fs');
const utils = require('./utils');


async function getFillaments(page, url) {
  await page.goto(url);

  const data = await page.evaluate(
    () => [...document.querySelectorAll(".item.product.product-item")].map(element => {
      const price = element.querySelector(".price-container span").dataset.priceAmount;
      const title = element.querySelector(".product-item-link").textContent.trim();
      return {
        title: title,
        outofstock: !!element.querySelector(".stock.unavailable"),
        price: price,
        currency: "DKK",
        url: element.querySelector("a").href,
        categories: [],
      }
    })
  );

  const nextPageUrl = await page.evaluate(
    () => !!document.querySelector(".action.next") ? document.querySelector(".action.next").href : null
  );

  return { data, nextPageUrl };
}

async function scrapeList(page) {
  const filename = "3deksperten-filament.json"

  if (utils.useCache(filename)) {
    console.log('Using cache from last 24 hours')
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } else if(fs.existsSync(filename)) {
    fs.unlinkSync(filename);
  }

  let hasNextPage = true;
  let results = [] ;
  let url = 'https://3deksperten.dk/filament.html?product_list_limit=200';

  while (hasNextPage) {
    console.log('fetching ' + url);
    let {data, nextPageUrl } = await getFillaments(page, url);
    results = [...results, ...data];
    if (!nextPageUrl) {
      hasNextPage = false;
    }
    url = nextPageUrl;
    await utils.sleep(utils.random(1, 3) * 1000)
  }

  fs.writeFileSync(filename, JSON.stringify(results, null, 2));

  return results;
}

(async () => {
  // 3deksperten.dk, 3Dstore.dk, Filament23D.dk, in2motion.dk, Techbitshop.dk, 3djake.com, www.reprap.me
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const listInfo = await scrapeList(page);
  let existing = []
  try {
    existing = JSON.parse(fs.readFileSync("3deksperten-details.json"));
  } catch {

  }
  return;

  const existingUrls = existing.map(x => x.url)
  const fitleredList = listInfo.filter(x => !existingUrls.includes(x.url));
  console.log(`intial list ${listInfo.length}. list to fetch: ${fitleredList.length}`);

  let details = [...existing];

  for (let i= 0; i < fitleredList.length-1; i++) {
    const filament = fitleredList[i];
    console.log('fetching info from', filament.url);
    await utils.sleep(2000);
    await page.goto(filament.url);
    let props = {}; 

    const attributes = await page.evaluate(
      () => [...document.querySelectorAll(".woocommerce-product-attributes-item")]
        .map(x => {
          return x.textContent
            .split("\n")
            .map(s => s.trim() ? s.trim() : null)
            .filter(t => t)
        })
    );
    attributes.forEach(element => {
      props[element[0]] = element[1]
    });
    details.push({...filament, props});
    fs.writeFileSync("3dstore-details.json", JSON.stringify(details, null, 2))
  }

})();
