const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const d3 = require('d3');


var args = process.argv.slice(2);

var data_path = args[0];
var days_offset = args[1];
var url_ = 	args[2];
var localOption = args[3];

data_path = data_path === undefined || data_path==='-' ? './' : data_path;
days_offset = days_offset === undefined ||  days_offset==='-' ? 0 : days_offset;
url_ =  url_ ? url_ : 'https://www.barchart.com/futures/quotes/ES*0/interactive-chart/fullscreen';


console.log('-------------------')

if (localOption === 'local' || localOption === 'l' || localOption === 'file') {
	console.log(`reading html from local file... (${url_})`)
	let html = fs.readFileSync(url_);
	write_data(scrape_bars(html))
} 
else {
	console.log(`trying to scrape html from url... (${url_})`)
	scrape_html(url_).then(p => {write_data(p)})
}


async function scrape_html(url_) {
	let html

	try {
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.goto(url_);

		// wait until the element appears
		const linkHandler = await page.waitForXPath("//li[contains(text(), '1D')]");
		await linkHandler.click();

		// get the input field, focus it, remove what's inside, then type the value
		const elementHandle = await page.$('input[name="fieldInput"]');
		await elementHandle.focus();
		await elementHandle.press('Backspace');
		await elementHandle.type('1');

		// trigger the blur event and wait for the response from the server
		await Promise.all([
		    page.waitForResponse(response => response.url().includes('https://www.barchart.com/proxies/timeseries/queryminutes.ashx')),
		    page.evaluate(el => el.blur(), elementHandle)
		]);

		// give the page a few milliseconds to render the diagram
		await page.waitFor(5000);

		html = await page.content()

		var dateh = new Date()
		dateh = dateh.getHours()

		await page.screenshot({path: `${data_path}/screenshot${dateh}.png`});
		await browser.close();
	} catch(err) {
			console.log(err)
			process.exit()
	}
	return scrape_bars(html)
}

function scrape_bars(html) {
	console.log('extracting bars data from html...')
	let fresh_bars = []; 

	$ = cheerio.load(html);
	fs.writeFileSync(`${data_path}html.html`, html);

	var p = $('g.highcharts-series-group > > path').slice(0,-2)
	var r = $('g.highcharts-series-group > > rect')
	console.log('bars extracted: ')
	console.log(p.length)

	//check if correct
	if (p.length != r.length) {
	// if (true) {
		console.log('ATTENTION!! the number of Price Bars did not match the number of Volume Bars')
		console.log('p: ' + p.length)
		console.log('r: ' + r.length)
		console.log('::::::::::::::::::::::::::::::;')
		console.log('p: ')
		p.each(function(i, elem) {
			console.log($(this).attr('aria-label'))
		})
		console.log('::::::::::::::::::::::::::::::;')
		console.log('::::::::::::::::::::::::::::::;')
		console.log('r: ')
		r.each(function(i, elem) {
			console.log($(this).attr('aria-label'))
		})
		console.log('::::::::::::::::::::::::::::::;')
	}

	p.each(function(i, elem) {
		//'640. Monday, Apr  8, 15:43. category, 1554734580000. y, 2898.25. open, 2898. high, 2898.25. low, 2898. close, 2898.25.'
			var bar = {}
			var rawdata = $(this).attr('aria-label')
			if (rawdata) {
	  		rawdata = rawdata.split(". y, ")
	  		//remember that BarChart.com will give you time in CT
	  		//2898.25. open, 2898. high, 2898.25. low, 2898. close, 2898.25.'
	  		try {
	  			var rawvalues = rawdata[1].replace('. open, ', '-')
									  							  .replace('. high, ', '-')
									  						    .replace('. low, ', '-')
									  						 	 	.replace('. close, ', '-')
									  						 	 	.slice(0, -1)
									  						 	 	.split('-')

					bar.t = parseInt(rawdata[0].split(',')[3]);
					bar.o = parseFloat(rawvalues[1]);
					bar.h = parseFloat(rawvalues[2]);
					bar.l = parseFloat(rawvalues[3]);
					bar.c = parseFloat(rawvalues[4]);

					fresh_bars.push(bar)
				}
				catch(err) {
				  // console.log(err.message)
				  // console.log('most probably when scraping paths, one of the scraped elements was not a bar and has been ignored')
				}
			}
	});

	r.each(function(i, elem) {
		//'640. Monday, Apr  8, 15:43. category, 1554734580000. y, 2898.25. open, 2898. high, 2898.25. low, 2898. close, 2898.25.'
			var rawdata = $(this).attr('aria-label')
			if (rawdata) {
				//'637. Friday, Apr 12, 15:56, 282.'
				var volume = rawdata.split(", ").pop().replace('.', '')
				fresh_bars[i].v = parseInt(volume);
			}
	});

	return fresh_bars
}

function write_data(fresh_bars) {
	var daydate = new Date()
	
	var initial_bar_t
	var max_bar_t = new Date(daydate.setHours(daydate.getHours() - (24 * days_offset)))
	
	max_bar_t.setHours(16,59,5,0)
	max_bar_t = max_bar_t.getTime();

	printDate('scrape time: ', daydate)

	daydate.setHours(0,0,0,0); //so that is always the same when we set hours for initial bar
	var date_str = daydate.getFullYear() + '-' + (daydate.getMonth() + 1) + '-' + daydate.getDate();

	let ex_rawdata = fs.readFileSync(`${data_path}data1m.json`);
	let data = JSON.parse(ex_rawdata);

	var today = data[date_str]
	// var today = days_data["4-14"]

	if (today && today.length > 0) {
		initial_bar_t = d3.max(today.map( function(d) {return d.t;} ));
	} else {
		initial_bar_t = daydate.setHours(daydate.getHours() - 7, //24 - 7 = 17 => 5pm (CT)
									  daydate.getMinutes(),   //careful daydate is now changed from set
									  daydate.getSeconds() - 30);
		today = []
	}//note: if is the first recording of the day the initial_bar_t will have 30 seconds otherwise 0

	printDate('initial bar.t: ', new Date(initial_bar_t))
	printDate('max bar.t: ', new Date(max_bar_t))

	var counter = 0
	var last_bar_t = undefined
	fresh_bars.forEach(function(e) {
		if (e.t > initial_bar_t && e.t < max_bar_t) {
			today.push(e)
			last_bar_t = e.t
			counter ++
		}
	});

	printDate('last added bar.t: ', new Date(last_bar_t))

	console.log('bars added: ')
	console.log(counter)
	console.log('data location:')
	console.log(data_path +'data1m.json')
	data[date_str] = today;

	data = JSON.stringify(data, null, 2); 
	fs.writeFileSync(`${data_path}data1m.json`, data);
	console.log('-------------------')
}

function printDate(str, date) {
	let days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	let dayName = days[date.getDay()];
	console.log('////')
	console.log(str);
	console.log(date.getTime()); //timestamp
	console.log( dayName + ' ' +
							 date.getFullYear() + '-' +
							(date.getMonth() + 1) + '-' +
							 date.getDate() + ' ' + 
							 date.getHours() + ':' + 
							 date.getMinutes()+ ':' + 
							 date.getSeconds());
	console.log('////')
}


