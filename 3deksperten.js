const puppeteer = require('puppeteer');
const fs = require('fs');
const utils = require('./utils');


async function extraListInfo(page, url) {
  await page.goto(url);

  const data = await page.evaluate(
    () => [...document.querySelectorAll(".item.product.product-item")].map(element => {
      if (!element.querySelector(".price-container span")) {
        return;
      }
      const price = element.querySelector(".price-container span").dataset.priceAmount;
      const title = element.querySelector(".product-item-link").textContent.trim();
      const id = element.querySelector(".price-box").dataset.productId
      return {
        title,
        id,
        price,
        outofstock: !!element.querySelector(".stock.unavailable"),
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
  const filename = `output/3deksperten-filament-${utils.getToday()}.json`

  let url = 'https://3deksperten.dk/filament.html?product_list_limit=200';

  if (fs.existsSync(filename)) {
    console.log('Using cache from last 24 hours')
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  }

  let hasNextPage = true;
  let results = [];

  while (hasNextPage) {
    console.log('fetching ' + url);
    let { data, nextPageUrl } = await extraListInfo(page, url);

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



async function extractDetailInfo(page) {


  const type = await page.evaluate(async () => {
    let filamentType  = "unknown";

    const title = document.querySelector(".page-title").textContent;
    filamentType = await window.detectType(title);

    if (filamentType != "unknown") {
      return filamentType;
    }

    if (!!document.querySelector("#tab-label-description-title")) {
      filamentType = await window.detectType(document.querySelector(".product.attribute.description .value").textContent);
    }

    if (filamentType != "unknown") {
      return filamentType;
    }

    return await window.detectType(document.querySelector(".product.attribute.overview .value").textContent);
  });

  const width = await page.evaluate(async () => {
    let width = "unknown";

    const title = document.querySelector(".page-title").textContent;
    width = await window.detectWidth(title);

    if (width != "unknown") {
      return width;
    }

    if (!!document.querySelector("#tab-label-description-title")) {
      width = await window.detectWidth(
        document.querySelector(".product.attribute.description .value").textContent
      );
    }

    if (width != "unknown") {
      return width;
    }

    return await window.detectWidth(document.querySelector(".product.attribute.overview .value").textContent);
  });

  const props = await page.evaluate(
    () => {
      let descriptionProps = [];
      const overviewProps = document.querySelector(".product.attribute.overview .value")
        .textContent
        .split("\n")
        .filter(x => x.includes(":"))
        .map(x => x.split(":"))
        .reduce((carry, item) => {
          carry[item[0].trim()] = item[1].trim();
          return carry
        }, {})

      const tableProps = [...document.querySelectorAll(".product.attribute.overview table tr")]
        .reduce((carry, item) => {
          if (item.children.length != 2) {
            return carry
          }
          carry[item.children[0].textContent.trim()] = item.children[1].textContent.trim()
          return carry;
        }, {})
      
      if (!!document.querySelector("#tab-label-description-title")) {
        descriptionProps = document.querySelector(".product.attribute.description .value")
          .textContent
          .split("\n")
          .filter(x => x.includes(":"))
          .map(x => x.split(":"))
          .reduce((carry, item) => {
            carry[item[0].trim()] = item[1].trim();
            return carry
          }, {})
      }

      return [overviewProps, tableProps, descriptionProps]
        .sort((a, b) => Object.keys(b).length - Object.keys(a).length)
        .shift()

    }
  );

  const weight = await page.evaluate(() => {
    const regex = /([\d.|,]+)\s*(g|kg)/gim

  });


  return {
    props,
    type,
    width,
  }
}

(async () => {
  // 3deksperten.dk, 3Dstore.dk, Filament23D.dk, in2motion.dk, Techbitshop.dk, 3djake.com, www.reprap.me
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  //page.on('console', msg => console.log(msg.text()));
  await page.exposeFunction("detectType", text => utils.detectType(text));
  await page.exposeFunction("detectWidth", text => utils.detectWidth(text));

  const listInfo = await scrapeList(page);

  const detailsFilename = `output/3deksperten-details-${utils.getToday()}.json`;
  let existing = []
  try {
    existing = JSON.parse(fs.readFileSync(detailsFilename));
  } catch { }

  const existingUrls = existing.map(x => x.url)
  const fitleredList = listInfo.filter(x => x && !existingUrls.includes(x.url));
  console.log(`intial list ${listInfo.length}. list to fetch: ${fitleredList.length}`);

  let details = [...existing];

  for (let i = 0; i < fitleredList.length - 1; i++) {
    const filament = fitleredList[i];
    console.log('fetching info from', filament.url);
    //await utils.sleep(2000);
    await page.goto(filament.url);

    const props = await extractDetailInfo(page);

    details.push({ ...filament, ...props });
    fs.writeFileSync(detailsFilename, JSON.stringify(details, null, 2))
  }

  console.log("All done :D");

})();
