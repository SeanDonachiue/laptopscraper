const axios = require("axios")
const HttpProxyAgent = require("http-proxy-agent");
const HttpsProxyAgent = require("https-proxy-agent");
const cheerio = require("cheerio")
const puppeteer = require("puppeteer")
const geckoUrl = 'https://www.coingecko.com/en/coins/';
const api = 'https://master--globaltokenbook.netlify.app/.netlify/functions';
//const api = 'http://localhost:3000/api';
const list = ["ethereum", "bitcoin"];




async function scrapeHelper(url, page, obupSum, obdownSum, volSum) {
	await page.goto(url);
	console.log(page.url());
	const options = {
		'waitUntil' : 'networkidle0'
	};
	let [response] = await Promise.all([
		//page.waitForNavigation(options),
		page.click('a[href="#markets"]'),
		waitTilHTMLRendered(page)
		]);
	console.log(page.url());

	let html = await page.$eval("body", el => el.innerHTML);

	let $ = cheerio.load(html);
	let table = cheerio.load($('div#markets').children().first().children().first().next().children().first().children().first().children().first().next().html(), null, false);


	//sponsored rows
	//regular table

	//scrape values corresponding to our inputs IFF we haven't already recorded observations in this or prior
	//executions of scrapeHelper()
	if(!obupSum) {
		obupSum = extractRows(table, 0, $);
	}
	if(!obdownSum) {
		obdownSum = extractRows(table, 1, $);
	}
	if(!volSum) {
		volSum = extractRows(table, 2, $);
	}

	let tokenName = url.substring(geckoUrl.length);
	
	if(!obupSum || !obdownSum || !volSum) {
		console.log("one or more variables is null or undefined")
    	console.log("token: " + tokenName + ", obup: " + obupSum + ", obdown: " + obdownSum, + ", vol: " + volSum);
		await scrapeHelper(url, page, obupSum, obdownSum, volSum);
		return;
	}
	// console.log("attempting to close page then post data") //never runs
	// page.once('close', () => console.log('page closed'));
	// await page.close();
	// if(page.isClosed()) page = null;
	const timestamp = new Date().toISOString();
	let aggregatedObs = {
		token: tokenName,
		stamp: timestamp,
		obup: obupSum,
		obdown: obdownSum,
		volume: volSum
	}
	aggregatedObs = JSON.stringify(aggregatedObs);
	try{
		axios({
		method: 'post',
		url: api + '/addAggregatedStamps',
		data: {"data" : aggregatedObs}
		}).then(res => {
			console.log(res.status);
		})
	}
	catch(err){console.log(err)}
	
	
}

const waitTilHTMLRendered = async (page, timeout = 30000) => {
  const checkDurationMsecs = 1000;
  const maxChecks = timeout / checkDurationMsecs;
  let lastHTMLSize = 0;
  let checkCounts = 1;
  let countStableSizeIterations = 0;
  const minStableSizeIterations = 3;

  while(checkCounts++ <= maxChecks) {
    let html = await page.content();
    let currentHTMLSize = html.length; 

    let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length);

    console.log('last: ', lastHTMLSize, ' <> curr: ', currentHTMLSize, " body html size: ", bodyHTMLSize);

    if(lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize) 
      countStableSizeIterations++;
    else 
      countStableSizeIterations = 0; //reset the counter

    if(countStableSizeIterations >= minStableSizeIterations) {
      console.log("Page rendered fully..");
      break;
    }

    lastHTMLSize = currentHTMLSize;
    await page.waitForTimeout(checkDurationMsecs);
  }  
};

//Helper function, takes a loaded cheerio object for a table as input, extracts and sums
//information from the table and returns these summed values
function extractRows(table, varToExtract, $) {
	let extractedSum = 0
	let obup, obdown, pair, volume;
	const sponsoredRows = table('tbody:nth-of-type(1) tr');
	const rows = table('tbody:nth-of-type(2) tr');
	sponsoredRows.each((i, el) => {
		//const num = $('td:nth-of-type(1)', el).text();
		//console.log("row number pulled from table: " + num);
		//exch = $('td:nth-of-type(2)', el).children('div').find('a').text();
		//exch = exch.substring(exch.length/2, exch.length)
		pair = $('td:nth-of-type(3)', el).children().first().text();
		//priceStr = $('td:nth-of-type(4)', el).children().first().text();
		pair.replace(/(\r\n|\n|\r)/gm, "");
		if(pair.includes("USD")) {
			switch(varToExtract) {
				case 0:
					obup = $('td:nth-of-type(6)', el).text();
					obup = obup.substring(2, obup.length);
					obup = obup.replace(/(\r\n|\n|\r)/gm, "");
					extractedSum += parseFloat(obup.replace(/,/g, ''));
				break;
				case 1:
					obdown = $('td:nth-of-type(7)', el).text();
					obdown = obdown.substring(2, obdown.length);
					obdown = obdown.replace(/(\r\n|\n|\r)/gm, "");
					extractedSum += parseFloat(obdown.replace(/,/g, ''));
				break;
				case 2:
					volume = $('td:nth-of-type(8)', el).text();
					volume = volume.substring(2, volume.length);
					volume = volume.replace(/(\r\n|\n|\r)/gm, "");
					extractedSum += parseFloat(volume.replace(/,/g, ''));
			}
		}

		//so you either get obup OR obdown but not both

	});
	rows.each((i, el) => {
		pair = $('td:nth-of-type(3)', el).children().first().text();
		//priceStr = $('td:nth-of-type(4)', el).children().first().text();
		pair.replace(/(\r\n|\n|\r)/gm, "");
		if(pair.includes("USD")) {
			switch(varToExtract) {
				case 0:
					obup = $('td:nth-of-type(6)', el).text();
					obup = obup.substring(2, obup.length);
					obup = obup.replace(/(\r\n|\n|\r)/gm, "");
					extractedSum += parseFloat(obup.replace(/,/g, ''));
				break;
				case 1:
					obdown = $('td:nth-of-type(7)', el).text();
					obdown = obdown.substring(2, obdown.length);
					obdown = obdown.replace(/(\r\n|\n|\r)/gm, "");
					extractedSum += parseFloat(obdown.replace(/,/g, ''));
				break;
				case 2:
					volume = $('td:nth-of-type(8)', el).text();
					volume = volume.substring(2, volume.length);
					volume = volume.replace(/(\r\n|\n|\r)/gm, "");
					extractedSum += parseFloat(volume.replace(/,/g, ''));
			}
		}
		
	});
	return extractedSum;
}

async function scrapeController(tokenList) {
	let page;
	const browser = await puppeteer.launch({args: ['--no-sandbox']});
	for(let i = 0; i < tokenList.length; i++) {
		let obupSum = 0;
		let obdownSum = 0;
		let volSum = 0;
		if(!page) page = await browser.newPage();
		page.setDefaultNavigationTimeout(0);
		console.log("in the outer request loop");
		await scrapeHelper(geckoUrl + tokenList[i], page, obupSum, obdownSum, volSum);

		//maybe now you send the request
	}
	await browser.close()


}

exports.helloPubSub = async(event, context) => {
	await scrapeController(list);
}

//await scrapeController(list);

function removeNewline (strings) {
	for(let i = 0; i < strings.length; i++) {
		strings[i] = strings[i].replace(/(\r\n|\n|\r)/gm, "");
	}
	return strings;
}