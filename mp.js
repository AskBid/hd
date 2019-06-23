const letters = ['A','B','C','D','E','F','G','H','I',
						   'J','K','L','M','N','O','P','Q','R',
						   'S','T','U','V','W','X','Y','Z','a',
						   'b','c','d','e','f','g','h','i','j',
						   'k','l','m','n','o','p','q','r','s',
						   't','u','v','w','x','y','z','0','1',
						   '2','3','4','5','6','7','8','9','$'];
						   // '%','@','£','#','?','>','&','€','/'];

function getDayProfileData(daybars, sessions_times) {

	if ($(location).attr("href").includes('zn')) {
		daybars = completeZNpriceBars(daybars);
	}

	var dayProfileData = []
	var sessions = getLabeledSessions(daybars, sessions_times)

	sessions.forEach((session, i) => {

		var periods = d3.nest()
		  .key(function(d) {return d.p;})
		  .rollup(function(v) { 
		  	//for each period
		  	var open_close = d3.extent(v, function(d) { return d.t;})
		  	var open = v.filter((bar) => {return bar.t === open_close[0]})[0].o
		  	var close = v.filter((bar) => {return bar.t === open_close[1]})[0].c

		  	return {
			    count: v.length,
			    o: open,
			    c: close,
			    h: d3.max(v, function(d) { return d.h; }),
			    l: d3.min(v, function(d) { return d.l; }),
			    vol: d3.sum(v, function(d) { return d.v; }),
			    bars: v
	  		};
	  	})
	  .entries(session);

	  var session_P = {'tag': sessions_times[i].name,'h': null, 'l': null, 'periods': {}, 'lastTimestamp': lastTimestamp}
	  session_P.h = d3.max(periods.map((d) => {return d.value.h}))
	  session_P.l = d3.min(periods.map((d) => {return d.value.l}))

		periods.forEach((period) => {
			let periodVP = vProfilePeriodBars(period.value.bars, period.value.h, period.value.l);
			session_P.periods[period.key] = {
				'c': period.value.c,
				'o': period.value.o,
				'h': period.value.h,
				'l': period.value.l,
				'v': period.value.vol,
				'poc': null,
				'vpoc': null,
				'vp': periodVP}
		})

		dayProfileData.push(session_P)
	});

	dayProfileData.forEach((session_P) => {
		profileValues(session_P);
	})

	return dayProfileData
}

function profileValues(session_Pdata) {
	hi = session_Pdata.h
	lo = session_Pdata.l

	profileTPOval = {}
	profileVOL = {}
	for (let p = hi; p >= lo; p -= ticksize) {
		profileTPOval[p] = 0;
		profileVOL[p] = 0;
	}

	// var periods = session_Pdata.periods

	letters.forEach((letter) => {
		var period = session_Pdata.periods[letter]
		if (period) {
			for (let p = period.h; p >= period.l; p -= ticksize) {
				profileTPOval[p] += 1;
			}
			profileVOL = mergeObjs(profileVOL, period.vp)
			period.poc = calculatePOC(profileTPOval)
			period.vpoc = calculatePOC(profileVOL)
		}
	});
	session_Pdata.sessionVprofile = profileVOL
}

function mergeObjs(objA, objB) {
	var mergedObj = Object.keys(objA).concat(Object.keys(objB))

  // iterate to generate the object
  .reduce(function(obj, k) {
    // define object property, treat as 0 if not defined
    obj[k] = (objA[k] || 0) + (objB[k] || 0);
    // return object difference
    return obj;
    // set initial value as an empty object
  }, {})

  return mergedObj
}

function calculatePOC(profile) {
	var profileArr = Object.keys(profile).map(function(key) {
			 var price = [parseFloat(key), profile[key]]
			 return price
	})

	var currentProfile = profileArr.filter((arr) => {
		return arr[1] > 0
	})

	var hi = d3.max(currentProfile.map(function(arr) {
			 return parseFloat(arr[0])
	}))
	var lo = d3.min(currentProfile.map(function(arr) {
			 return parseFloat(arr[0])
	}))
	var maxTPO = d3.max(currentProfile.map(function(arr) {
			 return parseInt(arr[1])
	}))
	var mid = ((hi - lo)/2)+lo;

	var poc_contendents = currentProfile.filter((arr) => {
			return arr[1] === maxTPO;
		})

	if (poc_contendents.length > 1) {
		
		var maxMidDist = d3.min(poc_contendents.map(function(arr) {
			 return Math.abs(mid - arr[0])
		}))
		var index4poc
		poc_contendents.forEach((arr, i) => {
			index4poc = Math.abs(mid - arr[0]) === maxMidDist ? i : index4poc;
		})

		// still missing in case there is more equidistant from mid point pocs and you have to 
		// calculate the side with most tpos.
		return {'price': poc_contendents[index4poc][0], 'tpos/vol': poc_contendents[index4poc][1]}
	} else {
		return {'price': poc_contendents[0][0], 'tpos/vol': poc_contendents[0][1]}
	}
}

function vProfilePeriodBars(bars, hi, lo) {
	var profile = {}
	for (let p = hi; p >= lo; p -= ticksize) {
		profile[p] = 0;
	}
	// console.log(profile)
	bars.forEach((bar) => {
		let range = ((bar.h - bar.l) / ticksize) + 1;
		let volstep = parseInt(bar.v / range);
		// console.log('-----')
		// console.log(volstep)
		// console.log('bar.v: ' + bar.v)
		// console.log('range: ' + range)		
		// console.log('high: ' + bar.h)
		// console.log('low: ' + bar.l)	
			
		for (let p = bar.h; p >= bar.l; p -= ticksize) {
			profile[p] += volstep;
			// console.log(`added ${volstep} to ${p}`)	
		}
		// console.log('-----')	
	});
	
	return profile
}

