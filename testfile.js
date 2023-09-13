
// npm install axios http-proxy-agent https-proxy-agent
const axios = require("axios");
const cheerio = require("cheerio");
const HttpProxyAgent = require("http-proxy-agent");
const HttpsProxyAgent = require("https-proxy-agent");

//change to general case so arbitrary tokens can be pulled
//const geckoUrl = 'https://www.coingecko.com/en/coins/';
//const list = ["ethereum", "bitcoin"];
const url = "https://www.coingecko.com/en/coins/ethereum#markets";
const proxy = "http://61aa23073e82eb82b570e6336c832041f42578f6:js_render=true&js_instructions=%255B%257B%2522click%2522%253A%2522span%2523navigationTabMarketsChoice%2522%257D%252C%257B%2522wait%2522%253A3500%257D%252C%257B%2522wait_for%2522%253A%2522tbody%255Bdata-target%253Dgecko-table.paginatedShowMoreTbody%2522%257D%255D&premium_proxy=true@proxy.zenrows.com:8001";
const httpAgent = new HttpProxyAgent.HttpProxyAgent(proxy);
const httpsAgent = new HttpsProxyAgent.HttpsProxyAgent(proxy);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const dbapi = 'https://master--globaltokenbook.netlify.app/.netlify/functions';


	axios({
	url,
	httpAgent,
	httpsAgent,
	method: 'GET',
})
    .then(response => {
    	let obupSum = 0;
		let obdownSum = 0;
		let volSum = 0;
    	let $ = cheerio.load(response.data);
    	let table = $('div.container main div.tab-content div.active div[data-controller=coin-tickers-tab] div#spot div.gecko-table-container div.coingecko-table table.table tbody:nth-of-type(2)');
    	//console.log(table.html());
   		$ = cheerio.load(table.html(), null, false);
   		if(!obupSum) {
   			obupSum = extractRows(0, $);
   		}
   		if(!obdownSum) {
   			obdownSum = extractRows(1, $);
   		}
   		if(!volSum) {
   			volSum = extractRows(2, $);
   		}
   		let tokenName = "ethereum"
   		if(!obupSum || !obdownSum || !volSum) {
   			console.log("one or more variables is null or undefined");
   			console.log("token: " + tokenName + ", obup: " + obupSum + ", obdown: " + obdownSum + ", vol: " + volSum);
   			//await(scrapeHelper(url, obupSum, obdownSum, volSum));
   		}
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
   				url: dbapi + '/addAggregatedStamps',
   				data: {"data" : aggregatedObs}
   			}).then(res => {
   				console.log(res.status);
   			})
   		} catch(err){console.log(err)}

   		console.log("token: " + tokenName + ", obup: " + obupSum + ", obdown: " + obdownSum + ", vol: " + volSum);
    })
    .catch(error => console.log(error));

//main
// async function scrapeController(tokenList) {
// 	for(let i = 0; i < tokenList.length; i++) {
// 		let obupSum = 0;
// 		let obdownSum = 0;
// 		let volSum = 0;
// 		await scrapeHelper(geckoUrl+tokenList[i]+"#markets", obupSum, obdownSum, volSum);
// 	}
// }

//helper for pulling tr data from tbody
function extractRows(varToExtract, $) {
	let extractedSum = 0;
	let obup, obdown, pair, volume;
	const rows = $('tr');
	rows.each((i, el) => {
		pair = $('td:nth-of-type(3)', el).children().first().text();
		//priceStr = $('td:nth-of-type(4)', el).children().first().text();
		pair.replace(/(\r\n|\n|\r)/gm, "");
		if(pair.includes("USD")) {
			switch(varToExtract) {
				case 0:
					obup = $('td:nth-of-type(6)', el).text();
					obup = obup.substring(8, obup.length);
					obup = obup.replace(/(\r\n|\n|\r)/gm, "");
					extractedSum += parseFloat(obup.replace(/,/g, '')); //remove commas
				break;
				case 1:
					obdown = $('td:nth-of-type(7)', el).text();
					obdown = obdown.substring(8, obdown.length);
					obdown = obdown.replace(/(\r\n|\n|\r)/gm, "");
					extractedSum += parseFloat(obdown.replace(/,/g, ''));
				break;
				case 2:
					volume = $('td:nth-of-type(8) div', el).text();
					volume = volume.substring(1, volume.length);
					volume = volume.replace(/(\r\n|\n|\r)/gm, "");
					extractedSum += parseFloat(volume.replace(/,/g, ''));
			}
		}
		
	});
	return extractedSum;
}