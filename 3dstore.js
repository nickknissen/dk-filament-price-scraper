const puppeteer = require('puppeteer');
const fs = require('fs');
const utils = require('./utils');


async function extractListInfo(page, url) {
  await page.goto(url);

  const data = await page.evaluate(
    () => [...document.querySelectorAll(".product-small.col")].map(element => {
      const [price, currency] = element.querySelector(".woocommerce-Price-amount.amount").textContent.split(" ")
      const title = element.querySelector(".name.product-title").textContent;
      return {
        title: title,
        outofstock: !!element.querySelector(".out-of-stock-label"),
        price: price,
        currency: currency,
        url: element.querySelector("a").href,
        categories: [...element.classList].filter(x => x.includes('product_cat-')).map(x => x.replace("product_cat-", "")),
      }
    })
  );

  const nextPageUrl = await page.evaluate(
    () => !!document.querySelector(".next.page-number") ? document.querySelector(".next.page-number").href : null
  );

  return { data, nextPageUrl };
}

async function extractDetailInfo(page) {
    let props = {}; 
    let type = "unknown" ;

    const productId = await page.evaluate(() => [...document.body.classList].filter(x => x.includes("postid")).shift().replace("postid-", ""))

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

    if (props.hasOwnProperty("Type")) {
      type = utils.detectType(props["Type"]);
    } else if (page.url().includes("resin")) {
      type = "resin";
    }

    return {
      props: props,
      id: productId,
      type: type 
    }
}

async function scrapeList(page) {
  const filename = "3dstore-filament.json"
  let url = 'https://3dstore.dk/filament/';

  if (utils.useCache(filename)) {
    console.log('Using cache from last 24 hours')
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } else {
    fs.unlinkSync(filename);
  }

  let hasNextPage = true;
  let results = [] ;

  while (hasNextPage) {
    console.log('fetching from: ' + url);
    let { data, nextPageUrl } = await extractListInfo(page, url);
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
    existing = JSON.parse(fs.readFileSync("3dstore-details.json"));
  } catch {
  }

  const existingUrls = existing.map(x => x.url)
  const fitleredList = listInfo.filter(x => !existingUrls.includes(x.url));
  console.log(`intial list ${listInfo.length}. list to fetch: ${fitleredList.length}`);

  let details = [...existing];

  for (let i= 0; i < fitleredList.length-1; i++) {
    const filament = fitleredList[i];
    console.log(`fetch details from ${filament.url}`)
    await utils.sleep(2000);
    await page.goto(filament.url);

    const props = await extractDetailInfo(page);

    details.push({...filament, ...props});
    fs.writeFileSync("3dstore-details.json", JSON.stringify(details, null, 2))
  }

})();
