var minDate
var maxDate

var width
var height
var fontsize
var fontwidth
var textOffset
var maxSCRlettersH
var maxSCRlettersW

var yMin
var yMax
var xMin
var xMax
var xScale
var yScale 
var xColumnScale
var yAxis
var yAxisMargin

var plotting_strings_now

var tickvalues;
var pricesPOCs;
var pricesH;
var pricesL;
var pricesSETTLED;
var pricesHN;

var lastSessionMPdata
var lastDAYBARS

var periodsMove = 0
var ethDetected;

var replayON = false
var replayFirst = false

async function plotMulti() {
	tickvalues = [];
	pricesPOCs = [];
	pricesH = [];
	pricesL = [];
	pricesSETTLED = [];
	pricesHN = [];


	var lastPrice;
	var svg;
	var bigG;
	var xUsedCol = 15;
	var currentSessionIndex = 0;
	var currentDay = 0
	var dayMPdata;
	var gY;

	lastTimestamp = 0;

	width = $('.svgcontainer').width();	
	height = window.innerHeight - $('.bigcontainer').height();	
	yAxisMargin = 11 * (height/100);
	fontsize = 10;
	fontwidth = 12;
	textOffset = ((fontsize/20)*8); //to get font centered to Y ticks
	maxSCRlettersH = Math.round((height-20) / fontsize);
	maxSCRlettersW = Math.round((width - yAxisMargin) / fontwidth);

	xMin = 0;
	xMax = maxSCRlettersW;

	xScale = d3.scaleLinear()
	  .domain([xMin, xMax])
	  .range([0, (width - yAxisMargin)]);

	xColumnScale = d3.scaleLinear()
		.domain([0, (width - yAxisMargin)])
		.range([xMin, xMax]);

	var today_date_str = $('.interface input').val()

	var back_dates_str = getListDates(today_date_str, plotting_scheme.length)

	d3.selectAll('svg')
		.remove()

	svg = d3.select('.svgcontainer')
		.append('svg')
			.attr('width', width)
			.attr('height', height)
			.style('background', '#229')

	bigG = svg.append('g')
		.attr('id', 'bigG')

	async function getJSON(date, ...args) {
		$.ajax(`data/${date}.json`, {
			    dataType: 'json', // type of response data
			    timeout: 5000,    // timeout milliseconds
			    success: [...args],
			    error: function (jqXhr, textStatus, errorMessage) { // error callback 
			        console.log('Error: ' + errorMessage);
			 		}
		});
	}

	function iterateGetJSON() {
		if (back_dates_str.length === 0) {completeSVG(); return}

		if (currentDay < back_dates_str.length) {
			getJSON(back_dates_str[currentDay-1], getMPdata, plotDaySessions, iterateGetJSON)
		} else {
			getJSON(back_dates_str[back_dates_str.length-1], getMPdata, plotDaySessions, completeSVG)
		}
	}

	function getMPdata(data) {
    var daybars = data.bars
		timestamp_0000 = data.dayTime0

		var selected_indexes = plotting_scheme[currentDay]
		var selected_sessions_times = sessions_times.filter(function(e, i) {
			return selected_indexes.includes(i)
		})

		dayMPdata = getDayProfileData(daybars, selected_sessions_times);
		dayMPdata.reverse()

		dayMPdata = dayMPdata.filter((daySession) => (daySession.h && daySession.l))
		dayMPdata.forEach((daySession) => {
				daySession.date = currentDay === 0 ? today_date_str : back_dates_str[currentDay - 1]
		})
	}

	function savelastDAYBARS(data) {
		lastDAYBARS = data;
	}

	function takeLastSessionInfo() {
		
    lastSessionMPdata = dayMPdata[0];

		if (lastSessionMPdata.tag === '(ETH)') {
			console.log('eth detected')
			ethDetected = true
			plotting_strings_now = plotting_strings_ifETH
		} else {
			plotting_strings_now = plotting_strings
			ethDetected = false
		}

		var lastLetter = Object.keys(lastSessionMPdata.periods).pop();
		var lastBar = lastSessionMPdata.periods[lastLetter];
		lastPrice = lastBar.c;

		yMin = lastPrice - ((Math.floor(maxSCRlettersH/2) + 2) * ticksize);
		yMax = lastPrice + ((Math.floor(maxSCRlettersH/2) - 2) * ticksize);

		yScale = d3.scaleLinear()
		  .domain([yMin, yMax])
		  .range([height+1, -1]);
	}

	function plotDaySessions() {
		plotting_string_now = plotting_strings_now[currentDay].split('_')
		plotting_string_now.reverse()
		
    dayMPdata.forEach((mpData, i) => {
    	if (currentSessionIndex === 0 && hideSession0) {
    		xUsedCol += plot(mpData, currentSessionIndex, xUsedCol, plotting_string_now[i])
				periodsMove = 0 - letters.indexOf(Object.keys(lastSessionMPdata.periods).pop());
    		rewind(-1, 'period')
    	} else {
				xUsedCol += plot(mpData, currentSessionIndex, xUsedCol, plotting_string_now[i])
			}
			currentSessionIndex++
		})
		currentDay++

		d3.selectAll('.yaxis')
			.remove()

		yAxis = d3.axisRight(yScale)
			.ticks(0)
			.tickSize(5)
			.tickValues(tickvalues.flat().reverse())
			.tickFormat(d3.format(".2f"))

		if ((ethDetected && currentSessionIndex === 1) || currentSessionIndex === 2) {
			svg.append('rect') //ticks background
				.attr('x', width - (11*(height/100)))
				.attr('y', 0)
				.attr('id', 'ticksbackground')
				.attr('width', width - (11*(height/100)))
				.attr('height',height)
				.attr('fill', '#229')
		}

		gY = svg.append("g")
			.attr("class", "yaxis")
			.attr("transform", (`translate(${width - yAxisMargin},0)`))
			.call(yAxis);
	}

	function completeSVG() {

		var length = pricesSETTLED.length
		var step = 1 / length

		colorPrices(lastPrice)

		svg = d3.select("svg")
				.call(d3.zoom().on("zoom", function () {
						d3.select(`#bigG`).attr("transform", d3.event.transform)
						gY.call(yAxis.scale(d3.event.transform.rescaleY(yScale)));
					}))
				.append("g")
				.attr('id', 'scalingG')
		updateClock()
	}

	await getJSON(today_date_str, savelastDAYBARS, getMPdata, takeLastSessionInfo, plotDaySessions, iterateGetJSON)
}

