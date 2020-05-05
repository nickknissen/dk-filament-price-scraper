
function useCache(filename) {
  let fd;
  let stats;
  try {
    fd = fs.openSync(filename, 'r');
    stats = fs.fstatSync(fd)
  } catch (err) {
    return false;
  } finally {
    if (fd !== undefined)
      fs.closeSync(fd);
  }

  var twentyfourHoursAgo = new Date().getTime() - (1 * 24 * 60 * 60 * 1000)

  return stats.mtime.getTime() > twentyfourHoursAgo;
}


function random(max, min) {
  return Math.floor(Math.random()*(max-min+1)+min)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function detectType(text)  {
  const regex = /(PETG|PLA|ABS|ASA|RESIN|FLEX|nylon|PC|PP\+|PBT\+|PVA)/gim
  const types = ["PETG", "PLA", "ABS", "ASA", "RESIN", "FLEX", "nylon", "PC", "PP+", "PBT+", "PVA"];

  const matches = str.match(regex);
  if (!matches) {
    return 'unknow';
  }

  const groupd = matches.reduce((total, value) => {
      total[value] = (total[value] || 0) + 1;
      return total;
  }, {});

  return Object.entries(groupd) // Convert to [["ABS", 1], ["PLA", 2]]
    .sort((a, b) => b[1] - a[1])  // Sort by most common [["PLA", 2],["ABS", 1]]
    .shift() //take first element ["PLA", 2]
    .shift(); // get type "PLA"
}

module.exports = {
    random, sleep, useCache
}