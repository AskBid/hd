function updateData(data) {
	var minmax = getMinMaxDates(data)
	populateDatePicker(minmax.min, minmax.max)

	dataGLOBAL = data
}

function plotAllData(data) {
	var date_str = $('.interface input').val()
	
	var daybars = dataGLOBAL[date_str].bars

	timestamp_0000 = dataGLOBAL[date_str].dayTime0

	var mpData = getDayProfileData(daybars, sessions_times);
	console.log(mpData)
	mpData = mpData[1].h ? mpData[1] : mpData[0]
	console.log(mpData)
	plot(mpData)
}

function populateDatePicker(minDate, maxDate) {
		$( "#datepicker" ).remove()

		$( ".interface" ).append('<input type="text" id="datepicker">')

		$( "#datepicker" ).datepicker({
				dateFormat: "yy-m-d",
				minDate: minDate,
				maxDate: maxDate,
				beforeShowDay: $.datepicker.noWeekends
		});
		$('#datepicker').datepicker('setDate', maxDate);
		$('#datepicker').css('width', '100px')
		$('#datepicker').css('height', '12px')
		$('#datepicker').css('text-align', 'center')
}

function getMinMaxDates(data) {
	var datedayslist = []
	var datedaysliststr = Object.keys(data)
	
	//find max and min date from data for date picker
	datedaysliststr.forEach(function(date) {
		date = date.split('-')
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
	var dates = [initdate.getFullYear() + '-' + 
							(initdate.getMonth() + 1)  + '-' + 
							 initdate.getDate()]

	for (let i = 1; i < ndaysBack; i++) {
		var backdate = new Date(initdate)
		backdate.setHours(initdate.getHours() - (24*i))
		if (backdate.getDay() == 0 || backdate.getDay() == 6) {
			backdate = 'weekend';
			ndaysBack++
			dates.push(backdate)
			continue
		}
		dates.push(backdate.getFullYear() + '-' + 
							(backdate.getMonth() + 1)  + '-' + 
							 backdate.getDate())
	}
	return dates
}

function plot(mpData) {
	var width = window.innerWidth;	
	var height = window.innerHeight;

	d3.selectAll('svg').remove()

	svg = d3.select('.svgcontainer')
		.append('svg')
         .attr('width', width)
         .attr('height', height)
         .style('background', '#229')


	var localTime = new Date(lastTimestamp + 60000)
	svg.append('text')
			.text((localTime.getHours().toString().length > 1 ? localTime.getHours() : '0' + localTime.getHours())
						+ ':' + 
				(localTime.getMinutes().toString().length > 1 ? localTime.getMinutes() : '0' + localTime.getMinutes()))
			.attr("y", 33)
			.attr("x", 10)
			.style("font-size", `1.6em`)
			.style("font-color", `#fff`)
			.style("font-family", 'digital-7regular')
			.style("text-shadow", '2px 2px 1.6px #dd8')
	svg.append('text')
			.text(getDayFromDate(getCTtime(localTime.getTime()).date))
			.attr("y", 12)
			.attr("x", 12)
			.style("font-size", `0.9em`)
			.style("font-color", `#fff`)
			.style("font-family", 'digital-7regular')
			.style("letter-spacing", '0.7em')
			.style("text-shadow", '1.6px 1.6px 1px #dd8')
	svg.append('text')
			.text( '[' + getCTtime(lastTimestamp + 60000).time + ' CME]' )
			.attr("y", 47)
			.attr("x", 10)
			.style("font-size", `0.6em`)
			.style("font-color", `#fff`)
			.style("font-family", 'sans-serif, Helvetica')
			.style("letter-spacing", '0.06em')

	var lastLetter = Object.keys(mpData.periods).pop()
	var lastBar = mpData.periods[lastLetter]
	var lastPrice = lastBar.c
	// var lastPrice = lastBar.poc.price

	var mpWidth = lastBar.poc['tpos/vol']
	var bpWidth = letters.indexOf(lastLetter) + 1

	var fontsize = 10
	var fontwidth = 12
	var textOffset = ((fontsize/20)*8); //to get font centered to Y ticks
	var maxSCRlettersH = Math.round((height-20) / fontsize)
	var maxSCRlettersW = Math.round((width) / fontwidth)

	var yMin = lastPrice - ((Math.floor(maxSCRlettersH/2) + 2) * ticksize);
	var yMax = lastPrice + ((Math.floor(maxSCRlettersH/2) - 2) * ticksize);

	const xMin = 0
	const xMax = maxSCRlettersW

	const xScale = d3
	  .scaleTime()
	  .domain([xMin, xMax])
	  .range([100, (width)]);

	const yScale = d3
	  .scaleLinear()
	  .domain([yMin, yMax])
	  .range([height+1, -1]);

	var yAxis = d3.axisRight(yScale).ticks(3).tickSize(2).tickValues(d3.range(mpData.l, mpData.h, 10*ticksize)).tickFormat(d3.format(".2f"))

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
		// marketprofile = mergeObjs(marketprofile, bar);
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
	// console.log('data used for D3 plotting: ')
	// console.log(barprofile)
	// console.log(marketprofile)

	svg.selectAll("g").remove()

	var gY = svg.append("g")
		.attr("class", "yaxis")
		.attr("transform", (`translate(${width - 70},0)`))
		.call(yAxis);

	svg = d3.select("svg")
			.call(d3.zoom().on("zoom", function () {
					svg.attr("transform", d3.event.transform)
					gY.call(yAxis.scale(d3.event.transform.rescaleY(yScale)));
				}))
			.append("g")

	drawProfile(marketprofile, 'mpbar', 0, mpWidth);
	drawProfile(barprofile, 'bar', mpWidth + 5, bpWidth);

	function drawProfile(profile, id, startcolumn, columnwidth) {
		svg.selectAll(`#${id}`)
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
					.enter()
				})

		svg.append('rect')
				.attr('id', id)
				.attr('y', yScale(lastPrice) - (fontsize/2))
				.attr('x', xScale(startcolumn) - 4)
				.attr('rx', 2)
				.attr('ry', 2)
				// .attr('width', columnwidth)
				.attr('width', xScale(startcolumn + columnwidth) - xScale(startcolumn) + 3 )
				.attr('height', fontsize + 1)
	}

	thisletters = Object.keys(mpData.periods)

	thisletters.forEach((letter) => {
		var openPrice = mpData.periods[letter].o
		$(`text[price='${openPrice}']`).each((i, text) => {
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
			$(`text[price='${tpocPrice}']`).each((i, text) => {
				if ($(text).text() === letter) {
					$(text).css("fill", "rgba(255,148,30,1");
					$(text).css('font-weight', "400");
				}
			}) 
		}
	})

	var lastPocPrice = mpData.periods[thisletters.pop()].poc.price;
	$(`text[price='${lastPocPrice}']`).each((i, text) => {
		$(text).css("fill", "rgba(20,220,20,0.9");
		$(text).css('font-weight', "700");
	})

	// svg.attr('background', 'red')
}

function getDayFromDate(date_str) {
	date_str = date_str.split('-')
	var initdate = new Date(date_str[0], date_str[1]-1, date_str[2])

	let days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	let dayName = days[initdate.getDay()];

	return dayName
}