function plot(mpData, sessionID, xUsedCol, plot_string, prevNColumns) {
	// console.log('--------')
	// console.log(mpData)
	// console.log(plot_string)
	
	var lastLetter = findLastLetter(Object.keys(mpData.periods))
	// console.log(mpData)
	// console.log(lastLetter)
	// console.log(mpData.periods[lastLetter])
	var lastBar = mpData.periods[lastLetter]
	var lastPrice = lastBar.c

	if (plot_string.includes('v')) {
		var volumeprofile = getVolumeProfile(mpData.sessionVprofile)
		var maxVol = volumeprofile.maxVolume
		volumeprofile = volumeprofile.profile
	}

	var mpWidth = lastBar.poc['tpos/vol'] * plot_string.includes('m')
	var bpWidth = (letters.indexOf(lastLetter) + 1) * plot_string.includes('b')
	var vpWidth = plot_string.includes('v') ? xColumnScale(maxVol/volumescaleratio) + 3 : 0
	var vp2Width = 3 * plot_string.includes('w')
	var space_bp_vp2 = 1 * plot_string.includes('w')

	// console.log(mpWidth)
	// console.log(bpWidth)
	// console.log(vpWidth)
	// console.log(vp2Width)
	// console.log(space_bp_vp2)
	// console.log('--------')

	var sessionHi = mpData.h;
	var sessionLo = mpData.l;

	var bigG = d3.selectAll('#bigG')
	var sessionG = bigG.append('g').attr('id', `session${sessionID}G`);

	var space_bp_mp = (5 * plot_string.includes('mb'));
	var nColumns = mpWidth + space_bp_mp + bpWidth + vpWidth + vp2Width + space_bp_vp2;
	var colAdjustment = prevNColumns ? prevNColumns - nColumns : 0
	var xOrigin = xMax - xUsedCol - nColumns - colAdjustment;

	if (!replayON && sessionID < 3 && !ethDetected && mpData.tag === '(ETH)') {
		pricesHN.push(mpData.h)
		pricesHN.push(mpData.l)
		ticksThisSession = [
			mpData.h, 
			mpData.l]
		tickvalues.push(ticksThisSession)
	}

	if (!replayON && sessionID < 3 && (mpData.tag != '(ETH)' || ethDetected)) {
		ticksThisSession = [
			mpData.h, 
			mpData.l, 
			lastBar.poc.price,
			lastPrice]
		pricesPOCs.push(lastBar.poc.price)
		pricesH.push(mpData.h)
		pricesL.push(mpData.l)
		pricesSETTLED.push(lastPrice)
		tickvalues.push(ticksThisSession)
	}

	if (hideSession0) {
		sessionG.append('rect')
			.attr('id', 'dayrect')
			.attr('type', `${xUsedCol+colAdjustment}:${nColumns}`)

			hideSession0 = false;

		return nColumns + 5;
	}

	sessionG.append('text')
		.attr('x', xScale(xOrigin))
		.attr('y', yScale(sessionHi) - fontsize)
		.style("fill", "rgba(280,80,240,0.5)")
		.style("font-size", "1.6vh")
		.text(getFormattedDate(mpData.date) + ' ' + mpData.tag)


	var opacity  = (mpData.tag) === '(ETH)' ? 0.1 : 0.3;

	sessionG.append('rect')
		.attr('id', 'dayrect')
		.attr('type', `${xUsedCol+colAdjustment}:${nColumns}`)
		.attr('x', xScale(xOrigin) - (fontwidth/2))
		.attr('y', yScale(sessionHi) - (fontsize/2))
		.attr('width', xScale(nColumns))
		.attr('height', yScale(sessionLo) - yScale(sessionHi) + fontsize)
		.attr('fill', `rgba(20,5,20,${opacity})`)

	barprofile = getBarProfile(mpData)

	if (plot_string.includes('m')) {
		marketprofile = getMarketProfile(barprofile)
		drawProfile(marketprofile, 'mpbar', xOrigin, mpWidth);
	}

	if (plot_string.includes('b')) {
		drawProfile(barprofile, 'bar', xOrigin + mpWidth + space_bp_mp, bpWidth);
		drawBarVolumes(xOrigin + mpWidth + space_bp_mp, `barsvol${sessionID}`);
	}

	if (plot_string.includes('v')) {
		drawVolume(volumeprofile, `dayvol${sessionID}`, xMax - xUsedCol - colAdjustment)
	}

	if (plot_string.includes('w')) {
		var barVP = getVolumeProfile(lastBar.vp)
		drawVolume(barVP.profile, `barvol${sessionID}`, xMax - xUsedCol - colAdjustment - vpWidth + space_bp_vp2, barVP.maxVolume)
		drawBarVolumeOnVP(mpData.sessionVprofile, barVP.profile, `barRef${sessionID}`, xMax - xUsedCol  - colAdjustment)
	}

	highlightPoints();

	return nColumns + 5;

	function drawBarVolumes(startcolumn, id) {
		var profile = []

		Object.keys(mpData.periods).forEach((period) => {
			if (period) {
				profile.push({'letter':period, 'volume': (mpData.periods[period].v)})
			}
		})

		sessionG.selectAll(`#${id}`)
			.data(profile)
			.enter()
			.append("rect")
				.attr('id', id)
				.attr('x', function(b) {
						var xPosition = letters.indexOf(b.letter);
						return xScale(xPosition + (startcolumn));
					})
				.attr('y', yScale(sessionLo) + (fontsize))
				.attr('width', 10)
				.attr('height', function(b) {return b.volume/volumescaleratio})
				.style('fill', 'yellow')
				.style('stroke-width', 1)
				.style('stroke', 'white')
				.style('stroke-opacity', 0.3)
				.style('fill-opacity', 0.1)
	}

	function drawProfile(profile, id, startcolumn, columnwidth) {
		sessionG.selectAll(`#${id}`)
			.data(profile)
			.enter()
			.append("g")
				.attr("id", id)
				.attr("transform", function(b, i) { 
					var xPosition = typeof(b.barID) === 'number' ? b.barID : letters.indexOf(b.barID);
					return `translate(${xScale(xPosition + (startcolumn))},0)`;
					})
				.each(function(b, i) {
					d3.select(this).selectAll('text')
					.data(function(b) { 
						return Object.keys(b.bar); })
					.enter()
					.append("text")
						.attr("y", function(e) {
							return yScale(parseFloat(e)) + textOffset; 
						})
						.attr("font-size", `${fontsize}px`)
						.attr("price", function(e) {return e})
						.text(function(e) { return typeof(profile[i].barID) === 'number' ? b.bar[e] : profile[i].barID}) 
				})

		sessionG.append('rect')
				.attr('id', id)
				.attr('class', 'lastprice')
				.attr('y', yScale(lastPrice) - (fontsize/2))
				.attr('x', xScale(startcolumn) - 4)
				.attr('rx', 2)
				.attr('ry', 2)
				// .attr('width', columnwidth)
				.attr('width', xScale(startcolumn + columnwidth) - xScale(startcolumn) + 3)
				.attr('height', fontsize + 1)
	}

	function drawVolume(profile, id, startcolumn, maxVol = undefined) {
		var scale;
		if (maxVol) {
			var vp2WidthPixels = xScale(vp2Width)
			scale = maxVol / vp2WidthPixels
		} else {
			scale = volumescaleratio
		}
		
		var volg = sessionG.append(`g`)
			.attr('id', `#${id}`)

		volg.selectAll('dayVolBar')
			.data(profile)
			.enter()
			.append("rect")
				.attr('y', function(d) {return yScale(d.price) - (fontsize/2)})
				.attr('x', function(d) {return xScale(startcolumn - 0.5) - (d.vol/scale)})
				.attr('width', function(d) {return d.vol/scale})
				.attr('height', fontsize)
				.attr('rx', 0.5)
				.attr('ry', 0.5)
				.style('fill', function(d) {return '#' + d.gradient})
				.style('stroke-width', 1)
				.style('stroke', 'white')
				.style('stroke-opacity', 0.3)
				.style('fill-opacity', 0.5)
	}

	function drawBarVolumeOnVP(sessionVprofile, barprofile, id, startcolumn) {
		var scale = volumescaleratio;
		
		var volg = sessionG.append(`g`)
			.attr('id', `#${id}`)

		volg.selectAll('refVPbar')
			.data(barprofile)
			.enter()
			.append("rect")
				.attr('y', function(d) {return yScale(d.price) - ((fontsize/3))})
				.attr('x', function(d) {
					var price = d.price
					return xScale(startcolumn - 0.5) - (sessionVprofile[price]/scale)
				})
				.attr('width', function(d) {
					return d.vol/scale
				})
				.attr('height', 6)
				.style('fill', 'yellow')
				.style('stroke-width', 'none')
				.style('fill-opacity', 0.5)
	}

	function highlightPoints() {
		var thisSessionletters = Object.keys(mpData.periods)

		thisSessionletters.forEach((letter) => {
			var openPrice = mpData.periods[letter].o
			$(`#session${sessionID}G text[price='${openPrice}']`).each((i, text) => {
				if ($(text).text() === letter) {
					$(text).css("fill", "rgba(255,255,200,0.75");
					// $(text).css('font-family', "IBM+Plex+Mono");
					$(text).css('font-weight', "600");
					// $(text).css('text-shadow', '1px 1px 1px #dda')
					// $(text).text('O')
					// $(text).css('text-decoration', 'underline red')
				}
			})

			if (letter != letters[0]) {
				var tpocPrice = mpData.periods[letter].poc.price
				$(`#session${sessionID}G text[price='${tpocPrice}']`).each((i, text) => {
					if ($(text).text() === letter) {
						$(text).css("fill", "rgba(255,148,30,1");
						$(text).css('font-weight', "400");
					}
				}) 
			}
		})

		var lastPocPrice = mpData.periods[thisSessionletters.pop()].poc.price;
		$(`#session${sessionID}G text[price='${lastPocPrice}']`).each((i, text) => {
			$(text).css("fill", "rgba(20,220,20,0.9)");
			$(text).css('font-weight', "700");
		})
	}
}

