
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

module.exports = {
    random, sleep, useCache
}