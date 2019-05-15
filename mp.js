const letters = ['A','B','C','D','E','F','G','H','I',
						   'J','K','L','M','N','O','P','Q','R',
						   'S','T','U','V','W','X','Y','Z','a',
						   'b','c','d','e','f','g','h','i','j',
						   'k','l','m','n','o','p','q','r','s',
						   't','u','v','w','x','y','z','0','1',
						   '2','3','4','5','6','7','8','9','$'];
						   // '%','@','£','#','?','>','&','€','/'];

var ticksize

var dayduration = {'starthour': 17, 'endhour': 15, 'thisdaystart': null}
dayduration.thisdaystart = dayduration.starthour > dayduration.endhour ? 24 : dayduration.starthour; 

var sessions_times = [{'start': '1700', 'end': '0830', 'name': 'eth'},
											{'start': '0830', 'end': '1515', 'name': 'rth'}]

var timestamp_0

var lastTimestamp = 0

function getDayProfileData(timestamp_0000, daybars, sessions_times) {

	timestamp_0 = timestamp_0000

	ticksize = 0.25;
	var dayProfileData = []
	var sessions = getLabeledSessions(daybars, sessions_times)

	sessions.forEach((session) => {
		var session_P = {'h': null, 'l': null, 'periods': {}}

		var periods = d3.nest()
		  .key(function(d) {return d.p;})
		  .rollup(function(v) { return {
		    count: v.length,
		    o: d3.min(v, function(d) { return d.po; }),
		    h: d3.max(v, function(d) { return d.h; }),
		    l: d3.min(v, function(d) { return d.l; }),
		    vol: d3.sum(v, function(d) { return d.v; }),
		    bars: v
	  	};
	  })
	  .entries(session);

	  session_P.h = d3.max(periods.map((d) => {return d.value.h}))
	  session_P.l = d3.min(periods.map((d) => {return d.value.l}))

		periods.forEach((period) => {
			let periodVP = vProfilePeriodBars(period.value.bars, period.value.h, period.value.l);
			session_P.periods[period.key] = {'o': period.value.o,
																			 'h': period.value.h,
																			 'l': period.value.l,
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
			console.log(letter)
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
	// console.log(poc_contendents)

	if (poc_contendents.length > 1) {
		
		var maxMidDist = d3.min(poc_contendents.map(function(arr) {
			 return Math.abs(mid - arr[0])
		}))
		var index4poc
		poc_contendents.forEach((arr, i) => {
			// console.log('el ' + i + ': ' + Math.abs(mid - arr[0]))
			index4poc = Math.abs(mid - arr[0]) === maxMidDist ? i : index4poc;
		})
		// console.log(poc_contendents)
		// console.log(maxMidDist)
		// console.log(index4poc)
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
		let hHourslist = getPeriodsTimes(timestamp_0, session_t)
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

		var dic = {'period': letters[j], 'timestamp': i, 'localTime': writeDate(i)}
		halfhours.push(dic)
	}
	halfhours.push({'timestamp': end, 'localTime': writeDate(end)})
	

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

			if (bar.t === periodStart) {
				bar.po = bar.o
			}

			if (bar.t >= periodStart && bar.t < periodEnd) {
				bar.t > lastTimestamp ? lastTimestamp = bar.t : null; 
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

function setHours(timestamp, hours, minutes) {
	timestamp += (hours * 1000 * 60 * 60)
	timestamp += (minutes * 1000 * 60)

	return timestamp
}