function rewindToEnd() {
	replayFirst = true
	function refresh() 
	{
	    x = 1;  // 5 Seconds

	    var stop = rewind(1, 'bar')

	    replayFirst = false

	    if (stop) {return}

	    setTimeout(refresh, x*1000);
	}


	refresh(); // execute function
}

function rewind(increment, type) {
		
		var lastTimestamp_transfer = lastTimestamp;
		var lastLetter = findLastLetter(Object.keys(lastSessionMPdata.periods))

		// console.log(lastTimestamp_transfer)
		// console.log(lastSessionMPdata.lastTimestamp)
		if (replayFirst && lastTimestamp_transfer >= lastSessionMPdata.lastTimestamp) 
		{
			// console.log('inside')
			var periods_number = letters.indexOf(lastLetter) + 1;
			// console.log(periods_number)
			lastTimestamp = 0;
			rewind(1-periods_number, 'period')
			// replayFirst = false
			return
		}

		lastTimestamp = 0;
		replayON = true;

		// console.log(lastTimestamp_transfer)
		// console.log(lastSessionMPdata.lastTimestamp)
		
		// console.log(lastDAYBARS)
		
		timestamp_0000 = lastDAYBARS.dayTime0;

		var session_type = lastSessionMPdata.tag;

		// console.log(lastSessionMPdata)

		// var lastLetter = Object.keys(lastSessionMPdata.periods).pop();


		var selected_session_time = Object.assign({}, sessions_times.filter(function(e, i) {
					return e.name === session_type
				})[0]);

		if (type === 'period' || type === 'p') {
			periodsMove += increment;
			var periods_number = letters.indexOf(lastLetter) + 1;

			
			var periodList = getPeriodsTimes(timestamp_0000, selected_session_time);
			periodList.reverse();

			// console.log('---------------------')
			// console.log('periodsMove:')
			// console.log(periodsMove)

			if (Math.abs(periodsMove) >= periods_number) {periodsMove = -periods_number};
			if (periodsMove > 0) {periodsMove = 0; return};

			//make periods list an object
			var periods_obj = {}; 
			periodList.forEach((period) => {
				var letter = period.period
				periods_obj[letter] = {'timestamp': null, 'humanTime': null};
				periods_obj[letter].timestamp = period.timestamp;
				periods_obj[letter].humanTime = period.humanTime;
			})
			//make periods list an object

			var letter_index = periods_number + (periodsMove)

			if (periodsMove === 0) {
				selected_session_time.end = periods_obj.end.humanTime
			} else {
				selected_session_time.end = periods_obj[letters[letter_index]].humanTime
			}
			if (periodsMove === -periods_number) {
				selected_session_time.end = timePlus1m(selected_session_time.end, 1)
			}

		} else {
			if (lastTimestamp_transfer >= lastSessionMPdata.lastTimestamp && increment > 0) {
				console.log('stop')
				return true
			}
			selected_session_time.end = timePlus1m(getCTtime(lastTimestamp_transfer + 60000).digitime, increment)
			if (selected_session_time.end === selected_session_time.start) {
				selected_session_time.end = timePlus1m(selected_session_time.start, 1)
			}
		}

		var mpData = getDayProfileData(lastDAYBARS.bars, [selected_session_time])[0];
		mpData.date = $('.interface input').val()

		if (Object.keys(mpData.periods).length  - Object.keys(lastSessionMPdata.periods).length != periodsMove) {
			periodsMove = Object.keys(mpData.periods).length  - Object.keys(lastSessionMPdata.periods).length
		}
		// console.log('last whole session periods count:')
		// console.log(Object.keys(lastSessionMPdata.periods).length)
		// console.log('rewind session periods count:')
		// console.log(Object.keys(mpData.periods).length)
		// console.log('rewind - whole:')
		// console.log(Object.keys(mpData.periods).length - Object.keys(lastSessionMPdata.periods).length)
		// console.log('periodsMove after:')
		// console.log(periodsMove)
		// console.log('lastTimestamp:')
		// console.log(lastTimestamp)
		// console.log('---------------------')

		console.log(timestamp_0000)
		console.log(lastDAYBARS.bars)
		lastLetter = Object.keys(mpData.periods).pop();
		var lastBar = mpData.periods[lastLetter];
		lastPrice = lastBar.c;

		updateClock()

		ticksThisSession = [
			mpData.h, 
			mpData.l, 
			lastBar.poc.price,
			lastPrice]
		pricesPOCs.shift()
		pricesPOCs.unshift(lastBar.poc.price)
		pricesH.shift()
		pricesH.unshift(mpData.h)
		pricesL.shift()
		pricesL.unshift(mpData.l)
		pricesSETTLED.shift()
		pricesSETTLED.unshift(lastPrice)

		tickvalues.shift()
		tickvalues.unshift(ticksThisSession)

		// d3.select(".yaxis").call(yAxis.tickValues(tickvalues.flat().reverse()));

		colorPrices(lastPrice)

		var x = $('#session0G #dayrect').attr('type').split(':')
		var adj = parseFloat(x[1])
		x = parseFloat(x[0])
		
		d3.selectAll('#session0G')
			.remove()

		plot(mpData, 0, x, 'mbvw', adj)

		replayON = false
}