function getLabeledSessions(daybars, sessions_times) {
	var day_sessions = []
	var reminder = daybars.slice(0);

	sessions_times.forEach((session_t) => {
		let hHourslist = getPeriodsTimes(timestamp_0000, session_t)
		let splitday = labelBars_session(reminder, hHourslist)
		day_sessions.push(splitday.labeled)
		reminder = splitday.reminder
	});

	return day_sessions
}

function getPeriodsTimes(timestamp_0000, session_t) {
	var starthour = parseInt(session_t.start.slice(0,2))
	var startmins =  parseInt(session_t.start.slice(2,4))
	var endhour =   parseInt(session_t.end.slice(0,2))	
	var endmins =    parseInt(session_t.end.slice(2,4))

	var offset_s = 0
	var offset_e = 0

	if (starthour < dayduration.thisdaystart && starthour > dayduration.endhour) {
		offset_s = 1
	}
	if (endhour < dayduration.thisdaystart && endhour > dayduration.endhour) {
		offset_e = 1
	}

	var start = setHours(timestamp_0000, 
											 starthour - (24 * offset_s),
											 startmins)
	var end = setHours(timestamp_0000, 
										 endhour - (24 * offset_e),
										 endmins)

	var halfhours = []
	for (let i = start, j = 0; i < end; i += 1800000, j++) { //1800000 = 30 minuts times 60 seconds times 1000 milliseconds

		var dic = {'period': letters[j], 'timestamp': i, 'humanTime': getCTtime(i).digitime}
		halfhours.push(dic)
	}
	halfhours.push({'period': 'end', 'timestamp': end, 'humanTime': getCTtime(end).digitime})
	
	return halfhours
}

function labelBars_session(daybars, halfhours) {
	var splitday = []
	var reminderday = []

	daybars.forEach((bar, i) => {
		var bar_refused = true
		
		for (j = 0; j < halfhours.length - 1; j++) {
			var periodEnd = halfhours[j+1].timestamp
			var periodStart = halfhours[j].timestamp

			if (bar.t >= periodStart && bar.t < periodEnd) {
				if (bar.t > lastTimestamp) {
					// console.log('oldest bar'); 
					// console.log(bar); 
					lastTimestamp = bar.t} 
				bar.p = letters[j]

				splitday.push(bar)
				bar_refused = false
				continue
			} 
		}
		if (bar_refused) {reminderday.push(bar)}
	})
	
	return {'labeled': splitday, 'reminder': reminderday}
}


function writeDate(timestamp) {
	date = new Date(timestamp)
	var str = (date.getHours() + ':' + 
						 date.getMinutes()+ '   _' + 
						 date.getFullYear() + '-' +
						(date.getMonth() + 1) + '-' +
						 date.getDate()+ ' seconds(' +
						 date.getSeconds()+ ')')

	return str
}

function writeTime(timestamp) {
	date = new Date(timestamp)
	var str = `${date.getHours() < 10 ? '0' + date.getHours() : date.getHours()}`+
						`${date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()}`

	return str
}

function setHours(timestamp, hours, minutes) {
	timestamp += (hours * 1000 * 60 * 60)
	timestamp += (minutes * 1000 * 60)

	return timestamp
}

function completeZNpriceBars(bars) {
	var barsnew = []
	bars.forEach((bar) => {
		barnew = Object.assign({}, bar)
		barnew.o = completeZNprice(bar.o)
		barnew.l = completeZNprice(bar.l)
		barnew.h = completeZNprice(bar.h)
		barnew.c = completeZNprice(bar.c)

		barsnew.push(barnew)
	})

	return barsnew
}


function completeZNprice(price) {
	var lastDigitMap = { 
			'4':  	0.000025,
			'9':	0.000025,
			'6':	0.000075,
			'8':	0,
			'3':	0,
			'0':	0.00005,
			'1':	0.000075,
			'5':	0.00005,
		}

		var priceLastDigit = (price * 10000) % 10

		var toAdd = lastDigitMap[priceLastDigit]

		price += toAdd

		return parseFloat(price.toFixed(6))
}

function getCTtime(timestamp) {
	var aestTime = new Date(timestamp).toLocaleString("en-US", {timeZone: "America/Chicago"});
	aestTime = new Date(aestTime);
	// var time_str = aestTime.toLocaleString().split(', ')[1].replace(':00','')

	
	return {
		'date': aestTime.getFullYear() + '-' +
						(aestTime.getMonth() + 1) + '-' +
						aestTime.getDate(),
		'time': (aestTime.getHours().toString().length > 1 ? aestTime.getHours() : '0' + aestTime.getHours())
								+ ':' + 
						(aestTime.getMinutes().toString().length > 1 ? aestTime.getMinutes() : '0' + aestTime.getMinutes()),
		'digitime': `${aestTime.getHours().toString().length > 1 ? aestTime.getHours() : '0' + aestTime.getHours()}`
								+
						`${aestTime.getMinutes().toString().length > 1 ? aestTime.getMinutes() : '0' + aestTime.getMinutes()}`
	}
}