function getBarProfile(mpData) {
	var barprofile = []
	lettersThisData = Object.keys(mpData.periods);
	periods = mpData.periods;
	lettersThisData.forEach((letter) => {
		var lo = periods[letter].l
		var hi = periods[letter].h
		var bar = {'barID': letter, 'bar': {}}
		for (let p = hi; p >= lo; p -= ticksize) {
			bar.bar[p] = 1;
		}
		barprofile.push(bar)
	})

	return barprofile
}

function getMarketProfile(barprofile) {
	var marketprofileTransposed = {}
	var maxLen = 0;
	barprofile.forEach((bar) => {
		let barPrices = Object.keys(bar.bar)
		barPrices.forEach((price) => {
			if (!marketprofileTransposed[price]) { 
				marketprofileTransposed[price] = [];
			}
			marketprofileTransposed[price].push(bar.barID);
			maxLen = marketprofileTransposed[price].length > maxLen ? marketprofileTransposed[price].length : maxLen;
		})
	})
	var marketprofile = []
	for (let i = 0; maxLen > i; i++) {
		var mpBar = {'barID': i, 'bar': {}}
		Object.keys(marketprofileTransposed).forEach((price) => {
			var pricelevel = marketprofileTransposed[price]
			pricelevel[i] ? mpBar.bar[price] = pricelevel[i] : null;
		})
		marketprofile.push(mpBar)
	}
	return marketprofile
}

function getVolumeProfile(profile) {
	// var profile = mpData.sessionVprofile

	var array_profile = Object.keys(profile).map((price) => {
		return {'price' : price, 'vol' : profile[price]}
	})

	var volMax = d3.max(array_profile, function(d) { return d.vol; })
	var volMin = d3.min(array_profile, function(d) { return d.vol; })

	var volGradient = d3.scaleQuantize()
	  .domain([volMin, volMax])
	  .range([
	  	'FFFFFF',
	  	'FFEBF9',
	  	'FFD7F4',
	  	'FFC3EF',
	  	'FFAFE9',
	  	'FF9BE4',
	  	'FF87DF',
	  	'FF73D9',
	  	'FF5FD4',
	  	'FF4BCF',
	  	'FF38CA']);

	array_profile.forEach((d) => {
		d.gradient = volGradient(d.vol)
	})

	return {'profile': array_profile,  'maxVolume': volMax}
}

function updateDates(data) {
	var minmax = getMinMaxDates(data)
	minDate = minmax.min
	maxDate = minmax.max
	populateDatePicker(minmax.min, minmax.max)
}

function populateDatePicker(minDate, maxDate) {
		$( "#datepicker" ).remove()

		$( ".interface" ).append('<input type="text" id="datepicker">')

		$( "#datepicker" ).datepicker({
				dateFormat: "yy-m-d",
				minDate: minDate,
				maxDate: maxDate,
				beforeShowDay: $.datepicker.noWeekends,
				onSelect: function(date) {
       				plotMulti()
    			}
		});
		$('#datepicker').datepicker('setDate', maxDate)
			.css('text-align', 'center')
}

function getMinMaxDates(datadates) {
	var datedayslist = []
	//find max and min date from data for date picker
	datadates.forEach(function(date) {
		date = date.replace('.json','').split('-')
		var thisdaydate = new Date(date[0], date[1]-1, date[2])
		datedayslist.push(thisdaydate)
	})
	var maxDate = new Date(Math.max.apply(null,datedayslist));
	var minDate = new Date(Math.min.apply(null,datedayslist));

	return { 'min': minDate, 'max': maxDate }
}

function getListDates(date_str, ndaysBack) {
	date_str = date_str.split('-')
	var initdate = new Date(date_str[0], date_str[1]-1, date_str[2])
	var dates = []

	for (let i = 1; i < ndaysBack; i++) {
		var backdate = new Date(initdate)
		backdate.setHours(initdate.getHours() - (24*i))
		if (backdate.getDay() == 0 || backdate.getDay() == 6) {
			// backdate = 'weekend';
			ndaysBack++
			// dates.push(backdate)
			continue
		}
		if (backdate.getTime() > minDate.getTime()) {
			dates.push(backdate.getFullYear() + '-' + 
								(backdate.getMonth() + 1)  + '-' + 
								 backdate.getDate())
		}
	}
	return dates
}

function updateClock() {
	var localTime = new Date(lastTimestamp + 60000)
	var clockString = 
		(localTime.getHours().toString().length > 1 ? localTime.getHours() : '0' + localTime.getHours())
		+ ':' + 
		(localTime.getMinutes().toString().length > 1 ? localTime.getMinutes() : '0' + localTime.getMinutes());

	$('#local.clock')
		.append('text')
		.val(getDayFromDate(getCTtime(localTime.getTime()).date) 
			+ ' ' + 
			clockString)
		.css("font-color", 'red')
		.css("font-family", 'digital-7_monoitalic')
		.css('height', '100%')
		.css('vertical-align', 'middle')

	// $('#local.clock')
	// 	.append('text')
	// 	.html('(CME: ' + getCTtime(lastTimestamp + 60000).time + ')' )
		
	// $('#cme.clock')
	// 	.html(getDayFromDate(getCTtime(localTime.getTime()).date) 
	// 		+ ' ' + 
	// 		space1clock(getCTtime(lastTimestamp + 60000).time))
	// 	.css("font-color", 'red')
	// 	.css("font-family", 'digital-7regular')
	// 	.css("text-shadow", '2px 2px 1.6px #ddd')
}

function colorPrices(lastPrice) {

	pricesSETTLED.forEach((settle, i) => {
		j = i > 3 ? 3 : i
		d3.selectAll('.tick text').filter(function(d) { 
			return d === settle;
		}).attr('id', `settle${j}`);

		d3.selectAll('.tick text').filter(function(d) { 
			return d === pricesPOCs[i];
		}).attr('id', `poc${j}`);

		d3.selectAll('.tick text').filter(function(d) { 
			return d === pricesH[i];
		}).attr('id', `h${j}`)
			// .style('font-size', '1.8vh');

		d3.selectAll('.tick text').filter(function(d) { 
			return d === pricesL[i];
		}).attr('id', `h${j}`)
			// .style('font-size', '1.8vh');
	})

	if (pricesHN != []) {
		pricesHN.forEach((NightExtreme, i) => {
		d3.selectAll('.tick text').filter(function(d) { 
				return d === NightExtreme;
			}).attr('id', `hN`);
		})
	}

	d3.selectAll('.tick text').filter(function(d) { 
			return d == lastPrice;
		}).attr('id', 'priceTag')
}

function getDayFromDate(date_str) {
	date_str = date_str.split('-')
	var initdate = new Date(date_str[0], date_str[1]-1, date_str[2])

	let days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	let dayName = days[initdate.getDay()];

	return dayName
}

function getFormattedDate(date_str) {
	date_str = date_str.split('-')
	var initdate = new Date(date_str[0], date_str[1]-1, date_str[2])

	let days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	let months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
								'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
	let dayName = days[initdate.getDay()];
	let monthName = months[date_str[1]-1];

	return dayName + ' ' + date_str[2] + ' ' + monthName
}

function timePlus1m(str, increment) {
	var str_m = str.slice(2,4);
	var str_h = str.slice(0,2);

	str_m = parseInt(str_m) + increment;
	if (str_m > 59) {
		str_m = str_m % 60
		str_h = parseInt(str_h) + 1;
		str_h = str_h % 24;
	}
	if (str_m < 0) {
		str_m = 59
		str_h = parseInt(str_h) - 1;
		str_h = str_h % 24;
	}
	str_h = `${str_h}`.length === 1 ? `0${str_h}` : str_h;
	str_m = `${str_m}`.length === 1 ? `0${str_m}` : str_m;

	return `${str_h}${str_m}`;
}

Object.defineProperty(Array.prototype, 'flat', {
    value: function(depth = 1) {
      return this.reduce(function (flat, toFlatten) {
        return flat.concat((Array.isArray(toFlatten) && (depth>1)) ? toFlatten.flat(depth-1) : toFlatten);
      }, []);
    }
});



function findLastLetter(arr) {
	if (arr.length === 1) {return arr[0]}
	var indexMax = 0
	var letterFound
	arr.forEach((letter, i) => {
		var index = letters.indexOf(letter)
		if (index > indexMax) {indexMax = index; letterFound = letter} 
	})

	return letterFound
}

